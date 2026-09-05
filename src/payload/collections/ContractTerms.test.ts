import { afterEach, describe, expect, it } from "vitest";
import { protectContractTerms } from "./ContractTerms";

const adminRequest = { user: { id: 7, role: "admin", active: true } };

describe("contract terms legal approval gate", () => {
  const originalReference = process.env.LEGAL_REVIEW_REFERENCE;
  const originalVercelEnvironment = process.env.VERCEL_ENV;
  const originalNonbindingFlag = process.env.PREVIEW_E2E_NONBINDING_DOCUMENTS;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalExpectedDatabaseHost = process.env.PREVIEW_E2E_EXPECTED_DB_HOST;

  afterEach(() => {
    if (originalReference === undefined) delete process.env.LEGAL_REVIEW_REFERENCE;
    else process.env.LEGAL_REVIEW_REFERENCE = originalReference;
    if (originalVercelEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnvironment;
    if (originalNonbindingFlag === undefined) delete process.env.PREVIEW_E2E_NONBINDING_DOCUMENTS;
    else process.env.PREVIEW_E2E_NONBINDING_DOCUMENTS = originalNonbindingFlag;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalExpectedDatabaseHost === undefined) delete process.env.PREVIEW_E2E_EXPECTED_DB_HOST;
    else process.env.PREVIEW_E2E_EXPECTED_DB_HOST = originalExpectedDatabaseHost;
  });

  it("blocks approval until a legal review reference is configured", () => {
    delete process.env.LEGAL_REVIEW_REFERENCE;
    expect(() => protectContractTerms({
      operation: "create",
      data: { status: "approved" },
      req: adminRequest,
    } as never)).toThrow(/LEGAL_REVIEW_REFERENCE/);
  });

  it("records the legal review and approver when terms are approved", () => {
    process.env.LEGAL_REVIEW_REFERENCE = "lawyer-review-2026-08";
    const result = protectContractTerms({
      operation: "update",
      data: { status: "approved" },
      originalDoc: { status: "draft" },
      req: adminRequest,
    } as never) as Record<string, unknown>;
    expect(result).toMatchObject({
      status: "approved",
      legalReviewReference: "lawyer-review-2026-08",
      approvedBy: 7,
    });
    expect(result.approvedAt).toEqual(expect.any(String));
  });

  it("records the fixed nonbinding reference only for explicit Preview E2E", () => {
    delete process.env.LEGAL_REVIEW_REFERENCE;
    process.env.VERCEL_ENV = "preview";
    process.env.PREVIEW_E2E_NONBINDING_DOCUMENTS = "true";
    process.env.PREVIEW_E2E_EXPECTED_DB_HOST =
      "ep-ancient-band-aujp1u5u-pooler.example.test";
    process.env.DATABASE_URL =
      "postgresql://redacted@ep-ancient-band-aujp1u5u-pooler.example.test/redacted";
    const result = protectContractTerms({
      operation: "update",
      data: { status: "approved" },
      originalDoc: { status: "draft" },
      req: adminRequest,
    } as never) as Record<string, unknown>;
    expect(result.legalReviewReference).toBe("PREVIEW-E2E-NONBINDING-V1");
  });

  it("keeps approved legal text immutable", () => {
    expect(() => protectContractTerms({
      operation: "update",
      data: { contractText: "changed" },
      originalDoc: { status: "approved", contractText: "locked" },
      req: adminRequest,
    } as never)).toThrow(/immutable/);
  });
});
