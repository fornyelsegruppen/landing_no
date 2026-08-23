import { describe, expect, it } from "vitest";
import { createOpaqueToken, verifyOpaqueToken } from "@/lib/security/opaque-token";
import { resolveQuoteAccessToken } from "./customer-access";

describe("customer quote access policy", () => {
  it("accepts only the matching unexpired and unrevoked token", () => {
    const now = new Date("2026-08-23T12:00:00Z");
    const created = createOpaqueToken({ purpose: "quote-customer-access", ttlMs: 60_000, now, random: () => Buffer.alloc(32, 7) });
    expect(verifyOpaqueToken(created.plainText, created.stored, now)).toBe(true);
    expect(verifyOpaqueToken("wrong-token", created.stored, now)).toBe(false);
    expect(verifyOpaqueToken(created.plainText, created.stored, new Date("2026-08-23T12:01:01Z"))).toBe(false);
    expect(verifyOpaqueToken(created.plainText, { ...created.stored, revokedAt: now.toISOString() }, now)).toBe(false);
  });

  it("resolves only the quote relationship recorded with the token hash", async () => {
    const now = new Date("2026-08-23T12:00:00Z");
    const created = createOpaqueToken({ purpose: "quote-customer-access", ttlMs: 60_000, now, random: () => Buffer.alloc(32, 8) });
    const payload = { find: async () => ({ docs: [{ id: 9, ...created.stored, subjectType: "quote", subjectId: "42", singleUse: false }] }) };
    await expect(resolveQuoteAccessToken(payload as never, created.plainText, now)).resolves.toMatchObject({ quoteId: 42 });
    await expect(resolveQuoteAccessToken(payload as never, "wrong".repeat(10), now)).resolves.toBeNull();
  });
});
