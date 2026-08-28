import { describe, expect, it } from "vitest";
import { customerQuestionActionVisibility } from "./customer-question-action-visibility";

describe("customer question action visibility", () => {
  it.each(["safety_rejected", "source_changed"] as const)(
    "shows only replacement actions after %s while preparing",
    (recovery) => {
      expect(customerQuestionActionVisibility("prepare", recovery)).toEqual({
        showPrepareActions: false,
        showReplacementActions: true,
        showRetryAction: false,
      });
    },
  );

  it.each(["safety_rejected", "source_changed"] as const)(
    "replaces retry with replacement actions after %s",
    (recovery) => {
      expect(
        customerQuestionActionVisibility("delivery_failed", recovery),
      ).toEqual({
        showPrepareActions: false,
        showReplacementActions: true,
        showRetryAction: false,
      });
    },
  );

  it.each([undefined, "refresh", "ai_unavailable"] as const)(
    "keeps the ordinary prepare actions for %s",
    (recovery) => {
      expect(customerQuestionActionVisibility("prepare", recovery)).toEqual({
        showPrepareActions: true,
        showReplacementActions: false,
        showRetryAction: false,
      });
    },
  );

  it.each([undefined, "refresh", "ai_unavailable"] as const)(
    "keeps the ordinary retry action for %s",
    (recovery) => {
      expect(
        customerQuestionActionVisibility("delivery_failed", recovery),
      ).toEqual({
        showPrepareActions: false,
        showReplacementActions: false,
        showRetryAction: true,
      });
    },
  );
});
