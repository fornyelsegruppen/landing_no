export type PreviewNonbindingDocumentLocale = "en" | "lt" | "nb";

export const PREVIEW_E2E_NONBINDING_TERMS_REFERENCE =
  "PREVIEW-E2E-NONBINDING-V1" as const;

type Environment = Readonly<Record<string, string | undefined>>;

export type PreviewNonbindingDocumentBrand = {
  description: string;
  emailSubjectPrefix: string;
  marker: string;
  signingNotice: string;
};

const copy: Record<
  PreviewNonbindingDocumentLocale,
  PreviewNonbindingDocumentBrand
> = {
  nb: {
    marker: "[PREVIEW TEST – IKKE BINDENDE]",
    emailSubjectPrefix: "[PREVIEW TEST] [IKKE BINDENDE]",
    description:
      "Dette er et isolert testdokument. Det oppretter ingen bindende bestilling, betalingsplikt eller kommersiell avtale.",
    signingNotice:
      "En testsignatur brukes bare til å kontrollere arbeidsflyten og er ikke en bindende bestilling.",
  },
  lt: {
    marker: "[PREVIEW TESTAS – NEĮPAREIGOJA]",
    emailSubjectPrefix: "[PREVIEW TEST] [NEĮPAREIGOJA]",
    description:
      "Tai izoliuotas testinis dokumentas. Jis nesukuria privalomo užsakymo, mokėjimo prievolės ar komercinės sutarties.",
    signingNotice:
      "Testinis parašas naudojamas tik darbo eigai patikrinti ir nėra privalomas užsakymas.",
  },
  en: {
    marker: "[PREVIEW TEST – NOT BINDING]",
    emailSubjectPrefix: "[PREVIEW TEST] [NOT BINDING]",
    description:
      "This is an isolated test document. It creates no binding order, payment obligation, or commercial agreement.",
    signingNotice:
      "A test signature is used only to verify the workflow and is not a binding order.",
  },
};

export function previewE2ENonbindingDocumentsEnabled(
  environment: Environment = process.env,
) {
  return (
    environment.VERCEL_ENV === "preview" &&
    environment.PREVIEW_E2E_NONBINDING_DOCUMENTS === "true"
  );
}

export function previewNonbindingDocumentBrand(
  locale: PreviewNonbindingDocumentLocale = "nb",
  environment: Environment = process.env,
): PreviewNonbindingDocumentBrand | null {
  return previewE2ENonbindingDocumentsEnabled(environment)
    ? copy[locale]
    : null;
}

export function brandPreviewNonbindingEmail(
  input: { bodyText: string; subject: string },
  locale: PreviewNonbindingDocumentLocale = "nb",
  environment: Environment = process.env,
) {
  const brand = previewNonbindingDocumentBrand(locale, environment);
  if (!brand) return input;
  return {
    subject: input.subject.startsWith(brand.emailSubjectPrefix)
      ? input.subject
      : `${brand.emailSubjectPrefix} ${input.subject}`,
    bodyText: input.bodyText.startsWith(brand.marker)
      ? input.bodyText
      : `${brand.marker}\n${brand.description}\n\n${input.bodyText}`,
  };
}
