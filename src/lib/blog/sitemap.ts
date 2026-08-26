import type { MetadataRoute } from "next";
import type { CmsPostDocument } from "@/lib/cms-pages";
import { availablePostLocales } from "@/lib/blog/editorial-policy";
import { isPubliclyPublishedPost } from "@/lib/blog/publication-visibility";
import { blogPostLanguageUrls } from "@/lib/blog/routing";

export function localizedBlogPostEntries(
  post: CmsPostDocument,
  lastModified: Date,
  baseUrl: string,
): MetadataRoute.Sitemap {
  if (!isPubliclyPublishedPost(post)) return [];

  const locales = availablePostLocales(post);
  const languages = blogPostLanguageUrls(post, baseUrl);

  return locales.map((locale) => ({
    url: `${baseUrl}/${locale}/blogg/${post.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
    alternates: {
      languages: {
        ...languages,
        ...(locales.includes("no")
          ? { "x-default": `${baseUrl}/no/blogg/${post.slug}` }
          : {}),
      },
    },
  }));
}
