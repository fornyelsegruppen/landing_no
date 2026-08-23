import { describe, expect, it } from "vitest";
import { makeIdempotencyKey } from "./idempotency";

describe("idempotency keys", () => {
  it("is stable when object keys arrive in a different order", () => {
    expect(makeIdempotencyKey("message", { lead: 4, kind: "receipt" })).toBe(
      makeIdempotencyKey("message", { kind: "receipt", lead: 4 }),
    );
  });

  it("separates scopes and logical inputs", () => {
    expect(makeIdempotencyKey("message", { lead: 4 })).not.toBe(
      makeIdempotencyKey("quote", { lead: 4 }),
    );
    expect(makeIdempotencyKey("message", { lead: 4 })).not.toBe(
      makeIdempotencyKey("message", { lead: 5 }),
    );
  });
});
