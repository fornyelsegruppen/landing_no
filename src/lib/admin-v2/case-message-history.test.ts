import { describe, expect, it } from "vitest";
import {
  caseMessageHistoryDeliveryFailureMessage,
  initialCaseMessageHistoryLimit,
  splitCaseMessageHistory,
} from "./case-message-history";

describe("caseMessageHistoryDeliveryFailureMessage", () => {
  it("localizes known provider failures in each supported locale", () => {
    expect(
      caseMessageHistoryDeliveryFailureMessage("lt", "EMAIL_BOUNCED"),
    ).toBe(
      "El. pašto paslaugų teikėjas atmetė arba sustabdė laišką. Prieš bandydami dar kartą patikrinkite gavėjo adresą ir pristatymo žurnalą.",
    );
    expect(
      caseMessageHistoryDeliveryFailureMessage("nb", "EMAIL_SUPPRESSED"),
    ).toBe(
      "E-postleverandøren avviste eller stoppet meldingen. Kontroller mottakeradressen og leveringsloggen før du prøver igjen.",
    );
    expect(
      caseMessageHistoryDeliveryFailureMessage("en", "EMAIL_FAILED"),
    ).toBe(
      "The email provider rejected or stopped the message. Check the recipient address and delivery log before trying again.",
    );
  });

  it("uses generic localized copy for unknown codes and never returns provider text", () => {
    const rawProviderFailure = "Resend secret and internal recipient details";

    expect(
      caseMessageHistoryDeliveryFailureMessage("lt", "UNKNOWN_FAILURE"),
    ).toBe(
      "Pristatymo užbaigti nepavyko. Prieš bandydami dar kartą patikrinkite gavėjo adresą ir pristatymo žurnalą.",
    );
    expect(
      caseMessageHistoryDeliveryFailureMessage("nb", "EMAIL_UNKNOWN"),
    ).not.toContain(rawProviderFailure);
    expect(
      caseMessageHistoryDeliveryFailureMessage(
        "en",
        "UNRECOGNIZED_PROVIDER_CODE",
      ),
    ).toBe(
      "Delivery could not be completed. Check the recipient address and delivery log before trying again.",
    );
  });
});

describe("splitCaseMessageHistory", () => {
  it("keeps the five newest loaded messages visible and groups older messages separately", () => {
    const messages = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
    }));

    expect(initialCaseMessageHistoryLimit).toBe(5);
    expect(splitCaseMessageHistory(messages)).toEqual({
      recent: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      older: [{ id: 6 }, { id: 7 }],
    });
  });

  it("omits the reply already displayed by the primary question workbench", () => {
    const messages = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
    }));

    expect(splitCaseMessageHistory(messages, 2)).toEqual({
      recent: [{ id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
      older: [],
    });
  });
});
