import { describe, expect, it } from "vitest";
import { canViewPrivateMedia, mediaIsPrivate } from "./privacy";

describe("media privacy policy", () => {
  it("keeps website content public and operational files private", () => {
    expect(mediaIsPrivate("public-content")).toBe(false);
    expect(mediaIsPrivate("customer")).toBe(true);
    expect(mediaIsPrivate("contract")).toBe(true);
  });

  it("allows admins, assigned workers and valid customer grants", () => {
    expect(canViewPrivateMedia({ role: "admin" })).toBe(true);
    expect(
      canViewPrivateMedia({ role: "worker", userId: 2, assignedWorkerId: 2 }),
    ).toBe(true);
    expect(canViewPrivateMedia({ role: null, validCustomerGrant: true })).toBe(
      true,
    );
  });

  it("denies unassigned and anonymous access", () => {
    expect(
      canViewPrivateMedia({ role: "worker", userId: 2, assignedWorkerId: 3 }),
    ).toBe(false);
    expect(canViewPrivateMedia({ role: null })).toBe(false);
  });
});
