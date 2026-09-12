import type { Payload } from "payload";
import { describe, expect, it, vi } from "vitest";
import { loadAdminCase, loadAdminCaseWorkspace } from "./case-read-model";
import type { CaseCurrentSelection } from "./case-current-selection";

const selection: CaseCurrentSelection = {
  measurementId: 1,
  priceId: 2,
  workingQuoteId: 13,
  workingContractId: 14,
  effectiveQuoteId: 11,
  effectiveContractId: 12,
  actionContractId: 14,
  workOrderId: null,
  messageId: 20,
};

function fixture() {
  const records: Record<string, Record<number, Record<string, unknown>>> = {
    leads: {
      7: {
        id: 7,
        name: "Boundary",
        status: "quoted",
        address: "Testveien",
        inquiryType: "takvask",
      },
    },
    "roof-measurements": {
      1: { id: 1, lead: 7, status: "approved", reference: "M-old" },
    },
    "price-calculations": {
      2: { id: 2, lead: 7, status: "ready", reference: "P-old" },
    },
    quotes: {
      11: {
        id: 11,
        lead: 7,
        version: 1,
        status: "accepted",
        reference: "Q-effective",
      },
      13: {
        id: 13,
        lead: 7,
        version: 2,
        status: "draft",
        reference: "Q-working",
      },
    },
    contracts: {
      12: {
        id: 12,
        quote: 11,
        version: 1,
        status: "signed",
        companySignedAt: "2026-01-01T00:00:00Z",
        reference: "K-effective",
      },
      14: {
        id: 14,
        quote: 13,
        version: 2,
        status: "draft",
        reference: "K-working",
      },
    },
    messages: {
      20: {
        id: 20,
        lead: 7,
        status: "failed",
        category: "information_request",
        direction: "outbound",
        subject: "Unresolved old delivery",
        createdAt: "2026-01-01T00:00:00Z",
      },
    },
  };
  const findByID = vi.fn(
    async ({ collection, id }: { collection: string; id: number }) => {
      const record = records[collection]?.[id];
      if (!record) throw new Error("Missing fixture record");
      return record;
    },
  );
  const find = vi.fn(async ({ collection }: { collection: string }) => ({
    docs: [
      "roof-measurements",
      "price-calculations",
      "quotes",
      "contracts",
      "messages",
    ].includes(collection)
      ? Array.from({ length: 100 }, (_, index) => ({
          id: 1000 + index,
          lead: 7,
          quote: 1000 + index,
          version: 1000 + index,
          status: collection === "messages" ? "delivered" : "superseded",
          direction: "outbound",
          category: "receipt",
          subject: `Other ${index}`,
          createdAt: "2026-09-01T00:00:00Z",
        }))
      : [],
    totalDocs: 100,
    totalPages: 4,
    page: 1,
    hasNextPage: true,
    hasPrevPage: false,
  }));
  return { payload: { findByID, find } as unknown as Payload, findByID, find };
}

describe("exact current IDs independent of presentation caps", () => {
  it("hydrates old current records and retains effective and working commercial roles", async () => {
    const source = fixture();
    const result = await loadAdminCase(source.payload, 7, selection);
    expect(result?.measurement?.id).toBe(1);
    expect(result?.price?.id).toBe(2);
    expect(result?.commercial.effectiveContract?.id).toBe(12);
    expect(result?.commercial.workingQuote?.id).toBe(13);
    expect(result?.commercial.workingContract?.id).toBe(14);
    expect(result?.nextAction).toEqual({ kind: "retry_message", targetId: 20 });
    expect(source.findByID).toHaveBeenCalledTimes(8); // lead + seven selected records
    expect(
      source.find.mock.calls.every(
        ([args]) => !(args as { pagination?: boolean }).pagination,
      ),
    ).toBe(true);
  });

  it("loads bounded question context for only current-page reply targets", async () => {
    const source = fixture();
    const find = source.find;
    find.mockImplementation(
      async ({ collection }: { collection: string }) =>
        ({
          docs:
            collection === "messages"
              ? [
                  {
                    id: 30,
                    status: "sent",
                    direction: "outbound",
                    category: "ai_reply",
                    replyToMessage: 29,
                  },
                ]
              : [],
          totalDocs: 1,
          totalPages: 1,
          page: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }) as never,
    );
    const loadDocuments = vi.fn(async () => ({
      items: [],
      totalDocs: 0,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }));
    const loadQuestions = vi.fn(async () => ({
      latest: null,
      unresolved: null,
      threads: [],
      status: "none" as const,
    }));
    const result = await loadAdminCaseWorkspace(
      source.payload,
      7,
      {},
      loadDocuments,
      async () => selection,
      loadQuestions,
    );
    expect(result).toBeTruthy();
    expect(loadQuestions).toHaveBeenCalledExactlyOnceWith(7, [29]);
    expect(
      find.mock.calls.some(
        ([args]) => (args as { pagination?: boolean }).pagination === false,
      ),
    ).toBe(false);
  });
});
