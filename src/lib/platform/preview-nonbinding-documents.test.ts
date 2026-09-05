import { describe, expect, it } from "vitest";
import {
  brandPreviewNonbindingEmail,
  PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
  previewE2ENonbindingDocumentsEnabled,
  previewNonbindingDocumentBrand,
} from "./preview-nonbinding-documents";

const enabledPreview = {
  VERCEL_ENV: "preview",
  PREVIEW_E2E_NONBINDING_DOCUMENTS: "true",
};

describe("Preview nonbinding document branding", () => {
  it("exports one fixed synthetic nonbinding terms reference", () => {
    expect(PREVIEW_E2E_NONBINDING_TERMS_REFERENCE).toBe(
      "PREVIEW-E2E-NONBINDING-V1",
    );
  });

  it("requires both Preview and the explicit opt-in flag", () => {
    expect(previewE2ENonbindingDocumentsEnabled(enabledPreview)).toBe(true);
    expect(
      previewE2ENonbindingDocumentsEnabled({
        ...enabledPreview,
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
    expect(
      previewE2ENonbindingDocumentsEnabled({ VERCEL_ENV: "preview" }),
    ).toBe(false);
    expect(
      previewE2ENonbindingDocumentsEnabled({
        ...enabledPreview,
        PREVIEW_E2E_NONBINDING_DOCUMENTS: "TRUE",
      }),
    ).toBe(false);
  });

  it("provides explicit localized no-order and no-payment language", () => {
    expect(previewNonbindingDocumentBrand("nb", enabledPreview)).toMatchObject({
      marker: "[PREVIEW TEST – IKKE BINDENDE]",
      description: expect.stringContaining("ingen bindende bestilling"),
      signingNotice: expect.stringContaining("testsignatur"),
    });
    expect(previewNonbindingDocumentBrand("lt", enabledPreview)).toMatchObject({
      marker: "[PREVIEW TESTAS – NEĮPAREIGOJA]",
      description: expect.stringContaining("mokėjimo prievolės"),
    });
    expect(previewNonbindingDocumentBrand("en", enabledPreview)).toMatchObject({
      marker: "[PREVIEW TEST – NOT BINDING]",
      description: expect.stringContaining("no binding order"),
    });
  });

  it("brands email text idempotently and never brands Production", () => {
    const input = { subject: "Tilbud T-1-V1", bodyText: "Hei kunde" };
    const once = brandPreviewNonbindingEmail(input, "nb", enabledPreview);
    const twice = brandPreviewNonbindingEmail(once, "nb", enabledPreview);

    expect(once.subject).toBe("[PREVIEW TEST] [IKKE BINDENDE] Tilbud T-1-V1");
    expect(once.bodyText).toContain(
      "[PREVIEW TEST – IKKE BINDENDE]\nDette er et isolert testdokument.",
    );
    expect(twice).toEqual(once);
    expect(
      brandPreviewNonbindingEmail(input, "nb", {
        ...enabledPreview,
        VERCEL_ENV: "production",
      }),
    ).toBe(input);
  });
});
