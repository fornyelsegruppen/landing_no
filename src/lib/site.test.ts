import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site";

describe("site URL resolution", () => {
  it("uses the exact protected deployment host for Preview customer links", () => {
    expect(
      resolveSiteUrl({
        VERCEL_ENV: "preview",
        VERCEL_URL: "candidate.example.vercel.app",
        NEXT_PUBLIC_SITE_URL: "https://preview.invalid",
      }),
    ).toBe("https://candidate.example.vercel.app");
  });

  it("does not replace the configured Production origin", () => {
    expect(
      resolveSiteUrl({
        VERCEL_ENV: "production",
        VERCEL_URL: "candidate.example.vercel.app",
        NEXT_PUBLIC_SITE_URL: "https://www.takfornyelse.as",
      }),
    ).toBe("https://www.takfornyelse.as");
  });
});
