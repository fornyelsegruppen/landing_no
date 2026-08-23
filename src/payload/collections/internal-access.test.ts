import { describe, expect, it } from "vitest";
import { Users } from "./Users";
import { WorkOrders } from "./WorkOrders";

const request = (user: Record<string, unknown> | null) =>
  ({ req: { user } }) as never;

describe("internal collection access", () => {
  it("rejects a worker from the Payload admin and employee management", async () => {
    const worker = request({ id: 7, role: "worker", active: true });

    expect(await Users.access?.admin?.(worker)).toBe(false);
    expect(await Users.access?.read?.(worker)).toBe(false);
  });

  it("applies the assignment filter to worker REST reads", async () => {
    const worker = request({ id: 7, role: "worker", active: true });

    expect(await WorkOrders.access?.read?.(worker)).toEqual({
      assignedWorker: { equals: 7 },
    });
    expect(await WorkOrders.access?.update?.(worker)).toBe(false);
  });

  it("rejects every internal surface for a deactivated user", async () => {
    const inactive = request({ id: 7, role: "admin", active: false });

    expect(await Users.access?.admin?.(inactive)).toBe(false);
    expect(await WorkOrders.access?.read?.(inactive)).toBe(false);
  });
});
