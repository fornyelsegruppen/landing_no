import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  canSubmitCustomerContractRequest,
  customerContractRequestReceiptNotice,
  customerQuoteScrollBehavior,
  CustomerQuoteSignedNotice,
  isActiveCustomerContractRequest,
} from "./customer-quote";

describe("customer quote signed notice", () => {
  it.each([
    ["withdrawal", "Angremeldingen din er registrert"],
    [
      "change_or_cancel",
      "Forespørselen din om endring eller kansellering er registrert",
    ],
  ] as const)(
    "replaces green signature progression with a paused state for %s",
    (kind, expectedMessage) => {
      const html = renderToStaticMarkup(
        createElement(CustomerQuoteSignedNotice, {
          companySignedAt: "2026-08-29T12:00:00.000Z",
          contractRequest: { kind, status: "admin_review" },
          token: "token/with spaces",
        }),
      );

      expect(html).toContain("Videre behandling er satt på pause");
      expect(html).toContain(expectedMessage);
      expect(html).toContain('role="status"');
      expect(html).toContain("border-amber-400/40");
      expect(html).not.toContain("Kontrakten er signert av begge parter");
      expect(html).not.toContain("Signaturen din er mottatt");
      expect(html).toContain("token%2Fwith%20spaces/pdf");
    },
  );

  it("keeps the green signed progression state when no request is active", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerQuoteSignedNotice, {
        companySignedAt: "2026-08-29T12:00:00.000Z",
        token: "safe-token",
      }),
    );

    expect(html).toContain("Kontrakten er signert av begge parter");
    expect(html).toContain("border-emerald-500/40");
    expect(html).not.toContain("Videre behandling er satt på pause");
  });

  it.each([
    ["closed", "withdrawal", "Angremeldingen er behandlet"],
    ["closed", "change_or_cancel", "Forespørselen er behandlet"],
    ["do_not_contact", "change_or_cancel", "ikke å bli kontaktet"],
  ] as const)(
    "shows terminal request truth for %s",
    (status, kind, expectedMessage) => {
      const html = renderToStaticMarkup(
        createElement(CustomerQuoteSignedNotice, {
          companySignedAt: "2026-08-29T12:00:00.000Z",
          contractRequest: { kind, status },
          token: "safe-token",
        }),
      );

      expect(html).toContain("Avtalen er avsluttet");
      expect(html).toContain(expectedMessage);
      expect(html).toContain("border-danger/50");
      expect(html).not.toContain("Vi følger opp planlagt oppstart");
    },
  );

  it("shows a recovered request as an active continuing agreement", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerQuoteSignedNotice, {
        contractRequest: {
          kind: "change_or_cancel",
          status: "recovered",
        },
        token: "safe-token",
      }),
    );

    expect(html).toContain("Avtalen fortsetter");
    expect(html).toContain("registrert som aktiv");
    expect(html).not.toContain("Videre behandling er satt på pause");
  });

  it.each([
    "received",
    "admin_review",
    "alternative_requested",
    "follow_up_scheduled",
  ] as const)("locks another request while %s is active", (status) => {
    const request = { kind: "withdrawal" as const, status };

    expect(isActiveCustomerContractRequest(request)).toBe(true);
    expect(canSubmitCustomerContractRequest(request)).toBe(false);
  });

  it("allows a later request only when there is no request or the agreement recovered", () => {
    expect(canSubmitCustomerContractRequest()).toBe(true);
    expect(
      canSubmitCustomerContractRequest({
        kind: "change_or_cancel",
        status: "recovered",
      }),
    ).toBe(true);
    expect(
      canSubmitCustomerContractRequest({
        kind: "withdrawal",
        status: "closed",
      }),
    ).toBe(false);
    expect(
      canSubmitCustomerContractRequest({
        kind: "change_or_cancel",
        status: "do_not_contact",
      }),
    ).toBe(false);
  });

  it("uses instant scrolling when reduced motion is requested", () => {
    expect(customerQuoteScrollBehavior(true)).toBe("auto");
    expect(customerQuoteScrollBehavior(false)).toBe("smooth");
  });

  it("does not claim provider-confirmed email delivery after registration", () => {
    const notice = customerContractRequestReceiptNotice(
      "withdrawal",
      "ANG-17-V1",
    );

    expect(notice).toContain("ANG-17-V1");
    expect(notice).toContain("registrert for e-postutsending");
    expect(notice).not.toContain("sendt på e-post");
  });
});
