import { describe, expect, it } from "vitest";
import type { CmsPostDocument } from "@/lib/cms-pages";
import { buildLatestGuideCards } from "./latest-guides";

function post(
  id: number,
  overrides: Partial<CmsPostDocument> = {},
): CmsPostDocument {
  return {
    id,
    slug: `guide-${id}`,
    titleNo: `Norsk guide ${id}`,
    contentNo: `Norsk innhold ${id}`,
    excerptNo: `Kort forklaring ${id}`,
    createdAt: `2026-08-${String(id).padStart(2, "0")}T10:00:00.000Z`,
    updatedAt: `2026-08-${String(id).padStart(2, "0")}T10:00:00.000Z`,
    publishedAt: `2026-08-${String(id).padStart(2, "0")}T10:00:00.000Z`,
    _status: "published",
    editorialStatus: "published",
    ...overrides,
  };
}

describe("latest public guides", () => {
  it("returns at most three newest public guides", () => {
    const cards = buildLatestGuideCards(
      [post(1), post(4), post(2), post(3)],
      "no",
    );

    expect(cards.map((card) => card.id)).toEqual([4, 3, 2]);
  });

  it("excludes drafts and posts without the requested locale", () => {
    const cards = buildLatestGuideCards(
      [
        post(1, { _status: "draft", editorialStatus: "draft" }),
        post(2),
        post(3, { titleEn: "English only title" }),
        post(4, { titleEn: "English guide", contentEn: "English content" }),
      ],
      "en",
    );

    expect(cards.map((card) => card.id)).toEqual([4]);
  });

  it("uses a safe fallback without producing a broken image", () => {
    const [card] = buildLatestGuideCards(
      [post(1, { excerptNo: null, seoDescriptionNo: "SEO-forklaring" })],
      "no",
    );

    expect(card).toMatchObject({
      category: "Takråd",
      excerpt: "SEO-forklaring",
      image: undefined,
    });
  });

  it("accepts only approved Pexels stock image hosts", () => {
    const cards = buildLatestGuideCards(
      [
        post(1, { stockImage: { imageUrl: "https://example.com/roof.jpg" } }),
        post(2, {
          imageAlt: "Et rengjort tak",
          stockImage: {
            provider: "pexels",
            imageUrl: "https://images.pexels.com/photos/123/roof.jpeg",
          },
        }),
        post(3, {
          stockImage: {
            provider: "manual",
            imageUrl: "https://images.pexels.com/photos/456/roof.jpeg",
          },
        }),
      ],
      "no",
    );

    expect(cards.find((card) => card.id === 2)?.image).toEqual({
      url: "https://images.pexels.com/photos/123/roof.jpeg",
      alt: "Et rengjort tak",
    });
    expect(cards.find((card) => card.id === 1)?.image).toBeUndefined();
    expect(cards.find((card) => card.id === 3)?.image).toBeUndefined();
  });
});
