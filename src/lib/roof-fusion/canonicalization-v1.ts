import { createHash } from "node:crypto";

export function compareCanonicalStringsV1(left: string, right: string) {
  // Relational string comparison is defined by UTF-16 code units, not ICU locale data.
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeCanonicalStringV1(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").normalize("NFC");
}

export function canonicalizeJsonValueV1(value: unknown): unknown {
  if (typeof value === "string") return normalizeCanonicalStringV1(value);
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : canonicalizeJsonValueV1(item),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, canonicalizeJsonValueV1(item)]),
    );
  }
  return value;
}

export function canonicalJsonV1(value: unknown): string {
  const normalized = canonicalizeJsonValueV1(value);
  if (Array.isArray(normalized))
    return `[${normalized.map(canonicalJsonV1).join(",")}]`;
  if (normalized && typeof normalized === "object") {
    return `{${Object.entries(normalized as Record<string, unknown>)
      .sort(([left], [right]) => compareCanonicalStringsV1(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJsonV1(item)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(normalized);
  if (serialized === undefined)
    throw new TypeError("Canonical JSON cannot serialize undefined");
  return serialized;
}

export function canonicalSha256V1(value: unknown, domain?: string) {
  const serialized = canonicalJsonV1(value);
  return createHash("sha256")
    .update(domain ? `${domain}:${serialized}` : serialized)
    .digest("hex");
}

export function uniqueCanonicalStringsV1(values: string[]) {
  return [...new Set(values)].sort(compareCanonicalStringsV1);
}
