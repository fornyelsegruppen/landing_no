import { describe, expect, it } from "vitest";
import { Posts } from "./Posts";

function beforeChangeHook() {
  const hook = Posts.hooks?.beforeChange?.[0];
  if (typeof hook !== "function") {
    throw new TypeError("Posts beforeChange hook is not configured");
  }
  return hook;
}

const original = {
  _status: "draft",
  editorialStatus: "approved",
  titleNo: "Kontrollert tittel",
  contentNo: "Tidligere kontrollert innhold",
  authorName: "Takfornyelse",
  aiAssisted: true,
  qualityScore: 94,
  qualityChecks: { passed: true },
  reviewerName: "Tidligere kontrollør",
  reviewedAt: "2026-08-29T10:00:00.000Z",
  scheduledAt: "2026-09-01T08:00:00.000Z",
};

describe("Posts technical editor quality policy", () => {
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
});
