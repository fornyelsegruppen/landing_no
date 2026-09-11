import { describe, expect, it } from "vitest";
import { hashTargetIdFromFragment } from "./case-message-history-disclosure";

describe("hashTargetIdFromFragment", () => {
  it("decodes a message fragment", () => {
    expect(hashTargetIdFromFragment("#message-1")).toBe("message-1");
  });

  it("ignores a malformed fragment", () => {
    expect(hashTargetIdFromFragment("#message-%")).toBeNull();
  });
});
