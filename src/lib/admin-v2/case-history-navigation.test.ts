import { describe, expect, it } from "vitest";
import {
  createCaseHistoryNavigationGate,
  resolveCaseHistoryNavigation,
  type CaseHistoryNavigationContext,
} from "./case-history-navigation";
import { caseHistoryPageHref } from "@/components/admin-v2/case-history-pagination";

function context(
  messagePage?: string,
  documentPage?: string,
): CaseHistoryNavigationContext {
  return {
    caseId: 1,
    messages: {
      requested: messagePage,
      page: Number(messagePage ?? 1),
      totalPages: 6,
      ids: messagePage === "6" ? [1] : [126, 125],
    },
    documents: {
      requested: documentPage,
      page: Number(documentPage ?? 1),
      totalPages: 31,
    },
  };
}
const location = (path: string) => new URL(path, "http://localhost:3217");

describe("validated case history navigation", () => {
  it("rejects mismatched record hashes; dual valid queries require an explicit target", () => {
    const input = context();
    input.documents.invoiceId = 126;
    input.selectedRecords = { invoiceRequested: "1", invoiceId: 1 };
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?invoiceRecord=1#invoice-126"),
      ),
    ).toBeNull();
    input.selectedRecords = {
      invoiceRequested: "1",
      invoiceId: 1,
      warrantyRequested: "2",
      warrantyId: 2,
    };
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?invoiceRecord=1&warrantyRecord=2"),
      ),
    ).toBeNull();
    expect(
      resolveCaseHistoryNavigation(
        input,
        location(
          "/admin-v2/cases/1?invoiceRecord=1&warrantyRecord=2#warranty-2",
        ),
      )?.targetId,
    ).toBe("warranty-2");
  });

  it("preserves selected metadata across the existing document pager", () => {
    const href = caseHistoryPageHref(
      "/admin-v2/cases/1",
      { documentPage: "2", invoiceRecord: "1", warrantyRecord: "2" },
      "documentPage",
      3,
    );
    const input = context(undefined, "3");
    input.selectedRecords = {
      invoiceRequested: "1",
      invoiceId: 1,
      warrantyRequested: "2",
      warrantyId: 2,
    };
    expect(href).toContain("invoiceRecord=1");
    expect(href).toContain("warrantyRecord=2");
    expect(resolveCaseHistoryNavigation(input, location(href))).toEqual({
      section: "documents",
      targetId: "documents-section",
    });
  });
  it("opens an exact server-validated historical invoice/warranty rather than current", () => {
    const input = context();
    input.documents.totalPages = 0; // A case can have metadata but no PDF files.
    input.documents.invoiceId = 126;
    input.documents.warrantyId = 126;
    input.selectedRecords = { invoiceRequested: "1", invoiceId: 1 };
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?invoiceRecord=1#invoice-1"),
      ),
    ).toEqual({ section: "documents", targetId: "invoice-1" });
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?invoiceRecord=1"),
      )?.targetId,
    ).toBe("invoice-1");
    input.selectedRecords = { warrantyRequested: "2", warrantyId: 2 };
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?warrantyRecord=2#warranty-2"),
      )?.targetId,
    ).toBe("warranty-2");
  });

  it("does not open latest record when the historical query is invalid, foreign, stale or duplicated", () => {
    const input = context();
    input.documents.invoiceId = 126;
    input.selectedRecords = { invoiceRequested: "201" };
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?invoiceRecord=201#invoice-126"),
      ),
    ).toBeNull();
    input.selectedRecords = { invoiceRequested: "1", invoiceId: 1 };
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?invoiceRecord=2#invoice-2"),
      ),
    ).toBeNull();
    expect(
      resolveCaseHistoryNavigation(
        input,
        location("/admin-v2/cases/1?invoiceRecord=1&invoiceRecord=1#invoice-1"),
      ),
    ).toBeNull();
    expect(
      resolveCaseHistoryNavigation(
        context(),
        location("/admin-v2/cases/1?invoiceRecord=01#invoice-1"),
      ),
    ).toBeNull();
  });
  it("activates canonical invoice/warranty links only for rendered case-owned targets", () => {
    const input = context();
    input.documents.invoiceId = 31;
    input.documents.warrantyId = 126;
    for (const id of ["invoice-31", "warranty-126"]) {
      expect(
        resolveCaseHistoryNavigation(
          input,
          location(`/admin-v2/cases/1#${id}`),
        ),
      ).toEqual({ section: "documents", targetId: id });
    }
    for (const id of [
      "invoice-32",
      "warranty-125",
      "invoice-031",
      "warranty-0",
    ]) {
      expect(
        resolveCaseHistoryNavigation(
          input,
          location(`/admin-v2/cases/1#${id}`),
        ),
      ).toBeNull();
    }
    expect(
      resolveCaseHistoryNavigation(
        context(),
        location("/admin-v2/cases/1#invoice-31"),
      ),
    ).toBeNull();
  });
  it("opens an exact old message in the current server page, including reload", () => {
    const target = { section: "messages", targetId: "message-1" };
    const url = location("/admin-v2/cases/1?messagePage=6#message-1");
    expect(createCaseHistoryNavigationGate()(context("6"), url)).toEqual(
      target,
    );
    expect(createCaseHistoryNavigationGate()(context("6"), url)).toEqual(
      target,
    );
  });

  it("opens the deep document page without requiring a fragment", () => {
    expect(
      resolveCaseHistoryNavigation(
        context(undefined, "31"),
        location("/admin-v2/cases/1?documentPage=31"),
      ),
    ).toEqual({ section: "documents", targetId: "documents-section" });
  });

  it("lets the pager's explicit section select context when both page params exist", () => {
    const params = { messagePage: "6", documentPage: "31" };
    const href = caseHistoryPageHref(
      "/admin-v2/cases/1",
      params,
      "messagePage",
      5,
    );
    expect(
      resolveCaseHistoryNavigation(context("5", "31"), location(href)),
    ).toEqual({ section: "messages", targetId: "messages-section" });
    const docHref = caseHistoryPageHref(
      "/admin-v2/cases/1",
      params,
      "documentPage",
      30,
    );
    expect(
      resolveCaseHistoryNavigation(context("6", "30"), location(docHref)),
    ).toEqual({ section: "documents", targetId: "documents-section" });
  });

  it("supports the existing first-page pager which removes its page parameter", () => {
    for (const key of ["messagePage", "documentPage"] as const) {
      const href = caseHistoryPageHref(
        "/admin-v2/cases/1",
        { [key]: "2" },
        key,
        1,
      );
      expect(
        resolveCaseHistoryNavigation(context(), location(href))?.section,
      ).toBe(key === "messagePage" ? "messages" : "documents");
    }
  });

  it("keeps a normal case and an ambiguous dual-page request closed", () => {
    expect(
      resolveCaseHistoryNavigation(context(), location("/admin-v2/cases/1")),
    ).toBeNull();
    expect(
      resolveCaseHistoryNavigation(
        context("6", "31"),
        location("/admin-v2/cases/1?messagePage=6&documentPage=31"),
      ),
    ).toBeNull();
  });

  it.each(["0", "-1", "01", "1.5", "1e0", "abc", "", "9007199254740993", "32"])(
    "rejects invalid/out-of-range page %j rather than opening clamped data",
    (value) => {
      const input = context(undefined, value);
      input.documents.page = 1;
      expect(
        resolveCaseHistoryNavigation(
          input,
          location(`/admin-v2/cases/1?documentPage=${value}`),
        ),
      ).toBeNull();
    },
  );

  it("rejects repeated page params and stale server context", () => {
    expect(
      resolveCaseHistoryNavigation(
        context("6"),
        location("/admin-v2/cases/1?messagePage=6&messagePage=6#message-1"),
      ),
    ).toBeNull();
    const repeated = context("6");
    repeated.messages.requested = ["6", "6"];
    expect(
      resolveCaseHistoryNavigation(
        repeated,
        location("/admin-v2/cases/1?messagePage=6#message-1"),
      ),
    ).toBeNull();
    expect(
      resolveCaseHistoryNavigation(
        context(),
        location("/admin-v2/cases/1?messagePage=6#message-1"),
      ),
    ).toBeNull();
  });

  it.each([
    "#message-2",
    "#message-01",
    "#message-9007199254740993",
    "#document-756",
    "#unknown",
    "#%E0%A4%A",
  ])("does not open an absent or unsupported target %s", (hash) => {
    expect(
      resolveCaseHistoryNavigation(
        context("6"),
        location(`/admin-v2/cases/1?messagePage=6${hash}`),
      ),
    ).toBeNull();
  });

  it("requires matching case ownership and decodes a valid fragment", () => {
    expect(
      resolveCaseHistoryNavigation(
        context("6"),
        location("/admin-v2/cases/26?messagePage=6#message-1"),
      ),
    ).toBeNull();
    expect(
      resolveCaseHistoryNavigation(
        context("6"),
        location("/admin-v2/cases/1?messagePage=6#message%2D1"),
      )?.targetId,
    ).toBe("message-1");
  });

  it("consumes once so rerender, manual selection and close stay in control", () => {
    const consume = createCaseHistoryNavigationGate();
    const url = location("/admin-v2/cases/1?documentPage=31");
    expect(consume(context(undefined, "31"), url)?.section).toBe("documents");
    expect(consume(context(undefined, "31"), url)).toBeNull();
    expect(consume(context(undefined, "31"), url)).toBeNull();
  });

  it("waits for fresh server data after popstate and accepts return navigation", () => {
    const consume = createCaseHistoryNavigationGate();
    const url = location("/admin-v2/cases/1?messagePage=6#message-1");
    expect(consume(context(), url)).toBeNull();
    expect(consume(context("6"), url)?.targetId).toBe("message-1");
    expect(consume(context(), location("/admin-v2/cases/1"))).toBeNull();
    expect(consume(context("6"), url)?.targetId).toBe("message-1");
  });
});
