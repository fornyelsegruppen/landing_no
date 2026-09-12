export const initialCaseMessageHistoryLimit = 5;

export type CaseMessageHistoryLocale = "nb" | "lt" | "en";

const knownProviderFailureCodes = new Set([
  "EMAIL_BOUNCED",
  "EMAIL_COMPLAINED",
  "EMAIL_FAILED",
  "EMAIL_HARD_BOUNCE",
  "EMAIL_DELIVERY_DELAYED",
  "EMAIL_SUPPRESSED",
]);

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

/**
 * Returns administrator-safe copy for a message-history delivery failure.
 * Provider failure text is deliberately not accepted: it may contain raw
 * provider details and is never suitable for ordinary UI display.
 */
export function caseMessageHistoryDeliveryFailureMessage(
  locale: CaseMessageHistoryLocale,
  failureCode?: string | null,
) {
  const kind = failureCode && knownProviderFailureCodes.has(failureCode)
    ? "provider"
    : "generic";
  return deliveryFailureCopy[locale][kind];
}

export function splitCaseMessageHistory<T extends { id: string | number }>(
  messages: readonly T[],
  excludedMessageId?: T["id"],
) {
  const visibleMessages = messages.filter(
    (message) => message.id !== excludedMessageId,
  );

  return {
    older: visibleMessages.slice(initialCaseMessageHistoryLimit),
    recent: visibleMessages.slice(0, initialCaseMessageHistoryLimit),
  };
}
