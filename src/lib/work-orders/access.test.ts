import { describe, expect, it, vi } from "vitest";
import { appendTimeline, loadAuthorizedWorkOrder } from "./access";

describe("work-order assignment access", () => {
  it("returns the order only to its assigned active worker", async () => {
    const payload = { findByID: vi.fn().mockResolvedValue({ id: 9, assignedWorker: 2 }) };
    await expect(loadAuthorizedWorkOrder(payload as never, 9, { id: 2, role: "worker", active: true } as never)).resolves.toMatchObject({ id: 9 });
    await expect(loadAuthorizedWorkOrder(payload as never, 9, { id: 3, role: "worker", active: true } as never)).resolves.toBeNull();
    await expect(loadAuthorizedWorkOrder(payload as never, 9, { id: 2, role: "worker", active: false } as never)).resolves.toBeNull();
  });

  it("keeps a bounded, data-minimized timeline", () => {
    const previous = Array.from({ length: 120 }, (_, index) => ({ action: `a-${index}` }));
    const timeline = appendTimeline(previous, { action: "start", actorId: 2, changedFields: ["status", "status"], at: "2026-08-23T00:00:00Z" });
    expect(timeline).toHaveLength(100);
    expect(timeline.at(-1)).toEqual({ action: "start", actorId: 2, changedFields: ["status"], at: "2026-08-23T00:00:00Z" });
  });
});
