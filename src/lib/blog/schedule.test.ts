import { describe, expect, it } from "vitest";
import {
  seoDraftDue,
  nextConfiguredSeoDraftAt,
  seoDraftIdempotencyKey,
  seoDraftSlot,
  seoWeekKey,
} from "./schedule";

describe("twice-weekly SEO schedule", () => {
  it("uses Oslo calendar at the UTC midnight boundary", () => {
    expect(seoDraftSlot(new Date("2026-09-13T22:30:00Z"))).toBe("monday");
    expect(seoWeekKey(new Date("2026-09-13T22:30:00Z"))).toBe("2026-W38");
  });
  it("keeps 09:00 Oslo through both DST changes", () => {
    expect(nextConfiguredSeoDraftAt(new Date("2026-03-27T12:00:00Z"))).toBe(
      "2026-03-30T07:00:00.000Z",
    );
    expect(nextConfiguredSeoDraftAt(new Date("2026-10-23T12:00:00Z"))).toBe(
      "2026-10-26T08:00:00.000Z",
    );
    expect(seoDraftDue(new Date("2026-10-26T07:59:00Z"))).toBe(false);
    expect(seoDraftDue(new Date("2026-10-26T08:00:00Z"))).toBe(true);
    expect(seoDraftDue(new Date("2026-10-27T08:00:00Z"))).toBe(false);
  });
  it("has two stable retry-safe slots per ISO week", () => {
    const monday = new Date("2026-08-24T08:00:00.000Z");
    const thursday = new Date("2026-08-27T08:00:00.000Z");
    expect(seoWeekKey(monday)).toBe(seoWeekKey(thursday));
    expect(seoDraftSlot(monday)).toBe("monday");
    expect(seoDraftSlot(thursday)).toBe("thursday");
    expect(seoDraftIdempotencyKey(monday)).not.toBe(
      seoDraftIdempotencyKey(thursday),
    );
    expect(seoDraftIdempotencyKey(new Date("2026-08-25T10:00:00.000Z"))).toBe(
      seoDraftIdempotencyKey(monday),
    );
  });

  it("allows one isolated operator canary key only in Vercel Preview", () => {
    const now = new Date("2026-09-03T08:00:00.000Z");
    const base = seoDraftIdempotencyKey(now, { VERCEL_ENV: "production" });
    const preview = seoDraftIdempotencyKey(now, {
      VERCEL_ENV: "preview",
      SEO_PREVIEW_CANARY_ID: "RC-B466CB9",
    });

    expect(preview).toBe(`${base}:preview-canary:rc-b466cb9`);
    expect(
      seoDraftIdempotencyKey(now, {
        VERCEL_ENV: "production",
        SEO_PREVIEW_CANARY_ID: "must-be-ignored",
      }),
    ).toBe(base);
    expect(
      seoDraftIdempotencyKey(now, {
        VERCEL_ENV: "preview",
        SEO_PREVIEW_CANARY_ID: "unsafe/value",
      }),
    ).toBe(base);
  });
});
