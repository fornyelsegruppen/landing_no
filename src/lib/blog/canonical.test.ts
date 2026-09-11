import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalBlogUrl, publicSeoOrigin } from "./canonical";

describe("public blog canonical URLs", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("always points Preview metadata at the final public domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://landing-preview-example.vercel.app");

    expect(publicSeoOrigin).toBe("https://takfornyelsenorge.no");
    expect(canonicalBlogUrl("no", "takmaling-pris")).toBe(
      "https://takfornyelsenorge.no/no/blogg/takmaling-pris",
    );
  });
});
