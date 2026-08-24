import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  apply: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify: mocks.verify };
  },
}));
vi.mock("@/lib/payload", () => ({ getPayload: vi.fn(async () => ({ marker: "payload" })) }));
vi.mock("@/lib/messages/resend-webhook", () => ({ applyResendWebhookEvent: mocks.apply }));
vi.mock("@/lib/monitoring", () => ({ captureException: vi.fn() }));

import { POST } from "./route";

function request(headers = true) {
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers: headers ? {
      "svix-id": "msg_test",
      "svix-timestamp": "1787600000",
      "svix-signature": "v1,test",
    } : undefined,
    body: JSON.stringify({ type: "email.delivered" }),
  });
}

describe("Resend webhook route", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    mocks.verify.mockReset().mockReturnValue({ type: "email.delivered", data: { email_id: "email_1" } });
    mocks.apply.mockReset().mockResolvedValue({ matched: true, messageId: 1 });
  });

  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it("verifies the raw signed body before applying a delivery event", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({
      webhookSecret: "whsec_test",
      headers: { id: "msg_test", timestamp: "1787600000", signature: "v1,test" },
    }));
    expect(mocks.apply).toHaveBeenCalledTimes(1);
  });

  it("rejects missing signature headers", async () => {
    const response = await POST(request(false));
    expect(response.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("fails closed when the signing secret is absent", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
