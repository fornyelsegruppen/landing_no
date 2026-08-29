import type { CustomerQuestionReplyStage } from "@/lib/messages/customer-question-state";
import type { CustomerReplyRecoveryKind } from "@/lib/messages/customer-reply-recovery";

export type CustomerQuestionDisplayState =
  CustomerQuestionReplyStage | "source_changed";

export function customerQuestionDisplayState(
  stage: CustomerQuestionReplyStage,
  recovery?: CustomerReplyRecoveryKind | null,
): CustomerQuestionDisplayState {
  return recovery === "source_changed" ? "source_changed" : stage;
}

export function customerQuestionActionVisibility(
  stage: CustomerQuestionReplyStage,
  recovery?: CustomerReplyRecoveryKind | null,
) {
  const replacementRecoveryRequired =
    recovery === "safety_rejected" || recovery === "source_changed";

  return {
    disableAiAction: recovery === "quota_limited",
    showPrepareActions: stage === "prepare" && !replacementRecoveryRequired,
    showReplacementActions: replacementRecoveryRequired,
    showRetryAction:
      stage === "delivery_failed" && !replacementRecoveryRequired,
  };
}

export function customerReplyEditorActionVisibility(input: {
  aiAssisted: boolean;
  hasSourceContext: boolean;
  recovery?: CustomerReplyRecoveryKind | null;
}) {
  const sourceChanged = input.recovery === "source_changed";
  return {
    showDraftActions: !sourceChanged,
    showRegenerateAction:
      input.hasSourceContext && (input.aiAssisted || sourceChanged),
  };
}
