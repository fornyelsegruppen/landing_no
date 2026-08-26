import { describe, expect, it } from "vitest";
import { localizedBlogPostEntries } from "@/lib/blog/sitemap";
import { blogPostLanguageUrls } from "@/lib/blog/routing";
import type { CmsPostDocument } from "@/lib/cms-pages";

function post(overrides: Partial<CmsPostDocument> = {}): CmsPostDocument {
  return {
    id: 1,
    slug: "takvask-pris",
    titleNo: "Takvask pris",
    contentNo: "Norsk innhold",
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
    _status: "published",
    editorialStatus: "published",
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

  it("never emits an editorial draft as a sitemap entry", () => {
    const entries = localizedBlogPostEntries(
      post({ editorialStatus: "draft" }),
      new Date("2026-08-26T10:00:00.000Z"),
      "https://www.takfornyelse.as",
    );

    expect(entries).toEqual([]);
  });
});
