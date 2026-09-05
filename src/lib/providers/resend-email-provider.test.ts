import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { ResendEmailProvider } from "./resend-email-provider";

describe("ResendEmailProvider", () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  it("sends the signed document as an attachment with an idempotency key", async () => {
    const provider = new ResendEmailProvider({
      NODE_ENV: "test",
      RESEND_API_KEY: "test-key",
      LEAD_FROM_EMAIL: "post@takfornyelse.as",
    });
    await provider.send({
      template: "contract-signed",
      to: "kunde@example.test",
      subject: "Signert avtale",
      text: "Avtalen er vedlagt.",
      idempotencyKey: "contract-signed:12",
      correlationId: "quote-12",
      attachments: [{
        filename: "avtale.pdf",
        contentType: "application/pdf",
        contentBase64: "JVBERi0xLjQ=",
      }],
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "kunde@example.test",
      attachments: [{
        filename: "avtale.pdf",
        contentType: "application/pdf",
        content: "JVBERi0xLjQ=",
      }],
    }), { idempotencyKey: "contract-signed:12" });
  });

  it("brands and restricts a real Preview send to the exact allowlist", async () => {
    const provider = new ResendEmailProvider({
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      RESEND_API_KEY: "test-key",
      LEAD_FROM_EMAIL: "post@takfornyelse.as",
      PREVIEW_EMAIL_RECIPIENT_ALLOWLIST: "fornyelsegruppen@gmail.com",
    });

    await provider.send({
      template: "quote",
      to: "fornyelsegruppen@gmail.com",
      subject: "Tilbud TF-9",
      text: "Test",
      idempotencyKey: "preview-quote:9",
      correlationId: "preview-quote-9",
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "fornyelsegruppen@gmail.com",
        subject: "[PREVIEW TEST] Tilbud TF-9",
      }),
      { idempotencyKey: "preview-quote:9" },
    );

    await expect(
      provider.send({
        template: "quote",
        to: "other@example.no",
        subject: "Tilbud TF-10",
        text: "Test",
        idempotencyKey: "preview-quote:10",
        correlationId: "preview-quote-10",
      }),
    ).rejects.toMatchObject({ reason: "recipient_not_allowed" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
