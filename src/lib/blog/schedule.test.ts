import { describe, expect, it } from "vitest";
import { seoDraftIdempotencyKey, seoDraftSlot, seoWeekKey } from "./schedule";

describe("twice-weekly SEO schedule", () => {
  it("has two stable retry-safe slots per ISO week", () => {
    const monday = new Date("2026-08-24T08:00:00.000Z");
    const thursday = new Date("2026-08-27T08:00:00.000Z");
    expect(seoWeekKey(monday)).toBe(seoWeekKey(thursday));
    expect(seoDraftSlot(monday)).toBe("monday");
    expect(seoDraftSlot(thursday)).toBe("thursday");
    expect(seoDraftIdempotencyKey(monday)).not.toBe(seoDraftIdempotencyKey(thursday));
    expect(seoDraftIdempotencyKey(new Date("2026-08-25T10:00:00.000Z"))).toBe(
      seoDraftIdempotencyKey(monday),
    );
  });
});
