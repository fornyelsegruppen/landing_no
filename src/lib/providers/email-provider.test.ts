import { describe, expect, it } from "vitest";
import { createEmailProvider } from "./email-provider";

describe("createEmailProvider", () => {
  it("uses the safe log provider only for an explicitly enabled preview", () => {
    expect(createEmailProvider({ VERCEL_ENV: "preview", ALLOW_PREVIEW_EMAIL_LOG: "true" }).health()).toEqual({
      status: "ready",
      provider: "log-email",
    });
  });

  it("never enables log delivery in production", () => {
    expect(createEmailProvider({ VERCEL_ENV: "production", ALLOW_PREVIEW_EMAIL_LOG: "true" }).health()).toMatchObject({
      status: "configuration_required",
      provider: "resend",
    });
  });
});
