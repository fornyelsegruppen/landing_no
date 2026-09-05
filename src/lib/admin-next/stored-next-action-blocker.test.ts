import { describe, expect, it } from "vitest";
import { projectStoredNextActionBlocker } from "./stored-next-action-blocker";

describe("stored next-action blocker bridge", () => {
  it("accepts a known blocker only with its exact canonical action target", () => {
    expect(
      projectStoredNextActionBlocker({
        actionKind: "retry_message",
        actionTargetId: 31,
        storedBlocker: "MESSAGE_DELIVERY_FAILED",
      }),
    ).toEqual({ status: "mapped", code: "MESSAGE_DELIVERY_FAILED" });

    expect(
      projectStoredNextActionBlocker({
        actionKind: "generate_reply",
        storedBlocker: "MESSAGE_DELIVERY_FAILED",
      }),
    ).toEqual({ status: "diagnostic", code: "MESSAGE_DELIVERY_FAILED" });
  });

  it.each([
    "WORK_WITHOUT_FULLY_SIGNED_CONTRACT",
    "WORK_CANCELLED",
    "MESSAGE_DELIVERY_PENDING",
    "ADDRESS_REQUIRED",
  ])("keeps %s diagnostic until a canonical mapping is approved", (code) => {
    expect(
      projectStoredNextActionBlocker({
        actionKind: "generate_reply",
        storedBlocker: code,
      }),
    ).toEqual({ status: "diagnostic", code });
  });

  it("does not expose free-form or PII-like stored blocker text", () => {
    expect(
      projectStoredNextActionBlocker({
        actionKind: "generate_reply",
        storedBlocker: "customer@example.invalid needs review",
      }),
    ).toEqual({
      status: "diagnostic",
      code: "UNMAPPED_LEGACY_BLOCKER",
    });
  });
});
