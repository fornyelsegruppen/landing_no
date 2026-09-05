import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { previewNonbindingDocumentBrand } from "@/lib/platform/preview-nonbinding-documents";
import {
  customerQuoteSigningCopy,
  CustomerQuoteNonbindingNotice,
} from "./customer-quote";

describe("customer quote Preview nonbinding notice", () => {
  it("renders the explicit Norwegian marker and no-obligation explanation", () => {
    const brand = previewNonbindingDocumentBrand("nb", {
      VERCEL_ENV: "preview",
      PREVIEW_E2E_NONBINDING_DOCUMENTS: "true",
    });
    expect(brand).not.toBeNull();

    const html = renderToStaticMarkup(
      createElement(CustomerQuoteNonbindingNotice, { brand: brand! }),
    );

    expect(html).toContain("[PREVIEW TEST – IKKE BINDENDE]");
    expect(html).toContain("ingen bindende bestilling");
    expect(html).toContain("betalingsplikt");
    expect(html).toContain('role="alert"');
    expect(html).toContain("border-red-400");
  });

  it("replaces contradictory signing copy without changing Production copy", () => {
    const brand = previewNonbindingDocumentBrand("nb", {
      VERCEL_ENV: "preview",
      PREVIEW_E2E_NONBINDING_DOCUMENTS: "true",
    });
    expect(brand).not.toBeNull();

    const preview = customerQuoteSigningCopy(brand!);
    expect(preview.submit).toBe("Registrer ikke-bindende testsignatur");
    expect(preview.paymentConsent).toContain("ikke oppretter en bestilling");
    expect(preview.paymentConsent).toContain("betalingsplikt");
    expect(preview.earlyStartConsent).toContain("Ingen reelt arbeid");
    expect(preview.earlyLossConsent).toContain("ingen rettslig");
    expect(preview.success).toContain("ingen bindende bestilling");

    const production = customerQuoteSigningCopy();
    expect(production.submit).toBe(
      "Bestilling med forpliktelse til å betale og signer",
    );
    expect(production.paymentConsent).toBe(
      "Jeg forstår at bestillingen medfører plikt til å betale avtalt pris.",
    );
    expect(production.earlyStartConsent).toBe(
      "Jeg ber uttrykkelig om at arbeidet kan starte før angrefristen er utløpt (valgfritt).",
    );
  });
});
