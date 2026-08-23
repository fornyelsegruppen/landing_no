import { describe, expect, it } from "vitest";
import {
  assignedWorkerOrAdmin,
  getUserRole,
  userIsActive,
  userIsAdmin,
  userIsWorker,
} from "./roles";

function requestUser(value: Record<string, unknown> | null) {
  return value as never;
}

describe("internal role access", () => {
  it("denies unknown and legacy roles by default", () => {
    const legacy = requestUser({ id: 1, role: "editor", active: true });
    expect(getUserRole(legacy)).toBeNull();
    expect(userIsAdmin(legacy)).toBe(false);
    expect(userIsWorker(legacy)).toBe(false);
  });

  it("requires an active account for either role", () => {
    const inactiveAdmin = requestUser({ id: 1, role: "admin", active: false });
    const activeWorker = requestUser({ id: 2, role: "worker", active: true });

    expect(userIsActive(inactiveAdmin)).toBe(false);
    expect(userIsAdmin(inactiveAdmin)).toBe(false);
    expect(userIsWorker(activeWorker)).toBe(true);
  });

  it("limits a worker query to their assigned documents", () => {
    const result = assignedWorkerOrAdmin({
      req: { user: requestUser({ id: 42, role: "worker", active: true }) },
    } as never);

    expect(result).toEqual({ assignedWorker: { equals: 42 } });
  });

  it("allows an active administrator across assignments", () => {
    const result = assignedWorkerOrAdmin({
      req: { user: requestUser({ id: 1, role: "admin", active: true }) },
    } as never);

    expect(result).toBe(true);
  });
});
