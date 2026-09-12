import { describe, expect, it } from "vitest";
import { Posts } from "./Posts";
import {
  publicPostContentFields,
  publicPostContentFingerprint,
} from "../../lib/blog/editorial-policy";

function beforeChangeHook() {
  const hook = Posts.hooks?.beforeChange?.[0];
  if (typeof hook !== "function") {
    throw new TypeError("Posts beforeChange hook is not configured");
  }
  return hook;
}

function beforeOperationHook() {
  const hook = Posts.hooks?.beforeOperation?.[0];
  if (typeof hook !== "function") {
    throw new TypeError("Posts beforeOperation hook is not configured");
  }
  return hook;
}

const original = {
  _status: "draft",
  editorialStatus: "approved",
  titleNo: "Kontrollert tittel",
  contentNo: "Tidligere kontrollert innhold",
  authorName: "Takfornyelse",
  sources: [
    {
      url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
    },
  ],
  aiAssisted: true,
  qualityScore: 94,
  qualityChecks: { passed: true },
  reviewerName: "Tidligere kontrollør",
  reviewedAt: "2026-08-29T10:00:00.000Z",
  scheduledAt: "2026-09-01T08:00:00.000Z",
};

describe("Posts technical editor quality policy", () => {
  it("rejects restores that Payload did not mark as drafts", () => {
    expect(() =>
      beforeOperationHook()({
        args: { collection: "posts", id: "version-1" },
        operation: "restoreVersion",
      } as never),
    ).toThrow(/only be restored as drafts/);

    expect(
      beforeOperationHook()({
        args: { collection: "posts", draft: true, id: "version-1" },
        operation: "restoreVersion",
      } as never),
    ).toMatchObject({ draft: true, id: "version-1" });
  });

  it("keeps freshly evaluated generation QA when Payload supplies an empty original document", async () => {
    const result = await beforeChangeHook()({
      context: { trustedBlogQualityRevalidation: true },
      operation: "create",
      originalDoc: {},
      req: { user: null },
      data: {
        _status: "draft", editorialStatus: "ai_qa", aiAssisted: true,
        titleNo: "Kontrollert tittel", contentNo: "Kontrollert innhold",
        qualityScore: 93, qualityChecks: { passed: true },
      },
    } as never);
    expect(result).toMatchObject({
      _status: "draft", editorialStatus: "ai_qa",
      qualityScore: 93, qualityChecks: { passed: true },
    });
  });

  it("turns a material edit plus publish request back into an unreviewed draft", async () => {
    const result = await beforeChangeHook()({
      context: {},
      data: {
        _status: "published",
        aiAssisted: false,
        contentNo: "Nytt innhold som ennå ikke er kvalitetskontrollert",
      },
      operation: "update",
      originalDoc: original,
      req: {
        user: {
          active: true,
          displayName: "Administrator",
          role: "admin",
        },
      },
    } as never);

    expect(result).toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      qualityScore: null,
      qualityChecks: null,
      aiAssisted: true,
      reviewerName: null,
      reviewedAt: null,
      scheduledAt: null,
    });

    expect(() =>
      beforeChangeHook()({
        context: {},
        data: { _status: "published" },
        operation: "update",
        originalDoc: { ...original, ...result },
        req: {
          user: {
            active: true,
            displayName: "Administrator",
            role: "admin",
          },
        },
      } as never),
    ).toThrow(/kvalitetskontrollen/);
  });

  it("invalidates QA and review evidence when an untrusted stock alt changes", () => {
    for (const editorialStatus of ["ai_qa", "approved"] as const) {
      const result = beforeChangeHook()({
        context: {},
        data: { imageAlt: "Red tiled roof against blue sky" },
        operation: "update",
        originalDoc: { ...original, editorialStatus },
        req: {
          user: {
            active: true,
            displayName: "Administrator",
            role: "admin",
          },
        },
      } as never);

      expect(result).toMatchObject({
        _status: "draft",
        editorialStatus: "human_review",
        qualityScore: null,
        qualityChecks: null,
        reviewerName: null,
        reviewedAt: null,
        scheduledAt: null,
      });
    }
  });

  it("preserves a deterministic fresh QA result from the trusted revalidation path", async () => {
    const result = await beforeChangeHook()({
      context: { trustedBlogQualityRevalidation: true },
      data: {
        _status: "draft",
        contentNo: "Nytt kontrollert innhold",
        editorialStatus: "human_review",
        qualityScore: 91,
        qualityChecks: { passed: true },
        reviewerName: null,
        reviewedAt: null,
        scheduledAt: null,
      },
      operation: "update",
      originalDoc: original,
      req: {
        user: {
          active: true,
          displayName: "Administrator",
          role: "admin",
        },
      },
    } as never);

    expect(result).toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      qualityScore: 91,
      qualityChecks: { passed: true },
    });
  });

  it("resets review evidence for a Payload version restore even when the content is identical", () => {
    const result = beforeChangeHook()({
      context: { isRestoringVersion: true },
      data: {
        ...original,
        _status: "published",
        editorialStatus: "published",
      },
      operation: "update",
      originalDoc: {
        ...original,
        _status: "published",
        editorialStatus: "published",
      },
      req: {
        user: {
          active: true,
          displayName: "Administrator",
          role: "admin",
        },
      },
    } as never);

    expect(result).toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      qualityScore: null,
      qualityChecks: null,
      reviewerName: null,
      reviewedAt: null,
      scheduledAt: null,
    });
  });

  it.each([
    ["uploaded hero", { heroImage: 44 }],
    [
      "stock attribution",
      {
        stockImage: {
          provider: "pexels",
          assetId: "new-stock-asset",
          imageUrl: "https://images.pexels.com/photos/1/new-image.jpeg",
        },
      },
    ],
    [
      "English public content",
      {
        titleEn: "Reviewed English title",
        excerptEn: "Reviewed English excerpt",
        contentEn: "New English public article content",
        seoTitleEn: "Reviewed English SEO title",
        seoDescriptionEn: "Reviewed English SEO description",
      },
    ],
    ["location context", { locationText: "Drammen" }],
    ["image brief", { imageBrief: "A freshly cleaned tiled roof" }],
  ])("invalidates review evidence when only %s changes", (_label, data) => {
    const result = beforeChangeHook()({
      context: {},
      data,
      operation: "update",
      originalDoc: original,
      req: {
        user: {
          active: true,
          displayName: "Administrator",
          role: "admin",
        },
      },
    } as never);

    expect(result).toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      qualityScore: null,
      qualityChecks: null,
      reviewerName: null,
      reviewedAt: null,
      scheduledAt: null,
    });
  });

  it("does not reset approval for an unchanged public-content save", () => {
    const result = beforeChangeHook()({
      context: {},
      data: { titleNo: original.titleNo },
      operation: "update",
      originalDoc: original,
      req: { user: null },
    } as never);

    expect(result).toEqual({ titleNo: original.titleNo });
  });

  it("uses one stable public-content fingerprint definition for later immutable approval", () => {
    expect(publicPostContentFields).toEqual(
      expect.arrayContaining([
        "heroImage",
        "stockImage",
        "contentEn",
        "seoDescriptionEn",
        "faqItems",
        "locationText",
        "imageBrief",
      ]),
    );
    expect(
      publicPostContentFingerprint(original),
    ).not.toBe(
      publicPostContentFingerprint({
        ...original,
        contentEn: "Changed public English content",
      }),
    );
  });

  it("blocks direct published writes until the article has been explicitly approved", () => {
    expect(() =>
      beforeChangeHook()({
        context: {},
        data: { _status: "published" },
        operation: "update",
        originalDoc: { ...original, editorialStatus: "human_review" },
        req: {
          user: {
            active: true,
            displayName: "Administrator",
            role: "admin",
          },
        },
      } as never),
    ).toThrow(/godkjent før publisering/);
  });

  it("blocks direct published writes when only homepage sources exist", () => {
    expect(() =>
      beforeChangeHook()({
        context: {},
        data: { _status: "published" },
        operation: "update",
        originalDoc: {
          ...original,
          sources: [{ url: "https://www.sintef.no/" }],
        },
        req: {
          user: {
            active: true,
            displayName: "Administrator",
            role: "admin",
          },
        },
      } as never),
    ).toThrow(/Minst én presis kilde/);
  });

  it("does not synthesize approval metadata during a direct admin publish", () => {
    expect(() =>
      beforeChangeHook()({
        context: {},
        data: { _status: "published" },
        operation: "update",
        originalDoc: {
          ...original,
          reviewerName: null,
          reviewedAt: null,
        },
        req: {
          user: {
            active: true,
            displayName: "Administrator",
            role: "admin",
          },
        },
      } as never),
    ).toThrow(/Faglig kontrollør mangler/);
  });
});
