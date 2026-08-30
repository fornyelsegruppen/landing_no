import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  create: vi.fn(),
  deliver: vi.fn(),
  enqueue: vi.fn(),
  find: vi.fn(),
  recordAudit: vi.fn(),
  resolve: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    create: mocks.create,
    find: mocks.find,
    update: mocks.update,
  })),
}));
vi.mock("@/lib/manual-contact/recovery", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/manual-contact/recovery")>();
  return {
    ...actual,
    consumeManualContactRecoveryToken: mocks.consume,
    resolveManualContactRecoveryToken: mocks.resolve,
  };
});
vi.mock("@/lib/messages/message-engine", () => ({
  deliverMessage: mocks.deliver,
  enqueueMessageJob: mocks.enqueue,
}));
vi.mock("@/lib/providers/email-provider", () => ({
  createEmailProvider: vi.fn(() => ({ health: () => ({ status: "ready" }) })),
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: vi.fn(() => "192.0.2.1"),
  rateLimit: vi.fn(async () => ({ success: true, remaining: 4 })),
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/audit/audit-event", () => ({
  recordAuditEvent: mocks.recordAudit,
}));

import { POST } from "./route";

function request(email: string, emailConfirmation = email) {
  return new Request(
    `https://www.takfornyelse.as/api/customer/contact/${"t".repeat(43)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, emailConfirmation }),
    },
  );
}

describe("customer manual contact recovery", () => {
  beforeEach(() => {
    mocks.consume.mockReset().mockResolvedValue(true);
    mocks.resolve.mockReset().mockResolvedValue({
      record: { id: 12 },
      lead: {
        id: 2,
        email: "wrong@example.no",
        recordState: "active",
      },
      sourceMessage: {
        id: 4,
        category: "receipt",
        subject: "Vi har mottatt henvendelsen din",
        bodyText: "Takk for henvendelsen.",
        bodyHtml: "<p>Takk</p>",
        attachments: [],
        aiAssisted: false,
        aiAnalysis: { manualRecovery: { status: "contacted" } },
      },
    });
    mocks.find.mockReset().mockResolvedValue({ docs: [] });
    mocks.create.mockReset().mockResolvedValue({ id: 33 });
    mocks.update.mockReset().mockResolvedValue({ id: 2 });
    mocks.deliver.mockReset().mockResolvedValue({ duplicate: false });
    mocks.enqueue.mockReset();
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
  });

  it("saves a separate communication email and resends only the selected message", async () => {
    const response = await POST(request(" Customer@Example.NO "), {
      params: Promise.resolve({ token: "t".repeat(43) }),
    });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "leads",
        id: 2,
        data: expect.objectContaining({
          communicationEmail: "customer@example.no",
          communicationEmailSourceMessage: 4,
        }),
      }),
    );
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "messages",
        data: expect.objectContaining({
          replyToMessage: 4,
          subject: "Vi har mottatt henvendelsen din",
          bodyText: "Takk for henvendelsen.",
          bodyHtml: expect.stringContaining(
            'src="https://www.takfornyelse.as/brand/logo.png"',
          ),
          aiAnalysis: expect.not.objectContaining({
            manualRecovery: expect.anything(),
          }),
        }),
      }),
    );
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0]?.data?.bodyHtml).not.toBe(
      "<p>Takk</p>",
    );
    expect(mocks.consume).toHaveBeenCalledWith(
      expect.anything(),
      12,
      expect.any(String),
    );
  });

  it("rejects two different addresses", async () => {
    const response = await POST(request("one@example.no", "two@example.no"), {
      params: Promise.resolve({ token: "t".repeat(43) }),
    });
    expect(response.status).toBe(400);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("fails closed when another request already consumed the token", async () => {
    mocks.consume.mockResolvedValue(false);

    const response = await POST(request("customer@example.no"), {
      params: Promise.resolve({ token: "t".repeat(43) }),
    });

    expect(response.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an expired, revoked or already-used token", async () => {
    mocks.resolve.mockResolvedValue(null);

    const response = await POST(request("customer@example.no"), {
      params: Promise.resolve({ token: "t".repeat(43) }),
    });

    expect(response.status).toBe(404);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("reuses the same recovery message and lets delivery idempotency prevent duplicates", async () => {
    mocks.find.mockResolvedValue({
      docs: [{ id: 33, status: "sent", idempotencyKey: "existing" }],
    });
    mocks.deliver.mockResolvedValue({ duplicate: true });

    const response = await POST(request("customer@example.no"), {
      params: Promise.resolve({ token: "t".repeat(43) }),
    });

    expect(response.status).toBe(200);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("queues exactly one retry when immediate delivery fails", async () => {
    mocks.deliver.mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(request("customer@example.no"), {
      params: Promise.resolve({ token: "t".repeat(43) }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ delivery: "queued" });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      33,
      expect.any(String),
      "customer_initiated",
    );
  });
});
