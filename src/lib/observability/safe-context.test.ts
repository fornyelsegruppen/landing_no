import { describe, expect, it } from "vitest";
import { correlationIdFromHeaders } from "./correlation-id";
import { redactContext } from "./safe-context";

describe("safe operational context", () => {
  it("accepts only a constrained incoming correlation ID", () => {
    expect(
      correlationIdFromHeaders(
        new Headers({ "x-correlation-id": "request_12345678" }),
      ),
    ).toBe("request_12345678");
    expect(
      correlationIdFromHeaders(
        new Headers({ "x-correlation-id": "bad id with spaces" }),
      ),
    ).not.toBe("bad id with spaces");
  });

  it("redacts secrets and common customer identifiers", () => {
    expect(
      redactContext({
        route: "/api/lead",
        token: "secret-token",
        customerEmail: "customer@example.com",
        nested: { private: true },
      }),
    ).toEqual({
      route: "/api/lead",
      token: "[REDACTED]",
      customerEmail: "[REDACTED]",
      nested: "[object]",
    });
  });
});
