import { describe, expect, it } from "vitest";
import { adminNavigationLinks } from "./admin-navigation";

describe("daily admin navigation", () => {
  it("keeps every primary destination inside the custom admin workspace", () => {
    expect(adminNavigationLinks).toHaveLength(11);
    expect(adminNavigationLinks.every((link) => link.href === "/admin-v2" || link.href.startsWith("/admin-v2/"))).toBe(true);
    expect(adminNavigationLinks.map((link) => link.key)).toEqual(["overview", "leads", "contractRequests", "quotes", "contracts", "work", "documents", "archive", "blog", "employees", "settings"]);
  });
});
