import type { CustomerQuestionReplyStage } from "@/lib/messages/customer-question-state";
import type { CustomerReplyRecoveryKind } from "@/lib/messages/customer-reply-recovery";

export type CustomerQuestionDisplayState =
  CustomerQuestionReplyStage | "source_changed";

type CustomerQuestionLocale = "nb" | "lt" | "en";

const deliveryFailureCopy = {
  nb: {
    provider:
      "E-postleverandøren avviste eller stoppet meldingen. Kontroller mottakeradressen og leveringsloggen før du prøver igjen.",
    generic:
      "Leveringen kunne ikke fullføres. Kontroller mottakeradressen og leveringsloggen før du prøver igjen.",
  },
  lt: {
    provider:
      "El. pašto paslaugų teikėjas atmetė arba sustabdė laišką. Prieš bandydami dar kartą patikrinkite gavėjo adresą ir pristatymo žurnalą.",
    generic:
      "Pristatymo užbaigti nepavyko. Prieš bandydami dar kartą patikrinkite gavėjo adresą ir pristatymo žurnalą.",
  },
  en: {
    provider:
      "The email provider rejected or stopped the message. Check the recipient address and delivery log before trying again.",
    generic:
      "Delivery could not be completed. Check the recipient address and delivery log before trying again.",
  },
} as const;

export function customerQuestionDeliveryFailureMessage(
  locale: CustomerQuestionLocale,
  failureCode?: string | null,
) {
  const kind = failureCode?.startsWith("EMAIL_") ? "provider" : "generic";
  return deliveryFailureCopy[locale][kind];
}

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
