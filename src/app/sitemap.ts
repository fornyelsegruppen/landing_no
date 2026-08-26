import type { MetadataRoute } from "next";
import { getPayload } from "@/lib/payload";
import {
  getPublishedPages,
  getPublishedPosts,
  type CmsContentDocument,
} from "@/lib/cms-pages";
import { siteConfig } from "@/lib/site";
import { seoLandingSlugs } from "@/content/seo-landing-pages";
import { localizedBlogPostEntries } from "@/lib/blog/sitemap";

export const revalidate = 300;

async function getLastModified(): Promise<Date> {
  const fallback = new Date();

  try {
    const payload = await getPayload();
    const settings = await payload.findGlobal({
      slug: "site-settings",
      depth: 0,
      draft: false,
      overrideAccess: true,
    });
    const updatedAt = (settings as { updatedAt?: string | null }).updatedAt;
    if (!updatedAt) return fallback;

    const date = new Date(updatedAt);
    return Number.isNaN(date.getTime()) ? fallback : date;
  } catch {
    return fallback;
  }
}

function validDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function localizedEntries(
  path: string,
  lastModified: Date,
  changeFrequency: "weekly" | "monthly",
  priority: number,
): MetadataRoute.Sitemap {
  return siteConfig.locales.map((locale) => ({
    url: `${siteConfig.url}/${locale}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: {
        ...Object.fromEntries(
          siteConfig.locales.map((language) => [
            language,
            `${siteConfig.url}/${language}${path}`,
          ]),
        ),
        "x-default": `${siteConfig.url}/no${path}`,
      },
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = await getLastModified();
  const staticPages = [
    { path: "", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/blogg", changeFrequency: "weekly" as const, priority: 0.8 },
    {
      path: "/kundeomtaler",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    { path: "/personvern", changeFrequency: "monthly" as const, priority: 0.5 },
    {
      path: "/angreskjema",
      changeFrequency: "monthly" as const,
      priority: 0.4,
    },
  ];

  const staticEntries = staticPages.flatMap((page) =>
    localizedEntries(
      page.path,
      lastModified,
      page.changeFrequency,
      page.priority,
    ),
  );
  const seoEntries = seoLandingSlugs.flatMap((slug) =>
    localizedEntries(`/${slug}`, lastModified, "monthly", 0.9),
  );

  try {
    const [pages, posts] = await Promise.all([
      getPublishedPages(),
      getPublishedPosts(),
    ]);
    const dynamicPages = pages
      .filter(
        (page: CmsContentDocument) => !seoLandingSlugs.includes(page.slug),
      )
      .flatMap((page: CmsContentDocument) =>
        localizedEntries(
          `/${page.slug}`,
          validDate(page.updatedAt, lastModified),
          "monthly",
          0.7,
        ),
      );
    const blogPosts = posts.flatMap((post) =>
      localizedBlogPostEntries(
        post,
        validDate(post.updatedAt, lastModified),
        siteConfig.url,
      ),
    );

    return [...staticEntries, ...seoEntries, ...dynamicPages, ...blogPosts];
  } catch (error) {
    console.error("CMS sitemap entries could not be loaded:", error);
    return [...staticEntries, ...seoEntries];
  }
}
