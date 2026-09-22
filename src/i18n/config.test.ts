import { describe, expect, it } from "vitest";
import { routingConfig } from "./config";

describe("localized routing metadata", () => {
  it("keeps middleware Link headers disabled in favour of page metadata", () => {
    expect(routingConfig.alternateLinks).toBe(false);
  });
});
