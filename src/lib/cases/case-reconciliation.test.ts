import { describe, expect, it } from "vitest";
import { deriveLegacyNextAction, isStaleDeliveryJob } from "./case-reconciliation";

const now = new Date("2026-08-25T10:00:00.000Z");

describe("safe legacy case reconciliation", () => {
  it("assigns incomplete new and quoted cases to one explicit owner and deadline", () => {
    expect(deriveLegacyNextAction({ lead: { id: 1, status: "new" }, now })).toEqual({
      nextAction: "Kontroller den nye henvendelsen.", nextActionAt: now.toISOString(), nextActionOwner: "administrator",
    });
    expect(deriveLegacyNextAction({ lead: { id: 2, status: "quoted" }, now })).toMatchObject({ nextActionOwner: "customer", nextActionAt: "2026-09-01T10:00:00.000Z" });
  });

  it("keeps a signed case actionable until a work order exists", () => {
    expect(deriveLegacyNextAction({ lead: { id: 3, status: "converted" }, contract: { id: 4, status: "signed", companySignedAt: now.toISOString() }, now })).toMatchObject({
      nextAction: "Opprett arbeidsordre og tildel en ansatt.", nextActionOwner: "administrator",
    });
  });

  it("uses the schedule as the next system deadline", () => {
    expect(deriveLegacyNextAction({ lead: { id: 5, status: "converted" }, contract: { id: 4, status: "signed", companySignedAt: now.toISOString() }, workOrder: { id: 6, status: "scheduled", scheduledAt: "2026-08-28T06:00:00.000Z" }, now })).toMatchObject({
      nextActionAt: "2026-08-28T06:00:00.000Z", nextActionOwner: "system",
    });
  });

  it("does not mutate closed or archived cases", () => {
    expect(deriveLegacyNextAction({ lead: { id: 7, status: "closed" }, now })).toBeNull();
    expect(deriveLegacyNextAction({ lead: { id: 8, status: "converted", recordState: "archived" }, now })).toBeNull();
  });

  it("prioritises an impossible work/contract state as the one blocking next action", () => {
    expect(deriveLegacyNextAction({
      lead: { id: 9, status: "converted" },
      contract: { id: 10, status: "customer_signed" },
      workOrder: { id: 11, status: "documented" },
      now,
    })).toMatchObject({ nextActionBlocker: "WORK_WITHOUT_FULLY_SIGNED_CONTRACT", nextActionOwner: "administrator" });
  });

  it("identifies only obsolete delivery jobs as safely cancellable", () => {
    expect(isStaleDeliveryJob("delivered", "pending")).toBe(true);
    expect(isStaleDeliveryJob("sent", "retry")).toBe(true);
    expect(isStaleDeliveryJob("draft", "pending")).toBe(false);
    expect(isStaleDeliveryJob("delivered", "completed")).toBe(false);
  });
});
