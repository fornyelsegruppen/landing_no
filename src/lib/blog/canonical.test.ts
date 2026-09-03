import { describe, expect, it } from "vitest";
import { canonicalBlogUrl, publicSeoOrigin } from "./canonical";

describe("public blog canonical URLs", () => {
  it("always points Preview metadata at the final public domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      "https://landing-preview-example.vercel.app";

    expect(publicSeoOrigin).toBe("https://www.takfornyelse.as");
    expect(canonicalBlogUrl("no", "takmaling-pris")).toBe(
      "https://www.takfornyelse.as/no/blogg/takmaling-pris",
    );
  });
});
