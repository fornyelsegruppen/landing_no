import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  receipt: vi.fn(),
  deliver: vi.fn(),
  enqueueAi: vi.fn(),
  verifyTurnstile: vi.fn(),
  resendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.resendSend };
  },
}));
vi.mock("@/lib/lead-pdf", () => ({
  buildLeadPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  leadPdfFilename: vi.fn(() => "henvendelse-test.pdf"),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({ create: mocks.create })),
}));
vi.mock("@/lib/messages/message-engine", () => ({
  createReceiptMessage: mocks.receipt,
  deliverMessage: mocks.deliver,
  enqueueLeadAiJob: mocks.enqueueAi,
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "127.0.0.1",
  rateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}));
vi.mock("@/lib/monitoring", () => ({ captureException: vi.fn() }));

import { POST } from "./route";

function request(email?: string) {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Kunde",
      phone: "47 73 58 88",
      ...(email ? { email } : {}),
      postal: "1182",
      type: "takvask",
      locale: "no",
      consent: true,
      consentText: "Jeg godtar at henvendelsen behandles.",
    }),
  });
}

describe("public lead durability", () => {
  beforeEach(() => {
    process.env.PAYLOAD_SECRET = "test-secret-at-least-32-characters-long";
    delete process.env.RESEND_API_KEY;
    delete process.env.LEAD_TO_EMAIL;
    delete process.env.LEAD_ADMIN_COPY_EMAIL;
    delete process.env.FEATURE_AI_DRAFTS;
    mocks.create.mockReset().mockResolvedValue({ id: 55 });
    mocks.receipt
      .mockReset()
      .mockResolvedValue({ skipped: true, reason: "no_email" });
    mocks.deliver.mockReset();
    mocks.enqueueAi.mockReset();
    mocks.verifyTurnstile.mockReset().mockResolvedValue({
      ok: true,
      skipped: true,
    });
    mocks.resendSend.mockReset().mockResolvedValue({
      data: { id: "admin-email-1" },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.FEATURE_AI_DRAFTS;
    delete process.env.RESEND_API_KEY;
    delete process.env.LEAD_TO_EMAIL;
    delete process.env.LEAD_ADMIN_COPY_EMAIL;
  });

  it("returns success after the lead is saved even when receipt creation fails", async () => {
    mocks.receipt.mockRejectedValueOnce(new Error("email unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, id: 55 });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "leads",
        data: expect.objectContaining({
          nextAction: expect.stringContaining("Ring kunden"),
        }),
      }),
    );
  });

  it("keeps the saved lead when AI job enqueueing fails", async () => {
    process.env.FEATURE_AI_DRAFTS = "true";
    mocks.enqueueAi.mockRejectedValueOnce(new Error("AI queue unavailable"));
    const response = await POST(request("kunde@example.test"));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueAi).toHaveBeenCalledWith(
      expect.anything(),
      55,
      expect.any(String),
    );
  });

  it("rejects a consumed Turnstile token before creating a lead", async () => {
    mocks.verifyTurnstile.mockResolvedValueOnce({
      ok: false,
      skipped: false,
      errorCodes: ["timeout-or-duplicate"],
    });

    const response = await POST(request("kunde@example.test"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Captcha failed" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.receipt).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.enqueueAi).not.toHaveBeenCalled();
  });

  it("sends one idempotent admin notification to the new inbox and old safety copy", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.LEAD_TO_EMAIL = "post@takfornyelsenorge.no";
    process.env.LEAD_ADMIN_COPY_EMAIL = "post@takfornyelse.as";

    const response = await POST(request("kunde@example.test"));

    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.resendSend).toHaveBeenCalledTimes(1);
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["post@takfornyelsenorge.no", "post@takfornyelse.as"],
        replyTo: "kunde@example.test",
      }),
      { idempotencyKey: "lead-admin-intake-55" },
    );
  });
});
