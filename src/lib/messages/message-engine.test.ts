import { describe, expect, it } from "vitest";
import type { Payload } from "payload";
import { DeterministicAiProvider, LogEmailProvider } from "@/lib/providers/safe-providers";
import { createLeadAiReply, createReceiptMessage, deliverMessage, enqueueMessageJob } from "./message-engine";

function repository() {
  type Document = Record<string, unknown> & { id: number };
  const leads: Document[] = [{
    id: 1,
    name: "Testkunde",
    email: "kunde@example.test",
    postal: "1182",
    city: "Oslo",
    address: "Ikke oppgitt",
    approxSqm: null,
    inquiryType: "takvask",
    language: "no",
    message: "Hva trenger dere av bilder?",
    photoUrls: "",
    status: "new",
  }];
  const messages: Document[] = [];
  const jobs: Document[] = [];
  const collections: Record<string, Document[]> = { leads, messages, "operational-jobs": jobs };
  const payload = {
    async find({ collection, where }: { collection: string; where?: { idempotencyKey?: { equals?: string } } }) {
      const docs = collections[collection] || [];
      const key = where?.idempotencyKey?.equals;
      return { docs: key ? docs.filter((item) => item.idempotencyKey === key) : docs, totalDocs: docs.length };
    },
    async findByID({ collection, id }: { collection: string; id: number }) {
      const item = (collections[collection] || []).find((entry) => entry.id === id);
      if (!item) throw new Error("not found");
      return structuredClone(item);
    },
    async create({ collection, data }: { collection: string; data: Record<string, unknown> }) {
      const target = collections[collection] || (collections[collection] = []);
      const created = { id: target.length + 1, ...structuredClone(data), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      target.push(created);
      return structuredClone(created);
    },
    async update({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) {
      const item = (collections[collection] || []).find((entry) => entry.id === id);
      if (!item) throw new Error("not found");
      Object.assign(item, structuredClone(data));
      return structuredClone(item);
    },
  } as unknown as Payload;
  return { payload, leads, messages, jobs };
}

const validAiReply = {
  summary: "Kunden ønsker takvask og spør hvilke bilder som trengs for videre vurdering.",
  serviceCategory: "takvask",
  missingInformation: ["Bilder av hele takflaten"],
  riskFlags: [],
  recommendedNextAction: "request_information",
  subject: "Flere opplysninger om taket",
  replyDraft: "Takk for henvendelsen. Send gjerne oversiktsbilder av takflatene tatt trygt fra bakken. Vi kontrollerer materialet før vi foreslår riktig neste steg.",
};

describe("message engine", () => {
  it("creates and delivers the receipt exactly once", async () => {
    const state = repository();
    const first = await createReceiptMessage(state.payload, 1, "receipt-test");
    const second = await createReceiptMessage(state.payload, 1, "receipt-test-repeat");
    expect(first).toMatchObject({ skipped: false, duplicate: false });
    expect(second).toMatchObject({ skipped: false, duplicate: true });
    expect(state.messages).toHaveLength(1);
    expect(state.jobs).toHaveLength(1);
    expect(state.messages[0]?.bodyHtml).toContain("/brand/logo.webp");

    const provider = new LogEmailProvider();
    await deliverMessage(state.payload, provider, 1, "receipt-test");
    await deliverMessage(state.payload, provider, 1, "receipt-test-repeat");
    expect(provider.deliveries).toHaveLength(1);
    expect(state.messages[0]?.status).toBe("sent");
  });

  it("stores a validated AI reply as a draft and never sends it", async () => {
    const state = repository();
    const result = await createLeadAiReply(state.payload, new DeterministicAiProvider(validAiReply), 1, "ai-test");
    expect(result.message).toMatchObject({ status: "draft", aiAssisted: true });
    expect(state.leads[0]?.status).toBe("draft_ready");
    expect(state.jobs).toHaveLength(0);
  });

  it("reopens an exhausted delivery job without creating a duplicate", async () => {
    const state = repository();
    await createReceiptMessage(state.payload, 1, "receipt-retry");
    Object.assign(state.jobs[0]!, { status: "attention", attempts: 3 });
    await enqueueMessageJob(state.payload, 1, "receipt-retry-again");
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("does not regress a converted lead when sending a signed contract copy", async () => {
    const state = repository();
    state.leads[0]!.status = "converted";
    await state.payload.create({ collection: "messages", overrideAccess: true, data: {
      lead: 1,
      direction: "outbound",
      category: "contract",
      channel: "email",
      subject: "Signert kontrakt K-1-V1",
      bodyText: "Kontrakten er signert.",
      status: "queued",
      idempotencyKey: "contract-signed:1",
      aiAssisted: false,
      approvedAt: new Date().toISOString(),
      queuedAt: new Date().toISOString(),
    } });

    await deliverMessage(state.payload, new LogEmailProvider(), 1, "contract-confirmation");

    expect(state.messages[0]?.status).toBe("sent");
    expect(state.leads[0]?.status).toBe("converted");
  });

  it("keeps a completion message in the converted pipeline state", async () => {
    const state = repository();
    state.leads[0]!.status = "measuring";
    await state.payload.create({ collection: "messages", overrideAccess: true, data: {
      lead: 1,
      direction: "outbound",
      category: "completion",
      channel: "email",
      subject: "Takarbeidet er dokumentert",
      bodyText: "Arbeidet er fullført og dokumentert.",
      status: "queued",
      idempotencyKey: "work-order-completion:1",
      aiAssisted: false,
      approvedAt: new Date().toISOString(),
      queuedAt: new Date().toISOString(),
    } });

    await deliverMessage(
      state.payload,
      new LogEmailProvider(),
      1,
      "completion-message",
    );

    expect(state.messages[0]?.status).toBe("sent");
    expect(state.leads[0]).toMatchObject({
      status: "converted",
      nextAction: "Oppdrag fullført og dokumentert.",
      nextActionAt: null,
    });
  });

  it("keeps the lead when AI validation fails", async () => {
    const state = repository();
    await expect(createLeadAiReply(state.payload, new DeterministicAiProvider({ invalid: true }), 1, "ai-fail")).rejects.toThrow();
    expect(state.leads).toHaveLength(1);
    expect(state.leads[0]?.status).toBe("new");
    expect(state.messages).toHaveLength(0);
  });

  it("does not generate an AI draft for a converted lead", async () => {
    const state = repository();
    state.leads[0]!.status = "converted";
    await expect(createLeadAiReply(state.payload, new DeterministicAiProvider(validAiReply), 1, "stale-ai-job"))
      .rejects.toThrow("converted or closed");
    expect(state.messages).toHaveLength(0);
    expect(state.leads[0]?.status).toBe("converted");
  });
});
