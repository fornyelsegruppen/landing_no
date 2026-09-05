import { describe, expect, it, vi } from "vitest";
import type { EmailAdapter } from "payload";
import { withPreviewEmailPolicy } from "./preview-payload-email-adapter";

describe("Payload Preview email policy adapter", () => {
  it("checks to/cc/bcc and brands Payload-owned email", async () => {
    const sendEmail = vi.fn(async () => ({ id: "payload-email-1" }));
    const base: EmailAdapter<{ id: string }> = () => ({
      name: "test",
      defaultFromAddress: "post@takfornyelse.as",
      defaultFromName: "Takfornyelse",
      sendEmail,
    });
    const adapter = withPreviewEmailPolicy(base, {
      VERCEL_ENV: "preview",
      PREVIEW_EMAIL_RECIPIENT_ALLOWLIST: "fornyelsegruppen@gmail.com",
    })({ payload: {} as never });

    await adapter.sendEmail({
      to: { address: "fornyelsegruppen@gmail.com", name: "Owner test" },
      cc: ["fornyelsegruppen@gmail.com"],
      subject: "Reset test password",
      text: "Test",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "[PREVIEW TEST] Reset test password",
      }),
    );

    await expect(
      adapter.sendEmail({
        to: "fornyelsegruppen@gmail.com",
        bcc: "other@example.no",
        subject: "Blocked",
      }),
    ).rejects.toMatchObject({ reason: "recipient_not_allowed" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
