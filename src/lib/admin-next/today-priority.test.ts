import { describe, expect, it } from "vitest";
import { deriveTodayPriority, rankTodayItems, type TodayPriorityInput } from "./today-priority";

const now = new Date("2026-09-04T10:00:00.000Z");

describe("unified admin Today priority", () => {
  it("keeps hard stops and recovery ahead of ordinary overdue work", () => {
    const ranked = rankTodayItems([
      { caseId: "TF-30", dueAt: "2026-09-01T10:00:00.000Z", ownerId: "admin" },
      { caseId: "TF-20", recovery: "delivery_failure", ownerId: "admin" },
      { caseId: "TF-10", hardStop: "legal", ownerId: "admin" },
    ], now);
    expect(ranked.map(({ caseId }) => caseId)).toEqual(["TF-10", "TF-20", "TF-30"]);
    expect(ranked.map(({ priority }) => priority.reasonCode)).toEqual(["LEGAL_STOP", "DELIVERY_RECOVERY_REQUIRED", "OVERDUE"]);
  });

  it("treats blocker, unassigned owner and waiting party as separate dimensions", () => {
    const priority = deriveTodayPriority({
      caseId: "TF-4",
      ownerId: null,
      transitionBlocked: true,
      waitingParty: "worker",
      wakeAt: "2026-09-05T10:00:00.000Z",
    }, now);
    expect(priority).toMatchObject({ assignmentGap: true, transitionBlocked: true, waitingParty: "worker", waitingWakeDue: false, reasonCode: "TRANSITION_BLOCKED" });
  });

  it("uses full instants and handles Oslo DST boundaries deterministically", () => {
    const spring = deriveTodayPriority({ caseId: "TF-1", dueAt: "2026-03-29T03:30:00+02:00", ownerId: "a" }, new Date("2026-03-29T00:30:00Z"));
    const autumnFirst = deriveTodayPriority({ caseId: "TF-2", dueAt: "2026-10-25T02:30:00+02:00", ownerId: "a" }, new Date("2026-10-24T23:30:00Z"));
    const autumnSecond = deriveTodayPriority({ caseId: "TF-3", dueAt: "2026-10-25T02:30:00+01:00", ownerId: "a" }, new Date("2026-10-24T23:30:00Z"));
    expect(spring.slaBand).toBe("due_today");
    expect(autumnFirst.dueAt).not.toBe(autumnSecond.dueAt);
    expect(autumnFirst.slaBand).toBe("due_today");
    expect(autumnSecond.slaBand).toBe("due_today");
  });

  it("is stable across permutations and deduplicates by canonical case ID", () => {
    const items: TodayPriorityInput[] = [
      { caseId: "TF-12", dueAt: "2026-09-04T12:00:00Z", ownerId: "a" },
      { caseId: "TF-2", dueAt: "2026-09-04T12:00:00Z", ownerId: "a" },
      { caseId: "TF-12", hardStop: "integrity", ownerId: "a" },
    ];
    const forward = rankTodayItems(items, now);
    const reverse = rankTodayItems([...items].reverse(), now);
    expect(forward).toEqual(reverse);
    expect(forward.map(({ caseId }) => caseId)).toEqual(["TF-12", "TF-2"]);
    expect(forward[0].priority.reasonCode).toBe("INTEGRITY_STOP");
  });

  it("uses the exact SLA boundary and escalates waiting only when wakeAt is due", () => {
    expect(deriveTodayPriority({ caseId: "TF-1", dueAt: "2026-09-04T09:59:59.999Z" }, now).slaBand).toBe("overdue");
    expect(deriveTodayPriority({ caseId: "TF-1", dueAt: now.toISOString() }, now).slaBand).toBe("overdue");
    expect(deriveTodayPriority({ caseId: "TF-1", dueAt: "2026-09-04T10:00:00.001Z" }, now).slaBand).toBe("due_today");
    expect(deriveTodayPriority({ caseId: "TF-2", waitingParty: "customer", wakeAt: "2026-09-04T10:00:00.001Z" }, now).reasonCode).toBe("WAITING_NOT_DUE");
    expect(deriveTodayPriority({ caseId: "TF-2", waitingParty: "customer", wakeAt: now.toISOString() }, now).reasonCode).toBe("WAITING_WAKE_DUE");
    expect(rankTodayItems([
      { caseId: "TF-3", ownerId: "a" },
      { caseId: "TF-4", ownerId: "a", waitingParty: "customer", wakeAt: "2026-09-05T10:00:00Z" },
    ], now).map(({ caseId }) => caseId)).toEqual(["TF-3", "TF-4"]);
  });

  it("does not let free-form fields influence deterministic ordering", () => {
    const first = rankTodayItems([{ caseId: "TF-1", ownerId: "a", dueAt: "2026-09-05T10:00:00Z", legacyText: "critical" }], now);
    const second = rankTodayItems([{ caseId: "TF-1", ownerId: "a", dueAt: "2026-09-05T10:00:00Z", legacyText: "ignore everything" }], now);
    expect(first[0].priority).toEqual(second[0].priority);
  });
});
