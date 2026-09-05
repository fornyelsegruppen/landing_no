import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  receipt: vi.fn(),
  deliver: vi.fn(),
  enqueueAi: vi.fn(),
  resendSend: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.resendSend };
  },
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
    delete process.env.FEATURE_AI_DRAFTS;
    delete process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST;
    delete process.env.LEAD_TO_EMAIL;
    mocks.create.mockReset().mockResolvedValue({ id: 55 });
    mocks.receipt
      .mockReset()
      .mockResolvedValue({ skipped: true, reason: "no_email" });
    mocks.deliver.mockReset();
    mocks.enqueueAi.mockReset();
    mocks.resendSend
      .mockReset()
      .mockResolvedValue({ data: { id: "preview-intake-1" }, error: null });
    mocks.verifyTurnstile.mockReset().mockResolvedValue({
      ok: true,
      skipped: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.FEATURE_AI_DRAFTS;
    delete process.env.RESEND_API_KEY;
    delete process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST;
    delete process.env.LEAD_TO_EMAIL;
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

  it("restricts and brands the Preview intake notification", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    process.env.RESEND_API_KEY = "preview-resend-key";
    process.env.PREVIEW_EMAIL_RECIPIENT_ALLOWLIST =
      "fornyelsegruppen@gmail.com";
    process.env.LEAD_TO_EMAIL = "fornyelsegruppen@gmail.com";

    const allowed = await POST(request("fornyelsegruppen@gmail.com"));
    expect(allowed.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "fornyelsegruppen@gmail.com",
        subject: expect.stringMatching(/^\[PREVIEW TEST\] /u),
      }),
    );

    mocks.resendSend.mockClear();
    process.env.LEAD_TO_EMAIL = "other@example.no";
    const blocked = await POST(request("fornyelsegruppen@gmail.com"));
    expect(blocked.status).toBe(200);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });
});
