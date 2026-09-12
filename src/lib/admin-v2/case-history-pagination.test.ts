import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  caseHistoryPageSize,
  loadCaseWorkspaceHistory,
  normalizeCaseHistoryPage,
  type AdminCase,
} from "./case-read-model";

const caseData = {
  changes: [],
  commercial: { contractVersions: [], quoteVersions: [] },
  contractRequests: [],
  documents: [],
  lead: { id: 42 },
  messages: [],
  officialInvoices: [],
  priceCalculations: [],
  quoteOptions: [],
  timeline: [],
} as unknown as AdminCase;

describe("case workspace history pagination", () => {
  it("normalizes untrusted page values to a bounded positive page", () => {
    expect(normalizeCaseHistoryPage(undefined)).toBe(1);
    expect(normalizeCaseHistoryPage("-4")).toBe(1);
    expect(normalizeCaseHistoryPage("3x")).toBe(1);
    expect(normalizeCaseHistoryPage("999999")).toBe(10_000);
  });

  it("loads one scoped message and document page without find-all queries", async () => {
    const find = vi.fn().mockResolvedValueOnce({
      docs: [
        {
          id: 501,
          subject: "Svar",
          bodyText: "Hei",
          createdAt: "2026-09-10T10:00:00Z",
        },
      ],
      hasNextPage: true,
      hasPrevPage: true,
      page: 2,
      totalDocs: 70,
      totalPages: 3,
    });
    const loadDocuments = vi.fn().mockResolvedValue({
      items: [
        {
          id: 901,
          filename: "K-42-V2.pdf",
          createdAt: "2026-09-09T10:00:00Z",
          href: "/api/admin/media/901",
        },
      ],
      hasNextPage: false,
      hasPrevPage: true,
      page: 3,
      totalDocs: 51,
      totalPages: 3,
    });

    const history = await loadCaseWorkspaceHistory(
      { find } as unknown as Payload,
      caseData,
      { documentPage: "3", messagePage: "2" },
      loadDocuments,
    );

    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: "messages",
        limit: caseHistoryPageSize,
        page: 2,
        where: { lead: { equals: 42 } },
      }),
    );
    expect(loadDocuments).toHaveBeenCalledWith(42, 3);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls.every(([query]) => query.pagination !== false)).toBe(
      true,
    );
    expect(history.messages.totalDocs).toBe(70);
    expect(history.messages.items[0]?.id).toBe(501);
    expect(history.documents.items[0]?.href).toBe("/api/admin/media/901");
  });
});
