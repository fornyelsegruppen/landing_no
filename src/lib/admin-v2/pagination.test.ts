import { describe, expect, it } from "vitest";
import { adminListPageHref, adminListPaginationMeta, parseAdminListPage } from "./pagination";

describe("admin list pagination", () => {
  it("preserves filters while changing only the page", () => {
    expect(adminListPageHref("/admin-v2/cases", { q: "Ola Nordmann", status: "open", action: "all", page: "1" }, 2))
      .toBe("/admin-v2/cases?q=Ola+Nordmann&status=open&action=all&page=2");
    expect(adminListPageHref("/admin-v2/cases", { q: "Ola Nordmann", status: "open", page: "2" }, 1))
      .toBe("/admin-v2/cases?q=Ola+Nordmann&status=open");
  });

  it("normalizes invalid pages and exposes bounded navigation metadata", () => {
    expect(parseAdminListPage(["0", "3"])).toBe(1);
    expect(parseAdminListPage("4")).toBe(4);
    expect(adminListPaginationMeta(51, { page: 2, limit: 25 })).toEqual({
      hasNextPage: true,
      hasPrevPage: true,
      page: 2,
      totalDocs: 51,
      totalPages: 3,
    });
  });
});
