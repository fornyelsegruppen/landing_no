import { describe, expect, it, vi } from "vitest";
import { Users } from "./Users";
import { WorkOrders } from "./WorkOrders";
import { Messages } from "./Messages";
import { deleteLeadMessagesBeforeLead } from "./Leads";

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

  it("keeps message delivery state system-managed even for admins", async () => {
    const status = Messages.fields.find((field) => "name" in field && field.name === "status");
    if (!status || !("access" in status)) throw new Error("Message status field is missing");
    expect(await status.access?.update?.(request({ id: 1, role: "admin", active: true }))).toBe(false);
  });

  it("removes lead messages before privacy deletion of the lead", async () => {
    const remove = vi.fn().mockResolvedValue({ docs: [] });
    const find = vi.fn().mockResolvedValue({ docs: [] });
    const update = vi.fn().mockResolvedValue({ docs: [] });
    await deleteLeadMessagesBeforeLead({ id: 7, req: { payload: { delete: remove, find, update } } } as never);
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({
      collection: "messages",
      overrideAccess: true,
      where: { lead: { equals: 7 } },
    }));
  });

  it("blocks privacy deletion when the lead has a signed contract", async () => {
    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [{ id: 11 }] })
      .mockResolvedValueOnce({ docs: [{ id: 12, status: "signed" }] });
    const remove = vi.fn();
    await expect(deleteLeadMessagesBeforeLead({
      id: 7,
      req: { payload: { delete: remove, find, update: vi.fn() } },
    } as never)).rejects.toThrow(/signed contract/);
    expect(remove).not.toHaveBeenCalled();
  });
});
