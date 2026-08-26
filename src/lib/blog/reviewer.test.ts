import { describe, expect, it } from "vitest";
import { publicReviewerName, reviewerNameForUser } from "./reviewer";

describe("blog reviewer identity", () => {
  it("prefers the administrator display name and safely falls back", () => {
    expect(
      reviewerNameForUser({ displayName: "Kari Nordmann", email: "a@b.no" }),
    ).toBe("Kari Nordmann");
    expect(reviewerNameForUser({ email: "admin@takfornyelse.as" })).toBe(
      "Fagansvarlig i Takfornyelse",
    );
    expect(reviewerNameForUser(null)).toBe("Fagansvarlig i Takfornyelse");
  });

  it("never exposes an email address as the public reviewer name", () => {
    expect(publicReviewerName("reviewer@takfornyelse.as")).toBe(
      "Fagansvarlig i Takfornyelse",
    );
    expect(publicReviewerName("Kari Nordmann")).toBe("Kari Nordmann");
    expect(publicReviewerName(null)).toBeNull();
  });
});
