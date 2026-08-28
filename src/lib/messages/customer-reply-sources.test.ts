import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { loadCustomerReplySourceBundle } from "./customer-reply-sources";

type SourceOverrides = {
  inquiryType?: string;
  measurementAreaMaxTenths?: number;
  priceUnitOre?: number;
  quoteStatus?: string;
  workOrderStatus?: string;
};

function payloadWithTerms(
  version: string,
  reverseSources = false,
  overrides: SourceOverrides = {},
) {
  const findByID = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === "messages") {
      return {
        id: 20,
        lead: 1,
        direction: "inbound",
        bodyText: "Kan dere forklare hva som gjelder?",
        updatedAt: "2026-08-28T08:00:00.000Z",
      };
    }
    if (collection === "leads") {
      return {
        id: 1,
        inquiryType: overrides.inquiryType || "takvask",
        recordState: "active",
        status: "customer_waiting",
        updatedAt: "2026-08-28T08:00:00.000Z",
      };
    }
    throw new Error(`Unexpected findByID collection ${collection}`);
  });
  const find = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === "roof-measurements")
      return {
        docs: [
          {
            actualAreaMaxTenths: overrides.measurementAreaMaxTenths || 1_100,
            actualAreaMinTenths: 1_000,
            id: 11,
            reference: "TM-1-V1",
            status: "approved",
            updatedAt: "2026-08-28T08:00:00.000Z",
            version: 1,
          },
        ],
      };
    if (collection === "quotes")
      return {
        docs: [
          {
            id: 12,
            lead: 1,
            maximumTotalIncVatOre: 150_000,
            reference: "T-1-V1",
            serviceDescription: "Takvask",
            snapshotHash: "quote-hash-v1",
            status: overrides.quoteStatus || "sent",
            termsVersion: version,
            totalIncVatOre: 125_000,
            updatedAt: "2026-08-28T08:00:00.000Z",
            validUntil: "2026-09-28T00:00:00.000Z",
            version: 1,
          },
        ],
      };
    if (collection === "contracts") return { docs: [] };
    if (collection === "work-orders")
      return {
        docs: [
          {
            arrivalWindow: "08:00–10:00",
            id: 13,
            reference: "AO-1-V1",
            scheduledAt: "2026-09-10T08:00:00.000Z",
            status: overrides.workOrderStatus || "scheduled",
            updatedAt: "2026-08-28T08:00:00.000Z",
          },
        ],
      };
    if (collection === "contract-terms")
      return {
        docs: [
          {
            id: 5,
            version,
            title: "Gjeldende vilkår",
            contractText: `Vilkår ${version}`,
            withdrawalInstructions: "Angrerett",
            approvedAt: "2026-08-28T07:00:00.000Z",
            updatedAt: `2026-08-28T07:00:0${version === "V1" ? "0" : "1"}.000Z`,
          },
        ],
      };
    if (collection === "services")
      return {
        docs: [
          {
            id: 6,
            key: "takvask",
            titleNo: "Takvask",
            descriptionNo: "Kontrollert takvask",
            updatedAt: "2026-08-28T07:00:00.000Z",
          },
          {
            id: 8,
            key: "undertak",
            titleNo: "Undertak",
            descriptionNo: "Kontrollert undertak",
            updatedAt: "2026-08-28T07:00:00.000Z",
          },
        ].sort(() => (reverseSources ? -1 : 0)),
      };
    if (collection === "price-rules")
      return {
        docs: [
          {
            id: 7,
            reference: "PR-TAKVASK-V1",
            serviceKey: "takvask",
            termsVersion: version,
            unitPriceExVatOre: overrides.priceUnitOre || 9900,
            updatedAt: "2026-08-28T07:00:00.000Z",
            validFrom: "2026-01-01T00:00:00.000Z",
            validTo: null,
            version: 1,
          },
          {
            id: 9,
            reference: "PR-UNDERTAK-V1",
            serviceKey: "undertak",
            termsVersion: version,
            unitPriceExVatOre: 19900,
            updatedAt: "2026-08-28T07:00:00.000Z",
            validFrom: "2026-01-01T00:00:00.000Z",
            validTo: null,
            version: 1,
          },
        ].sort(() => (reverseSources ? -1 : 0)),
      };
    throw new Error(`Unexpected find collection ${collection}`);
  });
  return { find, findByID } as unknown as Payload;
}

describe("customer reply source bundle", () => {
  it("loads currently approved company terms, services and prices from the database", async () => {
    const bundle = await loadCustomerReplySourceBundle(payloadWithTerms("V1"), {
      leadId: 1,
      purpose: "question",
      sourceMessageId: 20,
    });
    const sources = bundle.context.businessSources;
    if (!sources) throw new Error("Expected current business sources");

    expect(sources.activeTerms).toMatchObject({
      version: "V1",
      text: "Vilkår V1",
    });
    expect(sources.services).toContainEqual(
      expect.objectContaining({ key: "takvask", title: "Takvask" }),
    );
    expect(sources.priceRules).toContainEqual(
      expect.objectContaining({
        reference: "PR-TAKVASK-V1",
        unitPriceExVatOre: 9900,
      }),
    );
  });

  it("changes the approval fingerprint when a governing source changes", async () => {
    const first = await loadCustomerReplySourceBundle(payloadWithTerms("V1"), {
      leadId: 1,
      purpose: "question",
      sourceMessageId: 20,
    });
    const second = await loadCustomerReplySourceBundle(payloadWithTerms("V2"), {
      leadId: 1,
      purpose: "question",
      sourceMessageId: 20,
    });

    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it("canonicalizes unordered source-query results before fingerprinting", async () => {
    const first = await loadCustomerReplySourceBundle(payloadWithTerms("V1"), {
      leadId: 1,
      purpose: "question",
      sourceMessageId: 20,
    });
    const reversed = await loadCustomerReplySourceBundle(
      payloadWithTerms("V1", true),
      {
        leadId: 1,
        purpose: "question",
        sourceMessageId: 20,
      },
    );

    expect(reversed.fingerprint).toBe(first.fingerprint);
    expect(reversed.snapshot).toEqual(first.snapshot);
  });

  it.each([
    ["lead service", { inquiryType: "takmaling" }],
    ["approved measurement", { measurementAreaMaxTenths: 1_200 }],
    ["quote status", { quoteStatus: "superseded" }],
    ["work-order status", { workOrderStatus: "on_way" }],
    ["approved price amount", { priceUnitOre: 10_900 }],
  ] satisfies Array<[string, SourceOverrides]>)(
    "changes the approval fingerprint when the %s changes",
    async (_label, overrides) => {
      const first = await loadCustomerReplySourceBundle(
        payloadWithTerms("V1"),
        {
          leadId: 1,
          purpose: "question",
          sourceMessageId: 20,
        },
      );
      const changed = await loadCustomerReplySourceBundle(
        payloadWithTerms("V1", false, overrides),
        {
          leadId: 1,
          purpose: "question",
          sourceMessageId: 20,
        },
      );

      expect(changed.fingerprint).not.toBe(first.fingerprint);
    },
  );
});
