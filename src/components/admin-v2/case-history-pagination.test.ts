import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CaseHistoryPagination,
  caseHistoryPageHref,
} from "./case-history-pagination";

describe("case history pagination", () => {
  it("preserves the other history page while changing only its own page", () => {
    expect(
      caseHistoryPageHref(
        "/admin-v2/cases/42",
        { documentPage: "3", messagePage: "2" },
        "messagePage",
        3,
      ),
    ).toBe("/admin-v2/cases/42?documentPage=3&messagePage=3#messages-section");
    expect(
      caseHistoryPageHref(
        "/admin-v2/cases/42",
        { documentPage: "3", messagePage: "2" },
        "messagePage",
        1,
      ),
    ).toBe("/admin-v2/cases/42?documentPage=3#messages-section");
  });

  it("renders keyboard links, counts and localized older/newer labels", () => {
    const html = renderToStaticMarkup(
      createElement(CaseHistoryPagination, {
        basePath: "/admin-v2/cases/42",
        locale: "lt",
        pageData: {
          hasNextPage: true,
          hasPrevPage: true,
          items: [1],
          page: 2,
          totalDocs: 52,
          totalPages: 3,
        },
        pageKey: "messagePage",
        params: { documentPage: "2", messagePage: "2" },
      }),
    );
    expect(html).toContain("Naujesni");
    expect(html).toContain("Senesni");
    expect(html).toContain("2 iš 3 · Iš viso: 52");
    expect(html).toContain(
      'href="/admin-v2/cases/42?documentPage=2#messages-section"',
    );
    expect(html).toContain("documentPage=2&amp;messagePage=3#messages-section");
  });
});
