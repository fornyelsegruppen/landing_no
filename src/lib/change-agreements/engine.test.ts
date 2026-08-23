import type { Payload } from "payload";
import { describe, expect, it } from "vitest";
import { buildQuoteSnapshot } from "@/lib/quotes/document";
import { createChangeAgreementDraft } from "./engine";

const quoteSnapshot = buildQuoteSnapshot({
  quoteReference: "T-1-V1", leadId: 1, serviceKey: "takvask", serviceDescription: "Takvask", propertyAddress: "Testveien 1",
  measurement: { id: 2, version: 1, inputHash: "a".repeat(64), horizontalAreaTenths: 1000, actualAreaMinTenths: 1000, actualAreaMaxTenths: 1100, source: "Kartverket", credits: "© Kartverket", capturedAt: "2026-08-23T10:00:00Z", assumptions: [] },
  pricing: { calculationId: 3, inputHash: "b".repeat(64), ruleId: 4, ruleVersion: 1, unitPriceExVatOre: 12500, subtotalExVatOre: 1375000, vatBasisPoints: 2500, vatOre: 343750, totalIncVatOre: 1718750, toleranceBasisPoints: 1000, maximumTotalIncVatOre: 1890625 }, termsVersion: "legal-v1", validUntil: "2099-09-06T10:00:00Z",
});

function payloadFor(outcome: string, previous?: Record<string, unknown>) {
  const updates: Array<Record<string, unknown>> = [];
  const order = { id: 8, status: "blocked", priceOutcome: outcome, contract: 3, quote: 4, actualAreaTenths: 1300, actualSubtotalExVatOre: 1625000, actualVatOre: 406250, actualTotalIncVatOre: 2031250, blockingReasons: ["Kontrollmålt areal er større enn rammen."] };
  const payload = {
    async findByID({ collection }: { collection: string }) {
      if (collection === "work-orders") return order;
      if (collection === "contracts") return { id: 3, status: "signed", documentHash: "c".repeat(64) };
      if (collection === "quotes") return { id: 4, status: "accepted", snapshot: quoteSnapshot };
      throw new Error("unexpected collection");
    },
    async find() { return { docs: previous ? [previous] : [] }; },
    async create({ data }: { data: Record<string, unknown> }) { return { id: 11, ...data }; },
    async update(args: Record<string, unknown>) { updates.push(args); return args; },
  } as unknown as Payload;
  return { payload, updates };
}

describe("change-agreement engine", () => {
  it("never converts an HMS block into a price agreement", async () => {
    const { payload } = payloadFor("hms_blocked");
    await expect(createChangeAgreementDraft(payload, { workOrderId: 8 })).rejects.toThrow(/HMS/);
  });

  it("creates a new immutable version and supersedes the previous open version", async () => {
    const previous = { id: 10, version: 1, status: "sent" };
    const { payload, updates } = payloadFor("over_maximum", previous);
    const agreement = await createChangeAgreementDraft(payload, { workOrderId: 8 }, new Date("2026-08-23T10:00:00Z"));
    expect(agreement).toMatchObject({ reference: "E-8-V2", version: 2, supersedes: 10, status: "draft" });
    expect(updates).toContainEqual(expect.objectContaining({ id: 10, data: { status: "superseded" } }));
  });
});
