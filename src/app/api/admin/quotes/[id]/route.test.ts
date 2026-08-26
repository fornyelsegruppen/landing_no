import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class StaleCommercialContextError extends TypeError {
    currentReference?: string;
    constructor(message: string, currentReference?: string) {
      super(message);
      this.currentReference = currentReference;
    }
  }
  return {
    auth: vi.fn(),
    assertCurrent: vi.fn(),
    assertHash: vi.fn(),
    findByID: vi.fn(),
    issue: vi.fn(),
    recordAudit: vi.fn(),
    StaleCommercialContextError,
  };
});

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    findByID: mocks.findByID,
  })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
vi.mock("@/lib/admin-v2/commercial-action-guard", () => ({
  assertCurrentQuoteTarget: mocks.assertCurrent,
  assertExpectedDocumentHash: mocks.assertHash,
  StaleCommercialContextError: mocks.StaleCommercialContextError,
}));
vi.mock("@/lib/platform/features", () => ({
  assertFeatureReady: vi.fn(),
  FeatureUnavailableError: class FeatureUnavailableError extends Error {},
}));
vi.mock("@/lib/quotes/issue", () => ({
  issueQuoteCustomerLink: mocks.issue,
  revokeIssuedQuote: vi.fn(),
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({ createPayloadAuditWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.recordAudit }));

import { POST } from "./route";

describe("admin quote action version guard", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.findByID.mockReset().mockResolvedValue({
      id: 12,
      lead: 15,
      reference: "T-15-V2",
      snapshotHash: "a".repeat(64),
      status: "approved",
    });
    mocks.assertCurrent.mockReset().mockResolvedValue(undefined);
    mocks.assertHash.mockReset().mockReturnValue(undefined);
    mocks.issue.mockReset().mockResolvedValue({ message: { id: 44 }, url: "https://example.test/offer" });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
  });

  it("passes the expected version and hash before issuing the quote", async () => {
    const response = await POST(new Request("http://localhost/api/admin/quotes/12", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue", expectedVersion: 2, expectedDocumentHash: "a".repeat(64) }),
    }), { params: Promise.resolve({ id: "12" }) });

    expect(response.status).toBe(200);
    expect(mocks.assertCurrent).toHaveBeenCalledWith(expect.anything(), { leadId: 15, quoteId: 12, expectedVersion: 2 });
    expect(mocks.assertHash).toHaveBeenCalledWith(expect.objectContaining({ expectedDocumentHash: "a".repeat(64), currentReference: "T-15-V2" }));
  });

  it("returns a clear 409 when another tab already replaced the quote", async () => {
    mocks.assertCurrent.mockRejectedValueOnce(new mocks.StaleCommercialContextError("Refresh", "T-15-V3"));
    const response = await POST(new Request("http://localhost/api/admin/quotes/12", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue", expectedVersion: 2 }),
    }), { params: Promise.resolve({ id: "12" }) });
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result).toMatchObject({ code: "STALE_COMMERCIAL_CONTEXT", currentReference: "T-15-V3" });
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
