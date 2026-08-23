import { afterEach, describe, expect, it } from "vitest";
import { protectContractTerms } from "./ContractTerms";

const adminRequest = { user: { id: 7, role: "admin", active: true } };

describe("contract terms legal approval gate", () => {
  const originalReference = process.env.LEGAL_REVIEW_REFERENCE;

  afterEach(() => {
    if (originalReference === undefined) delete process.env.LEGAL_REVIEW_REFERENCE;
    else process.env.LEGAL_REVIEW_REFERENCE = originalReference;
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

  it("keeps approved legal text immutable", () => {
    expect(() => protectContractTerms({
      operation: "update",
      data: { contractText: "changed" },
      originalDoc: { status: "approved", contractText: "locked" },
      req: adminRequest,
    } as never)).toThrow(/immutable/);
  });
});
