import { describe, expect, it } from "vitest";
import {
  adminNavigationActivePrefixes,
  adminNavigationHref,
  isAdminNavigationActive,
  unifiedAdminPrimaryNavigation,
} from "./navigation-contract";

describe("unified admin navigation contract", () => {
  it("uses one semantic destination list without the old Cases-to-Today mismatch", () => {
    const cases = unifiedAdminPrimaryNavigation.find(
      (item) => item.key === "cases",
    );
    expect(cases).toBeDefined();
    expect(adminNavigationHref(cases!, "preview")).toBe("/admin-v2/cases");
    expect(adminNavigationHref(cases!, "preview")).not.toBe(
      "/admin-next-preview/today",
    );
  });

  it("uses the canonical Work Queue as the Preview Today destination", () => {
    const today = unifiedAdminPrimaryNavigation.find(
      (item) => item.key === "today",
    )!;
    const work = unifiedAdminPrimaryNavigation.find(
      (item) => item.key === "work",
    )!;

    expect(adminNavigationHref(today, "preview")).toBe(
      "/admin-next-preview/work?view=today&queue=all&limit=25",
    );
    expect(adminNavigationHref(work, "preview")).toBe("/admin-v2/work");
    expect(
      isAdminNavigationActive("/admin-next-preview/work", today, "preview"),
    ).toBe(true);
    expect(
      isAdminNavigationActive("/admin-next-preview/work", work, "preview"),
    ).toBe(false);
  });

  it("matches exact home routes and nested workspace routes", () => {
    const today = unifiedAdminPrimaryNavigation.find(
      (item) => item.key === "today",
    )!;
    const cases = unifiedAdminPrimaryNavigation.find(
      (item) => item.key === "cases",
    )!;

    expect(isAdminNavigationActive("/admin-v2", today, "canonical")).toBe(true);
    expect(
      isAdminNavigationActive("/admin-v2/cases/42", today, "canonical"),
    ).toBe(false);
    expect(
      isAdminNavigationActive("/admin-v2/cases/42", cases, "canonical"),
    ).toBe(true);
  });

  it("keeps preview and canonical active prefixes separate from link targets", () => {
    const cases = unifiedAdminPrimaryNavigation.find(
      (item) => item.key === "cases",
    )!;

    expect(adminNavigationHref(cases, "preview")).toBe("/admin-v2/cases");
    expect(adminNavigationActivePrefixes(cases, "preview")).toContain(
      "/admin-next-preview/cases",
    );
    expect(
      isAdminNavigationActive(
        "/admin-next-preview/cases/TF-1042/measurements/R4-2026-1042",
        cases,
        "preview",
      ),
    ).toBe(true);
    expect(
      isAdminNavigationActive(
        "/admin-next-preview/cases/TF-1042",
        cases,
        "canonical",
      ),
    ).toBe(false);
  });

  it("does not mark a sibling with a shared string prefix as active", () => {
    const cases = unifiedAdminPrimaryNavigation.find(
      (item) => item.key === "cases",
    )!;
    expect(
      isAdminNavigationActive("/admin-v2/cases-archive", cases, "canonical"),
    ).toBe(false);
  });
});
