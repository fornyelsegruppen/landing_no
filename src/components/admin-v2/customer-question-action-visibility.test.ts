import { describe, expect, it } from "vitest";
import {
  customerQuestionActionVisibility,
  customerReplyEditorActionVisibility,
} from "./customer-question-action-visibility";

describe("customer question action visibility", () => {
  it.each(["safety_rejected", "source_changed"] as const)(
    "shows only replacement actions after %s while preparing",
    (recovery) => {
      expect(customerQuestionActionVisibility("prepare", recovery)).toEqual({
        disableAiAction: false,
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
        disableAiAction: false,
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
        disableAiAction: false,
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
        disableAiAction: false,
        showPrepareActions: false,
        showReplacementActions: false,
        showRetryAction: true,
      });
    },
  );

  it("keeps manual preparation available while disabling AI after a quota failure", () => {
    expect(
      customerQuestionActionVisibility("prepare", "quota_limited"),
    ).toEqual({
      disableAiAction: true,
      showPrepareActions: true,
      showReplacementActions: false,
      showRetryAction: false,
    });
  });
});

describe("customer reply editor action visibility", () => {
  it("leaves regeneration as the only primary editor action after a source change", () => {
    expect(
      customerReplyEditorActionVisibility({
        aiAssisted: false,
        hasSourceContext: true,
        recovery: "source_changed",
      }),
    ).toEqual({
      showDraftActions: false,
      showRegenerateAction: true,
    });
  });

  it("keeps manual correction actions available after a safety rejection", () => {
    expect(
      customerReplyEditorActionVisibility({
        aiAssisted: true,
        hasSourceContext: true,
        recovery: "safety_rejected",
      }),
    ).toEqual({
      showDraftActions: true,
      showRegenerateAction: true,
    });
  });
});
