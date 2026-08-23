import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  receipt: vi.fn(),
  deliver: vi.fn(),
  enqueueAi: vi.fn(),
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
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn(async () => ({ ok: true, skipped: true })) }));
vi.mock("@/lib/monitoring", () => ({ captureException: vi.fn() }));

import { POST } from "./route";

function request() {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Kunde",
      phone: "47 73 58 88",
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
    mocks.create.mockReset().mockResolvedValue({ id: 55 });
    mocks.receipt.mockReset().mockResolvedValue({ skipped: true, reason: "no_email" });
    mocks.deliver.mockReset();
    mocks.enqueueAi.mockReset();
  });

  afterEach(() => {
    delete process.env.FEATURE_AI_DRAFTS;
  });

  it("returns success after the lead is saved even when receipt creation fails", async () => {
    mocks.receipt.mockRejectedValueOnce(new Error("email unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, id: 55 });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("keeps the saved lead when AI job enqueueing fails", async () => {
    process.env.FEATURE_AI_DRAFTS = "true";
    mocks.enqueueAi.mockRejectedValueOnce(new Error("AI queue unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueAi).toHaveBeenCalledWith(expect.anything(), 55, expect.any(String));
  });
});
