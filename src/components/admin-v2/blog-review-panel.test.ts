import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlogReviewPanel, blogReviewListKey } from "./blog-review-panel";

describe("BlogReviewPanel", () => {
  it("explains short-content and missing structural metadata without raw schema messages", () => {
    const html = renderToStaticMarkup(
      createElement(BlogReviewPanel, {
        locale: "lt",
        status: "human_review",
        qualityScore: 0,
        qualityChecks: {
          passed: false,
          issues: ["content", "faq", "imageBrief"].map((field) => ({
            code: "invalid_output",
            gate: "schema",
            severity: "blocker" as const,
            message: `${field}: Invalid input`,
          })),
        },
      }),
    );
    expect(html).toContain("700–15000 simbolių");
    expect(html).toContain("2–6 klausimų");
    expect(html).toContain("20–500 simbolių");
    expect(html).toContain("Turinio struktūra");
    expect(html).not.toContain("Invalid input");
    expect(html).not.toContain(">schema<");
  });
  it("uses distinct list keys when QA returns repeated issue, flag, or source values", () => {
    const keys = [
      blogReviewListKey("blocker", "invalid_output", 0),
      blogReviewListKey("blocker", "invalid_output", 1),
      blogReviewListKey("warning", "invalid_output", 0),
      blogReviewListKey("flag", "manual review", 0),
      blogReviewListKey("flag", "manual review", 1),
      blogReviewListKey("source", "https://example.invalid/source", 0),
      blogReviewListKey("source", "https://example.invalid/source", 1),
    ];

    expect(new Set(keys)).toHaveLength(keys.length);
  });

  it("shows the blocked publish gate, homepage-only risk and stock provenance", () => {
    const html = renderToStaticMarkup(
      createElement(BlogReviewPanel, {
        locale: "lt",
        qualityChecks: {
          passed: false,
          issues: [
            {
              code: "unsupported_guarantee",
              gate: "facts",
              message: "Garantija turi būti patvirtinta rankiniu būdu.",
              severity: "blocker",
            },
            {
              code: "source_homepage_only",
              gate: "facts",
              message: "Reikia tikslesnio šaltinio puslapio.",
              severity: "warning",
            },
          ],
        },
        qualityScore: 61,
        aiAssisted: true,
        reviewFlags: [
          { flag: "Patikrinti ar savivaldybės šaltinis dar galioja." },
        ],
        sources: [
          {
            label: "Savivaldybė",
            publisher: "Oslo kommune",
            url: "https://example.com/",
          },
        ],
        status: "human_review",
        stockImage: {
          provider: "pexels",
          photographer: "Ada Lovelace",
          sourceUrl: "https://pexels.com/photo/1",
          licenseUrl: "https://pexels.com/license/",
          query: "norwegian roof",
        },
      }),
    );

    expect(html).toContain("Tiesioginis publikavimas užrakintas");
    expect(html).toContain("Straipsnis dar nepatvirtintas publikavimui");
    expect(html).toContain("Trūksta tikslaus straipsnio lygio šaltinio");
    expect(html).toContain("Tik pradinis puslapis");
    expect(html).toContain("Parinkta stock nuotrauka");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Garantija turi būti patvirtinta rankiniu būdu.");
  });

  it("shows a ready state when direct publish is allowed", () => {
    const html = renderToStaticMarkup(
      createElement(BlogReviewPanel, {
        locale: "en",
        qualityChecks: {
          policyVersion: "2026-09-12-repetition-v1",
          passed: true,
          issues: [],
        },
        qualityScore: 90,
        aiAssisted: true,
        reviewedAt: "2026-09-03T01:00:00.000Z",
        reviewerName: "Kari",
        reviewFlags: [],
        sources: [{ url: "https://example.com/article" }],
        status: "approved",
      }),
    );

    expect(html).toContain("Ready for direct publishing");
    expect(html).toContain("No open quality issues.");
  });
});
