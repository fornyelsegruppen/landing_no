import { describe, expect, it } from "vitest";
import {
  assertPreviewEmailRecipientsAllowed,
  previewEmailRecipientAllowlist,
  PreviewEmailRecipientBlockedError,
  previewEmailSubject,
} from "./preview-email-recipient-policy";

const previewEnvironment = {
  VERCEL_ENV: "preview",
  PREVIEW_EMAIL_RECIPIENT_ALLOWLIST: " fornyelsegruppen@gmail.com ",
};

describe("Preview exact-recipient email policy", () => {
  it("normalizes the owner-controlled address", () => {
    expect([...previewEmailRecipientAllowlist(previewEnvironment)]).toEqual([
      "fornyelsegruppen@gmail.com",
    ]);
  });

  it("allows only the exact address across to, cc and bcc", () => {
    expect(() =>
      assertPreviewEmailRecipientsAllowed(
        {
          to: "Fornyelsegruppen <fornyelsegruppen@gmail.com>",
          cc: ["fornyelsegruppen@gmail.com"],
          bcc: "FORNYELSEGRUPPEN@gmail.com",
        },
        previewEnvironment,
      ),
    ).not.toThrow();

    expect(() =>
      assertPreviewEmailRecipientsAllowed(
        {
          to: "fornyelsegruppen@gmail.com",
          cc: "other@example.no",
        },
        previewEnvironment,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PreviewEmailRecipientBlockedError>>({
        reason: "recipient_not_allowed",
      }),
    );

    expect(() =>
      assertPreviewEmailRecipientsAllowed(
        {
          to: "fornyelsegruppen@gmail.com",
          bcc: "not-an-email",
        },
        previewEnvironment,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PreviewEmailRecipientBlockedError>>({
        reason: "recipient_invalid",
      }),
    );

    expect(() =>
      assertPreviewEmailRecipientsAllowed(
        {
          to: "fornyelsegruppen@gmail.com",
          cc: [{ name: "Missing address" }],
        },
        previewEnvironment,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PreviewEmailRecipientBlockedError>>({
        reason: "recipient_invalid",
      }),
    );
  });

  it("fails closed when Preview has no allowlist", () => {
    expect(() =>
      assertPreviewEmailRecipientsAllowed(
        { to: "fornyelsegruppen@gmail.com" },
        { VERCEL_ENV: "preview" },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PreviewEmailRecipientBlockedError>>({
        reason: "allowlist_missing",
      }),
    );
  });

  it("adds idempotent Preview branding and leaves Production unchanged", () => {
    expect(previewEmailSubject("Tilbud TF-9", previewEnvironment)).toBe(
      "[PREVIEW TEST] Tilbud TF-9",
    );
    expect(
      previewEmailSubject("[PREVIEW TEST] Tilbud TF-9", previewEnvironment),
    ).toBe("[PREVIEW TEST] Tilbud TF-9");
    expect(
      previewEmailSubject("Tilbud TF-9", { VERCEL_ENV: "production" }),
    ).toBe("Tilbud TF-9");
  });
});
