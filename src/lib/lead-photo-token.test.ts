import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeLeadPhotoToken,
  verifyLeadPhotoToken,
} from "@/lib/lead-photo-token";

const TEST_SECRET = "test-payload-secret-that-is-long-enough";

describe("lead photo tokens", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", TEST_SECRET);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("verifies a v2 token for the matching lead", () => {
    const token = makeLeadPhotoToken("lead-42", 60_000);

    expect(verifyLeadPhotoToken("lead-42", token)).toBe(true);
    expect(verifyLeadPhotoToken("lead-43", token)).toBe(false);
  });

  it("rejects an expired v2 token", () => {
    const token = makeLeadPhotoToken("lead-42", 1_000);
    vi.advanceTimersByTime(1_001);

    expect(verifyLeadPhotoToken("lead-42", token)).toBe(false);
  });

  it("rejects legacy tokens unless a temporary future cutoff is explicit", () => {
    const id = "legacy-lead";
    const legacyToken = createHmac("sha256", TEST_SECRET)
      .update(`lead-photos:${id}`)
      .digest("hex")
      .slice(0, 40);

    expect(verifyLeadPhotoToken(id, legacyToken)).toBe(false);
    vi.stubEnv("LEGACY_LEAD_PHOTO_TOKEN_CUTOFF", "2026-07-28T12:00:00.000Z");
    expect(verifyLeadPhotoToken(id, legacyToken)).toBe(true);
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));
    expect(verifyLeadPhotoToken(id, legacyToken)).toBe(false);
  });
});
