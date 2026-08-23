import { describe, expect, it } from "vitest";
import {
  assertUserMayLogin,
  assertAnotherAdminRemains,
  removesActiveAdmin,
  revokeSessionsWhenDeactivated,
  roleForNewAccount,
} from "./lifecycle";

describe("user lifecycle", () => {
  it("revokes every session when an account is deactivated", () => {
    expect(
      revokeSessionsWhenDeactivated({
        active: false,
        sessions: [{ id: "session" }],
      }),
    ).toEqual({ active: false, sessions: [] });
  });

  it("blocks inactive and unclassified legacy accounts from login", () => {
    expect(() => assertUserMayLogin({ active: false })).toThrow();
    expect(() => assertUserMayLogin({})).toThrow();
    expect(() => assertUserMayLogin({ active: true })).not.toThrow();
  });

  it("creates the first account as admin and later accounts as workers by default", () => {
    expect(roleForNewAccount({ existingUsers: 0, requestedRole: "worker" })).toBe(
      "admin",
    );
    expect(roleForNewAccount({ existingUsers: 1 })).toBe("worker");
    expect(roleForNewAccount({ existingUsers: 1, requestedRole: "admin" })).toBe(
      "admin",
    );
  });

  it("prevents the last active administrator from being removed", () => {
    expect(
      removesActiveAdmin(
        { role: "admin", active: true },
        { role: "admin", active: false },
      ),
    ).toBe(true);
    expect(() => assertAnotherAdminRemains(0)).toThrow();
    expect(() => assertAnotherAdminRemains(1)).not.toThrow();
  });
});
