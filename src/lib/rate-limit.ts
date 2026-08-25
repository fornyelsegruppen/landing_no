import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type MemoryEntry = { count: number; reset: number };
const memoryMaps = new Map<string, Map<string, MemoryEntry>>();

function memoryLimit(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  let map = memoryMaps.get(namespace);
  if (!map) {
    map = new Map();
    memoryMaps.set(namespace, map);
  }
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now > entry.reset) {
    map.set(key, { count: 1, reset: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }
  entry.count += 1;
  return { success: true, remaining: limit - entry.count };
}

const limiters = new Map<string, Ratelimit>();

function getUpstashLimiter(namespace: string, limit: number, windowSec: number) {
  const cacheKey = `${namespace}:${limit}:${windowSec}`;
  let limiter = limiters.get(cacheKey);
  if (limiter) return limiter;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `takfornyelse:${namespace}`,
    analytics: false,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Rate-limit by key. Uses Upstash when configured; falls back to in-memory
 * (fine for local / single-instance, weak on serverless without Upstash).
 */
export async function rateLimit(
  namespace: string,
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<{ success: boolean; remaining: number }> {
  const upstash = getUpstashLimiter(namespace, opts.limit, opts.windowSec);
  if (upstash) {
    const result = await upstash.limit(key);
    return { success: result.success, remaining: result.remaining };
  }
  return memoryLimit(namespace, key, opts.limit, opts.windowSec * 1000);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
