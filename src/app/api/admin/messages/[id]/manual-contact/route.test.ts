import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findByID: vi.fn(),
  issue: vi.fn(),
  recordAudit: vi.fn(),
  update: vi.fn(),
  userIsAdmin: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    findByID: mocks.findByID,
    update: mocks.update,
  })),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: mocks.userIsAdmin }));
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
    mocks.userIsAdmin.mockReset().mockReturnValue(true);
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

  it("requires an authenticated administrator", async () => {
    mocks.auth.mockResolvedValue({ user: null });

    const response = await POST(request({ action: "prepare" }), {
      params: Promise.resolve({ id: "4" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.findByID).not.toHaveBeenCalled();
  });

  it("rejects an authenticated non-admin user", async () => {
    mocks.userIsAdmin.mockReturnValue(false);

    const response = await POST(request({ action: "prepare" }), {
      params: Promise.resolve({ id: "4" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.findByID).not.toHaveBeenCalled();
  });

  it("rejects a draft or cancelled source message", async () => {
    mocks.findByID.mockReset().mockResolvedValueOnce({
      id: 4,
      lead: 2,
      direction: "outbound",
      channel: "email",
      status: "cancelled",
      aiAnalysis: {},
    });

    const response = await POST(request({ action: "prepare" }), {
      params: Promise.resolve({ id: "4" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("records a manual contact only once", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({
        id: 4,
        lead: 2,
        direction: "outbound",
        channel: "email",
        status: "attention",
        aiAnalysis: {
          manualRecovery: {
            status: "contacted",
            channel: "phone",
            contactedAt: "2026-08-28T01:00:00.000Z",
            accessRecordId: 22,
          },
        },
      })
      .mockResolvedValueOnce({ id: 2, name: "Ola Nordmann" });

    const response = await POST(
      request({ action: "record", channel: "sms" }),
      { params: Promise.resolve({ id: "4" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      duplicate: true,
      channel: "phone",
      contactedAt: "2026-08-28T01:00:00.000Z",
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
