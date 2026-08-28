import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { loadCustomerReplySourceBundle } from "./customer-reply-sources";

function payloadWithTerms(version: string, reverseSources = false) {
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
        inquiryType: "takvask",
        recordState: "active",
        status: "customer_waiting",
      };
    }
    throw new Error(`Unexpected findByID collection ${collection}`);
  });
  const find = vi.fn(async ({ collection }: { collection: string }) => {
    if (["roof-measurements", "quotes", "work-orders"].includes(collection))
      return { docs: [] };
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
            unitPriceExVatOre: 9900,
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
});
