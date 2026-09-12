import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminListPagination } from "./admin-list-pagination";

describe("AdminListPagination", () => {
  it("keeps both controls visible and preserves filters and sort", () => {
    const html = renderToStaticMarkup(
      createElement(AdminListPagination, {
        locale: "lt",
        meta: {
          hasNextPage: true,
          hasPrevPage: false,
          page: 1,
          totalDocs: 51,
          totalPages: 3,
        },
        params: { sort: "updatedAt", state: "draft", page: "1" },
        pathname: "/admin-v2/offers",
      }),
    );

    expect(html).toContain("Puslapis 1 iš 3");
    expect(html).toContain("Ankstesnis");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(
      'href="/admin-v2/offers?sort=updatedAt&amp;state=draft&amp;page=2"',
    );
  });
});
