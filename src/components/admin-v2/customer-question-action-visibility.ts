import type { CustomerQuestionReplyStage } from "@/lib/messages/customer-question-state";
import type { CustomerReplyRecoveryKind } from "@/lib/messages/customer-reply-recovery";

export function customerQuestionActionVisibility(
  stage: CustomerQuestionReplyStage,
  recovery?: CustomerReplyRecoveryKind | null,
) {
  const replacementRecoveryRequired =
    recovery === "safety_rejected" || recovery === "source_changed";

  return {
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
