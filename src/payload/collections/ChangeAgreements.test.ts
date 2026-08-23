import { describe, expect, it } from "vitest";
import { buildChangeAgreementSnapshot, changeDocumentHash } from "@/lib/change-agreements/document";
import { protectChangeAgreement } from "./ChangeAgreements";

const snapshot = buildChangeAgreementSnapshot({
  reference: "E-1-V1", workOrderId: 1, contractId: 2, contractDocumentHash: "a".repeat(64), reasonCode: "over_maximum", reasonDescription: "Kontrollmålt areal overskrider avtalt maksimum.",
  before: { areaTenths: 1000, totalIncVatOre: 1250000, maximumTotalIncVatOre: 1375000 }, after: { areaTenths: 1300, subtotalExVatOre: 1400000, vatOre: 350000, totalIncVatOre: 1750000 }, issuedAt: "2026-08-23T10:00:00Z", validUntil: "2099-09-01T10:00:00Z",
});

describe("change-agreement collection protection", () => {
  it("requires an administrator or trusted approval context", () => {
    expect(() => protectChangeAgreement({ operation: "update", data: { status: "approved" }, originalDoc: { status: "draft", snapshot, documentHash: changeDocumentHash(snapshot) }, req: { user: null }, context: {} } as never)).toThrow(/administrator/);
    const result = protectChangeAgreement({ operation: "update", data: { status: "approved" }, originalDoc: { status: "draft", snapshot, documentHash: changeDocumentHash(snapshot) }, req: { user: null }, context: { trustedChangeApproval: true } } as never) as Record<string, unknown>;
    expect(result.status).toBe("approved"); expect(result.approvedAt).toBeTruthy();
  });

  it("rejects a changed document hash and mutation after approval", () => {
    expect(() => protectChangeAgreement({ operation: "update", data: { status: "approved" }, originalDoc: { status: "draft", snapshot, documentHash: "b".repeat(64) }, req: { user: null }, context: { trustedChangeApproval: true } } as never)).toThrow(/hash/);
    expect(() => protectChangeAgreement({ operation: "update", data: { afterTotalIncVatOre: 1 }, originalDoc: { status: "sent", afterTotalIncVatOre: 1750000 }, req: { user: null }, context: {} } as never)).toThrow(/immutable/);
  });

  it("keeps accepted evidence immutable", () => {
    expect(() => protectChangeAgreement({ operation: "update", data: { status: "revoked" }, originalDoc: { status: "accepted" }, req: { user: null }, context: {} } as never)).toThrow();
  });
});
