import { describe, expect, it } from "vitest";
import { blogPostLanguageUrls } from "@/lib/blog/routing";

type TestPost = Parameters<typeof blogPostLanguageUrls>[0];

function post(overrides: Partial<TestPost> = {}): TestPost {
  return {
    slug: "takvask-pris",
    titleNo: "Takvask pris",
    contentNo: "Norsk innhold",
    ...overrides,
  };
}

describe("blog sitemap language handling", () => {
  it("emits only Norwegian when English content is incomplete", () => {
    const languages = blogPostLanguageUrls(
      post({ titleEn: "Roof cleaning price" }),
      "https://www.takfornyelse.as",
    );

    expect(languages).toEqual({
      no: "https://www.takfornyelse.as/no/blogg/takvask-pris",
    });
  });

  it("adds reciprocal alternatives after a complete translation exists", () => {
    const languages = blogPostLanguageUrls(
      post({ titleEn: "Roof cleaning price", contentEn: "English content" }),
      "https://www.takfornyelse.as",
    );

    expect(languages).toMatchObject({
      no: expect.stringContaining("/no/blogg/takvask-pris"),
      en: expect.stringContaining("/en/blogg/takvask-pris"),
    });
  });
});
