import { describe, expect, it } from "vitest";
import { evaluateCaseInvariants } from "./case-invariants";

describe("case invariants", () => {
  const healthy = {
    lead: { id: 1, status: "converted", recordState: "active", nextAction: "Work is scheduled", nextActionAt: "2026-08-27T06:00:00Z", nextActionOwner: "system" },
    quote: { id: 2, status: "accepted", snapshot: { measurementHash: "same", measurementVersion: 1 } },
    contract: { id: 3, status: "signed", companySignedAt: "2026-08-25T10:00:00Z", snapshot: { measurementHash: "same", measurementVersion: 1 } },
    workOrder: { id: 4, status: "scheduled", assignedWorker: 9, scheduledAt: "2026-08-27T06:00:00Z", arrivalWindow: "08:00–10:00" },
  };

  it("accepts a coherent scheduled case", () => {
    expect(evaluateCaseInvariants(healthy)).toEqual([]);
  });

  it("detects signed/work contradictions and missing next action", () => {
    const issues = evaluateCaseInvariants({ lead: { id: 1, status: "converted", recordState: "active" }, quote: { status: "viewed" }, contract: { id: 3, status: "signed" }, workOrder: { id: 4, status: "documented" } });
    expect(issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      "ACTIVE_CASE_NO_NEXT_ACTION", "ACTIVE_CASE_NO_OWNER", "ACTIVE_CASE_NO_DEADLINE", "SIGNED_CONTRACT_WITHOUT_ACCEPTED_QUOTE",
      "WORK_WITHOUT_FULLY_SIGNED_CONTRACT", "DOCUMENTED_WITHOUT_COMPLETION_REVIEW", "ACTIVE_WORK_WITHOUT_WORKER",
    ]));
  });

  it("detects quote/contract snapshot drift and stale delivery jobs", () => {
    const issues = evaluateCaseInvariants({
      ...healthy,
      quote: { ...healthy.quote, snapshot: { measurementHash: "quote", measurementVersion: 1 } },
      contract: { ...healthy.contract, snapshot: { measurementHash: "contract", measurementVersion: 2 } },
      messages: [{ id: 10, status: "delivered" }],
      deliveryJobs: [{ status: "pending", payload: { messageId: 10 } }],
    });
    expect(issues.map((item) => item.code)).toEqual(["QUOTE_CONTRACT_MEASUREMENT_MISMATCH", "FINISHED_MESSAGE_WITH_ACTIVE_DELIVERY_JOB"]);
  });
});
