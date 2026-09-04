import { describe, expect, it } from "vitest";
import { adminNavigationHref, isAdminNavigationActive, unifiedAdminPrimaryNavigation } from "./navigation-contract";

describe("unified admin navigation contract", () => {
  it("uses one semantic destination list without the old Cases-to-Today mismatch", () => {
    const cases = unifiedAdminPrimaryNavigation.find((item) => item.key === "cases");
    expect(cases).toBeDefined();
    expect(adminNavigationHref(cases!, "preview")).toBe("/admin-v2/cases");
    expect(adminNavigationHref(cases!, "preview")).not.toBe("/admin-next-preview/today");
  });

  it("matches exact home routes and nested workspace routes", () => {
    expect(isAdminNavigationActive("/admin-v2", "/admin-v2")).toBe(true);
    expect(isAdminNavigationActive("/admin-v2/cases/42", "/admin-v2")).toBe(false);
    expect(isAdminNavigationActive("/admin-v2/cases/42", "/admin-v2/cases")).toBe(true);
  });
});
