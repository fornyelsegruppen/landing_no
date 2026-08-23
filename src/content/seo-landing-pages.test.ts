import { describe, expect, it } from "vitest";
import {
  getSeoLandingPage,
  seoLandingPages,
  seoLandingSlugs,
} from "./seo-landing-pages";
import { projects } from "./site-content";

describe("SEO landing pages", () => {
  it("contains every priority Norwegian search page", () => {
    expect(seoLandingSlugs).toEqual(
      expect.arrayContaining([
        "takvask",
        "takvask-og-impregnering",
        "takmaling",
        "takfornying",
        "nytt-tak",
        "priser",
        "takvask-oslo",
        "takfornying-baerum",
        "takmaling-drammen",
        "takvask-og-impregnering-lillestrom",
        "takfornying-viken",
      ]),
    );
  });

  it("uses unique Norwegian titles and descriptions", () => {
    expect(new Set(seoLandingPages.map((page) => page.metaTitle.no)).size).toBe(
      seoLandingPages.length,
    );
    expect(
      new Set(seoLandingPages.map((page) => page.metaDescription.no)).size,
    ).toBe(seoLandingPages.length);
  });

  it("provides useful content rather than thin keyword pages", () => {
    for (const page of seoLandingPages) {
      expect(page.intro.no.length).toBeGreaterThan(100);
      expect(page.benefits.length).toBeGreaterThanOrEqual(4);
      expect(page.process.length).toBeGreaterThanOrEqual(4);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
      expect(page.image).toMatch(/^\/gallery\/takfornyelse\//);
      expect(getSeoLandingPage(page.slug)).toBe(page);
    }
  });

  it("publishes all 12 new Takfornyelse gallery images", () => {
    const images = projects.flatMap((project) =>
      project.stages.map((stage) => stage.image),
    );

    expect(images).toHaveLength(12);
    expect(new Set(images).size).toBe(12);
    expect(
      images.every((image) => image.startsWith("/gallery/takfornyelse/")),
    ).toBe(true);
  });

  it("keeps renewal prices aligned with the published packages", () => {
    const renewalCopy = seoLandingPages
      .filter(
        (page) => page.slug.includes("takfornying") || page.slug === "priser",
      )
      .map(
        (page) =>
          `${page.price.no} ${page.priceNote.no} ${page.faq.map((item) => item.answer.no).join(" ")}`,
      )
      .join(" ");

    expect(renewalCopy).toContain("337 kr");
    expect(renewalCopy).not.toContain("600–1 200");
  });

  it("keeps the advertised roof-cleaning entry price visible on landing pages", () => {
    for (const slug of ["takvask", "takvask-oslo"]) {
      const page = getSeoLandingPage(slug);

      expect(page?.price.no).toContain("99 kr/m² + mva");
      expect(page?.price.en).toContain("NOK 99/m² + VAT");
    }
  });

  it("connects priority service pages to documented projects", () => {
    for (const slug of [
      "takvask",
      "takmaling",
      "takfornying",
      "takvask-oslo",
      "takfornying-viken",
    ]) {
      expect(getSeoLandingPage(slug)?.referenceProjectId).toBeTruthy();
    }
  });
});
