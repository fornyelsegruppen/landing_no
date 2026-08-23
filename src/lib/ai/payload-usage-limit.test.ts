import { afterEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { assertPayloadAiUsageAvailable } from "./payload-usage-limit";

afterEach(() => {
  delete process.env.GEMINI_DAILY_REQUEST_LIMIT;
  delete process.env.GEMINI_MONTHLY_REQUEST_LIMIT;
});

function payloadWithCounts(blog: number, leads: number) {
  return {
    count: vi.fn(async ({ collection }: { collection: string }) => ({
      totalDocs: collection === "seo-runs" ? blog : leads,
    })),
  } as unknown as Payload;
}

describe("combined Gemini usage limits", () => {
  it("reserves a call before a blog run", async () => {
    process.env.GEMINI_DAILY_REQUEST_LIMIT = "3";
    await expect(assertPayloadAiUsageAvailable(payloadWithCounts(2, 1), { reserve: 1, now: new Date("2026-08-23T12:00:00Z") })).rejects.toThrow(/daily/);
  });

  it("allows configured capacity and enforces the monthly ceiling", async () => {
    process.env.GEMINI_DAILY_REQUEST_LIMIT = "20";
    process.env.GEMINI_MONTHLY_REQUEST_LIMIT = "5";
    await expect(assertPayloadAiUsageAvailable(payloadWithCounts(1, 1), { reserve: 1 })).resolves.toMatchObject({ daily: 2 });
    await expect(assertPayloadAiUsageAvailable(payloadWithCounts(3, 2), { reserve: 1 })).rejects.toThrow(/monthly/);
  });
});
