import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function makeIdempotencyKey(scope: string, input: unknown) {
  if (!scope.trim()) throw new TypeError("Idempotency scope is required");
  const canonical = JSON.stringify(canonicalize(input));
  const digest = createHash("sha256")
    .update(`${scope}:${canonical}`)
    .digest("hex");
  return `${scope}:${digest}`;
}
