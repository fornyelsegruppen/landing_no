import {
  PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
  previewE2ENonbindingDocumentsEnabled,
} from "./preview-nonbinding-documents";

type Environment = Readonly<Record<string, string | undefined>>;

export const PREVIEW_E2E_ISOLATED_DB_FINGERPRINT =
  "ancient-band-aujp1u5u";

export type ContractTermsApproval = {
  provider: "approved-contract-terms" | "preview-nonbinding-test-terms";
  reference: string;
};

export function resolveContractTermsApproval(
  environment: Environment = process.env,
): ContractTermsApproval | null {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const expectedHost = environment.PREVIEW_E2E_EXPECTED_DB_HOST?.trim();
  let isolatedPreviewDatabase = false;
  if (databaseUrl && expectedHost) {
    try {
      const actualHost = new URL(databaseUrl).hostname;
      isolatedPreviewDatabase =
        actualHost === expectedHost &&
        actualHost.includes(PREVIEW_E2E_ISOLATED_DB_FINGERPRINT);
    } catch {
      isolatedPreviewDatabase = false;
    }
  }
  if (previewE2ENonbindingDocumentsEnabled(environment)) {
    return isolatedPreviewDatabase
      ? {
          provider: "preview-nonbinding-test-terms",
          reference: PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
        }
      : null;
  }
  const reference = environment.LEGAL_REVIEW_REFERENCE?.trim();
  return reference
    ? { provider: "approved-contract-terms", reference }
    : null;
}
