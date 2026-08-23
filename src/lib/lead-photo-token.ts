import { createHmac, timingSafeEqual } from "crypto";
import { resolvePayloadSecret } from "@/lib/payload-secret";

function requireSecret(): string {
  return resolvePayloadSecret();
}

/** Legacy v1 token. Accepted only inside an explicit, temporary migration window. */
function makeLegacyToken(id: string | number) {
  return createHmac("sha256", requireSecret())
    .update(`lead-photos:${id}`)
    .digest("hex")
    .slice(0, 40);
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

/**
 * v2 token: `v2.<expMs>.<sig>`
 * Sig = HMAC(lead-photos-v2:{id}:{expMs}) truncated.
 */
export function makeLeadPhotoToken(
  id: string | number,
  ttlMs: number = DEFAULT_TTL_MS,
) {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", requireSecret())
    .update(`lead-photos-v2:${id}:${exp}`)
    .digest("hex")
    .slice(0, 40);
  return `v2.${exp}.${sig}`;
}

export function tokensMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyLeadPhotoToken(id: string | number, token: string) {
  if (!token || token.length < 16) return false;

  if (token.startsWith("v2.")) {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const exp = Number(parts[1]);
    const sig = parts[2];
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const expected = createHmac("sha256", requireSecret())
      .update(`lead-photos-v2:${id}:${exp}`)
      .digest("hex")
      .slice(0, 40);
    return tokensMatch(sig, expected);
  }

  // Legacy tokens never expire (emails already sent).
  const cutoff = Date.parse(process.env.LEGACY_LEAD_PHOTO_TOKEN_CUTOFF || "");
  if (!Number.isFinite(cutoff) || cutoff <= Date.now()) return false;
  return tokensMatch(token, makeLegacyToken(id));
}

export function parseLeadPhotoUrls(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
