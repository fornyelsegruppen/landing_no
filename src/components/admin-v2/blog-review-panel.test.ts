import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlogReviewPanel } from "./blog-review-panel";

describe("BlogReviewPanel", () => {
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
        qualityChecks: { passed: true, issues: [] },
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
