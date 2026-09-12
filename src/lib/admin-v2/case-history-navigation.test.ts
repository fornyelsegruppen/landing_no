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
