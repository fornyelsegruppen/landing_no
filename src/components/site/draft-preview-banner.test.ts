import { createElement, type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/layout/navbar";
import {
  DraftPreviewBanner,
  DraftPreviewBoundary,
} from "./draft-preview-banner";

vi.mock("next-intl", () => ({ useLocale: () => "en" }));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/blogg",
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", props),
}));
vi.mock("@/components/site-settings-provider", () => ({
  usePageCopy: () => ({
    nav: {
      services: "Services", references: "References", about: "About",
      products: "Products", contact: "Contact", localeNo: "NO", localeEn: "EN",
      call: "Call", contactUs: "Contact us", menu: "Menu", close: "Close",
    },
  }),
  useSiteSettings: () => ({
    brandName: "Test brand", parentOrg: null, navItems: [], phoneHref: "tel:123",
    images: { logo: { url: "/logo.png", alt: "Test logo" } },
  }),
}));

describe("draft preview banner", () => {
  it("uses the existing GET exit endpoint for public locales", () => {
    const no = renderToStaticMarkup(
      createElement(DraftPreviewBanner, { locale: "no" }),
    );
    const en = renderToStaticMarkup(
      createElement(DraftPreviewBanner, { locale: "en" }),
    );
    expect(no).toContain("/api/exit-preview?locale=no");
    expect(en).toContain("/api/exit-preview?locale=en");
    expect(no).toContain("<a");
    expect(no).not.toContain("data-prefetch");
  });

  it("renders only when the server draft mode is enabled", () => {
    const anonymous = renderToStaticMarkup(
      createElement(DraftPreviewBoundary, { enabled: false, locale: "no" }),
    );
    const preview = renderToStaticMarkup(
      createElement(DraftPreviewBoundary, { enabled: true, locale: "en" }),
    );

    expect(anonymous).toBe("");
    expect(preview).toContain("private draft preview");
    expect(preview).toContain("Exit preview");
  });

  it.each(["no", "en"] as const)(
    "stacks the wrapping %s banner before an in-flow navbar with no height offset",
    (locale) => {
      const html = renderToStaticMarkup(
        createElement(
          DraftPreviewBoundary,
          { enabled: true, locale },
          createElement(Navbar, { inFlow: true }),
        ),
      );
      expect(html).toContain('<div class="sticky top-0 z-50"><aside');
      expect(html).toContain("flex-wrap");
      expect(html).toMatch(/<\/aside><header class="[^"]*relative[^"]*">/);
      expect(html).not.toMatch(/<header class="[^"]*\bfixed\b/);
      expect(html).not.toMatch(/<aside[^>]*(?:h-\d|absolute|fixed|overflow-hidden)/);
      const exit = html.match(/<a[^>]*href="\/api\/exit-preview[^>]*>/)?.[0];
      expect(exit).toBeDefined();
      expect(exit).toContain("min-h-11");
      expect(exit).toContain("focus-visible:outline-2");
      expect(exit).not.toMatch(/tabindex="-1"|pointer-events-none|data-prefetch/);
    },
  );

  it("keeps the public navbar fixed without adding a wrapper or banner", () => {
    const navbar = renderToStaticMarkup(createElement(Navbar));
    const publicHeader = renderToStaticMarkup(
      createElement(
        DraftPreviewBoundary,
        { enabled: false, locale: "en" },
        createElement(Navbar),
      ),
    );
    expect(publicHeader).toBe(navbar);
    expect(publicHeader).toMatch(/<header class="[^"]*fixed inset-x-0 top-0/);
    expect(publicHeader).not.toContain("exit-preview");
    expect(publicHeader).not.toContain("sticky top-0");
  });
});
