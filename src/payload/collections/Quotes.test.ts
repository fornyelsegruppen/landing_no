import { describe, expect, it } from "vitest";
import { protectQuoteVersion } from "./Quotes";
import { protectContractVersion } from "./Contracts";

describe("quote and contract version protection", () => {
  it("hashes a new quote snapshot", () => {
    const result = protectQuoteVersion({ operation: "create", data: { status: "draft", snapshot: { amount: 100 } } } as never) as Record<string, unknown>;
    expect(result.snapshotHash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
  });
  it("requires a new version after quote approval", () => {
    expect(() => protectQuoteVersion({ operation: "update", data: { snapshot: { amount: 200 } }, originalDoc: { status: "approved", snapshot: { amount: 100 } } } as never)).toThrow(/new version/);
  });
  it("makes a signed contract immutable", () => {
    expect(() => protectContractVersion({ operation: "update", data: { status: "revoked" }, originalDoc: { status: "signed" } } as never)).toThrow();
  });
  it("allows supplier counter-signature fields when Payload also returns unchanged contract fields", () => {
    const originalDoc = {
      status: "signed",
      reference: "K-6-V1",
      snapshot: { customer: "Test" },
      documentHash: "a".repeat(64),
      companySignedAt: null,
    };
    const result = protectContractVersion({
      operation: "update",
      originalDoc,
      data: {
        ...originalDoc,
        companySignatureEvidence: { signerName: "Administrator" },
        companySignedAt: "2026-08-25T10:00:00.000Z",
        companySignedBy: 9,
      },
    } as never);
    expect(result).toMatchObject({ companySignedBy: 9 });
  });
  it("accepts a new draft contract even when Payload supplies an empty original document", () => {
    expect(protectContractVersion({ operation: "create", data: { status: "draft" }, originalDoc: {} } as never)).toEqual({ status: "draft" });
  });
});
