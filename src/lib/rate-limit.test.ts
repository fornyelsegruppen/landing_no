import { afterEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "./rate-limit";

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
});

describe("rate limit", () => {
  it("enforces the local fallback boundary deterministically", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const namespace = `test-${crypto.randomUUID()}`;
    await expect(rateLimit(namespace, "same-client", { limit: 2, windowSec: 60 }))
      .resolves.toEqual({ success: true, remaining: 1 });
    await expect(rateLimit(namespace, "same-client", { limit: 2, windowSec: 60 }))
      .resolves.toEqual({ success: true, remaining: 0 });
    await expect(rateLimit(namespace, "same-client", { limit: 2, windowSec: 60 }))
      .resolves.toEqual({ success: false, remaining: 0 });
  });

  it("uses the first trusted proxy address", () => {
    const request = new Request("https://example.invalid", {
      headers: { "x-forwarded-for": "192.0.2.10, 198.51.100.7" },
    });
    expect(clientIp(request)).toBe("192.0.2.10");
  });
});
