import { describe, expect, it } from "vitest";
import { reviewerNameForUser } from "./reviewer";

describe("blog reviewer identity", () => {
  it("prefers the administrator display name and safely falls back", () => {
    expect(
      reviewerNameForUser({ displayName: "Kari Nordmann", email: "a@b.no" }),
    ).toBe("Kari Nordmann");
    expect(reviewerNameForUser({ email: "admin@takfornyelse.as" })).toBe(
      "admin@takfornyelse.as",
    );
    expect(reviewerNameForUser(null)).toBe("Administrator");
  });
});
