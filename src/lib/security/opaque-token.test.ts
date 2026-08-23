import { describe, expect, it } from "vitest";
import {
  createOpaqueToken,
  hashOpaqueToken,
  verifyOpaqueToken,
} from "./opaque-token";

const now = new Date("2026-08-23T12:00:00.000Z");
const deterministicRandom = () => Buffer.alloc(32, 7);

describe("opaque customer tokens", () => {
  it("stores only a purpose-bound hash", () => {
    const token = createOpaqueToken({
      purpose: "quote",
      ttlMs: 60_000,
      now,
      random: deterministicRandom,
    });

    expect(token.stored.tokenHash).toBe(
      hashOpaqueToken("quote", token.plainText),
    );
    expect(token.stored.tokenHash).not.toContain(token.plainText);
    expect(verifyOpaqueToken(token.plainText, token.stored, now)).toBe(true);
    expect(
      verifyOpaqueToken(token.plainText, {
        ...token.stored,
        purpose: "contract",
      }),
    ).toBe(false);
  });

  it("rejects expired, revoked and consumed single-use tokens", () => {
    const { plainText, stored } = createOpaqueToken({
      purpose: "contract",
      ttlMs: 1_000,
      now,
      random: deterministicRandom,
    });

    expect(
      verifyOpaqueToken(plainText, stored, new Date(now.getTime() + 1_000)),
    ).toBe(false);
    expect(
      verifyOpaqueToken(plainText, {
        ...stored,
        revokedAt: now.toISOString(),
      }),
    ).toBe(false);
    expect(
      verifyOpaqueToken(plainText, {
        ...stored,
        singleUse: true,
        usedAt: now.toISOString(),
      }),
    ).toBe(false);
  });
});
