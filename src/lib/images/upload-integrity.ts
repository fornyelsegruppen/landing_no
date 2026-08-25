import { createHash } from "node:crypto";

export function uploadSha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function uploadDigestMatches(bytes: Uint8Array, expected: string | null | undefined) {
  return Boolean(expected && /^[a-f0-9]{64}$/i.test(expected) && uploadSha256(bytes) === expected.toLowerCase());
}
