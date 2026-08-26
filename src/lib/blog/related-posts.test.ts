import { describe, expect, it } from "vitest";
import type { CmsPostDocument } from "@/lib/cms-pages";
import { publicRelatedPosts } from "./related-posts";

function post(
  id: number,
  overrides: Partial<CmsPostDocument> = {},
): CmsPostDocument {
  return {
    id,
    slug: `guide-${id}`,
    titleNo: `Guide ${id}`,
    contentNo: "Norsk innhold",
    createdAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:00:00.000Z",
    _status: "published",
    editorialStatus: "published",
    ...overrides,
  };
}

describe("public related blog posts", () => {
  it("keeps only published relations with the requested locale", () => {
    const result = publicRelatedPosts(
      [
        1,
        "2",
        post(3),
        post(4, { _status: "draft", editorialStatus: "draft" }),
        post(5, { titleEn: "English title without content" }),
        post(6, { titleEn: "English", contentEn: "English content" }),
      ],
      "en",
    );

    expect(result.map((item) => item.id)).toEqual([6]);
  });
});
