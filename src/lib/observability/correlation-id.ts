import { randomUUID } from "node:crypto";

export function correlationIdFromHeaders(headers: Headers) {
  const candidate = headers.get("x-correlation-id")?.trim();
  if (candidate && /^[a-zA-Z0-9._:-]{8,100}$/.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}
