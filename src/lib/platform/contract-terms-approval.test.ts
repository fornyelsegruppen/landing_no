import { describe, expect, it } from "vitest";
import { PREVIEW_E2E_NONBINDING_TERMS_REFERENCE } from "./preview-nonbinding-documents";
import {
  PREVIEW_E2E_ISOLATED_DB_FINGERPRINT,
  resolveContractTermsApproval,
} from "./contract-terms-approval";

const isolatedHost =
  `ep-${PREVIEW_E2E_ISOLATED_DB_FINGERPRINT}-pooler.eu-central-1.aws.neon.tech`;

describe("contract terms approval source", () => {
  it("uses the explicit nonbinding reference only in opted-in Preview", () => {
    expect(
      resolveContractTermsApproval({
        VERCEL_ENV: "preview",
        PREVIEW_E2E_NONBINDING_DOCUMENTS: "true",
        PREVIEW_E2E_EXPECTED_DB_HOST: isolatedHost,
        DATABASE_URL: `postgresql://redacted@${isolatedHost}/redacted`,
      }),
    ).toEqual({
      provider: "preview-nonbinding-test-terms",
      reference: PREVIEW_E2E_NONBINDING_TERMS_REFERENCE,
    });
    expect(
      resolveContractTermsApproval({
        VERCEL_ENV: "production",
        PREVIEW_E2E_NONBINDING_DOCUMENTS: "true",
        PREVIEW_E2E_EXPECTED_DB_HOST: isolatedHost,
        DATABASE_URL: `postgresql://redacted@${isolatedHost}/redacted`,
      }),
    ).toBeNull();
    expect(
      resolveContractTermsApproval({
        VERCEL_ENV: "preview",
        PREVIEW_E2E_NONBINDING_DOCUMENTS: "true",
        LEGAL_REVIEW_REFERENCE: "REAL-REFERENCE-MUST-NOT-FALL-BACK",
      }),
    ).toBeNull();
  });

  it("keeps the normal legal-review path unchanged", () => {
    expect(
      resolveContractTermsApproval({ LEGAL_REVIEW_REFERENCE: "LEGAL-42" }),
    ).toEqual({
      provider: "approved-contract-terms",
      reference: "LEGAL-42",
    });
  });
});
