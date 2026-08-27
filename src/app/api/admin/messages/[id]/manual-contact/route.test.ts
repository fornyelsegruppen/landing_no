import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  issue: vi.fn(),
  recordAudit: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    findByID: mocks.findByID,
    update: mocks.update,
  })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/audit/audit-event", () => ({
  recordAuditEvent: mocks.recordAudit,
}));
vi.mock("@/lib/manual-contact/recovery", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/manual-contact/recovery")>();
  return { ...actual, issueManualContactRecoveryToken: mocks.issue };
});

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request(
    "https://www.takfornyelse.as/api/admin/messages/4/manual-contact",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("admin manual contact recovery", () => {
  beforeEach(() => {
    mocks.auth
      .mockReset()
      .mockResolvedValue({ user: { id: 9, role: "admin" } });
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({
        id: 4,
        lead: 2,
        direction: "outbound",
        channel: "email",
        status: "attention",
        subject: "Tilbud",
        aiAnalysis: {},
      })
      .mockResolvedValueOnce({ id: 2, name: "Ola Nordmann" });
    mocks.issue.mockReset().mockResolvedValue({
      token: "s".repeat(43),
      record: { id: 22, expiresAt: "2026-09-03T10:00:00.000Z" },
    });
    mocks.update.mockReset().mockResolvedValue({ id: 4 });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
  });

  it("creates a concise secure message without worker details", async () => {
    const response = await POST(request({ action: "prepare" }), {
      params: Promise.resolve({ id: "4" }),
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.manualText).toContain("Hei Ola");
    expect(result.manualText).toContain("/kontakt/");
    expect(result.manualText.length).toBeLessThanOrEqual(160);
    expect(result.manualText).not.toMatch(/arbeider|ansatt|worker/i);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "messages",
        data: expect.objectContaining({ status: "attention" }),
      }),
    );
  });
});
