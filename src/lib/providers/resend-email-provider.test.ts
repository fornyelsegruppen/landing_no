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
});
