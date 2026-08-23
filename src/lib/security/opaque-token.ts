import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type StoredToken = {
  purpose: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string | null;
  usedAt?: string | null;
  singleUse?: boolean;
};

export function hashOpaqueToken(purpose: string, token: string) {
  return createHash("sha256").update(`${purpose}:${token}`).digest("hex");
}

export function createOpaqueToken(options: {
  purpose: string;
  ttlMs: number;
  now?: Date;
  random?: (size: number) => Buffer;
}) {
  if (!options.purpose.trim()) throw new TypeError("Token purpose is required");
  if (!Number.isSafeInteger(options.ttlMs) || options.ttlMs <= 0) {
    throw new TypeError("Token TTL must be a positive integer");
  }

  const plainText = (options.random ?? randomBytes)(32).toString("base64url");
  const now = options.now ?? new Date();
  return {
    plainText,
    stored: {
      purpose: options.purpose,
      tokenHash: hashOpaqueToken(options.purpose, plainText),
      expiresAt: new Date(now.getTime() + options.ttlMs).toISOString(),
    } satisfies StoredToken,
  };
}

function safeHashMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function verifyOpaqueToken(
  candidate: string,
  stored: StoredToken,
  now: Date = new Date(),
) {
  if (!candidate || stored.revokedAt) return false;
  if (stored.singleUse && stored.usedAt) return false;
  if (new Date(stored.expiresAt).getTime() <= now.getTime()) return false;

  return safeHashMatch(
    hashOpaqueToken(stored.purpose, candidate),
    stored.tokenHash,
  );
}
