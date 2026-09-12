import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blogPublishedArticleLabel } from "@/lib/admin-v2/i18n";
import { BlogArticleViewLink } from "./blog-article-view-link";

describe("blog article view link", () => {
  it("opens drafts through the preview endpoint", () => {
    const html = renderToStaticMarkup(
      createElement(BlogArticleViewLink, {
        isDraft: true,
        previewLabel: "Peržiūrėti išsaugotą juodraštį",
        publishedLabel: blogPublishedArticleLabel("lt"),
        slug: "tak-sjekk",
      }),
    );

    expect(html).toContain(
      "/api/preview?locale=no&amp;path=%2Fno%2Fblogg%2Ftak-sjekk",
    );
    expect(html).toContain("Peržiūrėti išsaugotą juodraštį");
    expect(html).not.toContain("Atidaryti publikuotą straipsnį");
  });

  it.each([
    ["nb", "Åpne publisert artikkel"],
    ["lt", "Atidaryti publikuotą straipsnį"],
    ["en", "Open published article"],
  ] as const)(
    "opens published articles directly with the %s label",
    (locale, label) => {
      const html = renderToStaticMarkup(
        createElement(BlogArticleViewLink, {
          isDraft: false,
          previewLabel: "preview",
          publishedLabel: blogPublishedArticleLabel(locale),
          slug: "tak-sjekk",
        }),
      );

      expect(html).toContain('href="/no/blogg/tak-sjekk"');
      expect(html).toContain(label);
      expect(html).not.toContain("/api/preview");
    },
  );
});
