import { describe, expect, it } from "vitest";
import { cronRequestAuthorized } from "./cron-auth";

describe("cron authorization", () => {
  it("requires an exact bearer secret", () => {
    expect(
      cronRequestAuthorized(
        new Request("https://example.test", { headers: { authorization: "Bearer correct" } }),
        "correct",
      ),
    ).toBe(true);
    expect(
      cronRequestAuthorized(
        new Request("https://example.test", { headers: { authorization: "Bearer wrong" } }),
        "correct",
      ),
    ).toBe(false);
  });
});
