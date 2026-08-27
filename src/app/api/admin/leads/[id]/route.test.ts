import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  markLeadReviewed: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    findByID: mocks.findByID,
  })),
}));
vi.mock("@/payload/access/roles", () => ({
  userIsAdmin: vi.fn(() => true),
}));
vi.mock("@/lib/admin-v2/mark-lead-reviewed", () => ({
  markLeadReviewed: mocks.markLeadReviewed,
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/audit/audit-event", () => ({
  recordAuditEvent: mocks.recordAudit,
}));

import { POST } from "./route";

function request() {
  return new Request("http://localhost/api/admin/leads/10", {
    body: JSON.stringify({ action: "mark_reviewed" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("admin lead review marker", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({
      user: { id: 3, role: "admin" },
    });
    mocks.findByID.mockReset().mockResolvedValue({
      adminReviewedAt: null,
      caseRevision: 12,
      id: 10,
    });
    mocks.markLeadReviewed.mockReset().mockResolvedValue({
      duplicate: false,
      reviewedAt: "2026-08-28T00:00:00.000Z",
    });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
  });

  it("routes the automatic marker through the idempotent case command", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(response).toBeDefined();
    if (!response) throw new Error("Expected a review marker response");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      duplicate: false,
      ok: true,
      reviewedAt: "2026-08-28T00:00:00.000Z",
    });
    expect(mocks.markLeadReviewed).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ actorId: 3, leadId: 10 }),
    );
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
