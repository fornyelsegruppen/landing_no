import type { CmsMedia } from "@/lib/cms-content";
import type { CmsPostDocument } from "@/lib/cms-pages";
import { availablePostLocales } from "@/lib/blog/editorial-policy";
import { isPubliclyPublishedPost } from "@/lib/blog/publication-visibility";
import { resolvePostImage } from "@/lib/blog/post-image";
import type { Locale } from "@/lib/site";

export type LatestGuideCard = {
  id: number | string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  image?: CmsMedia;
};

function localizedValue(
  post: CmsPostDocument,
  locale: Locale,
  norwegianKey: "titleNo" | "excerptNo" | "contentNo" | "seoDescriptionNo",
  englishKey: "titleEn" | "excerptEn" | "contentEn" | "seoDescriptionEn",
): string {
  const value = locale === "no" ? post[norwegianKey] : post[englishKey];
  return typeof value === "string" ? value.trim() : "";
}

function excerptFrom(post: CmsPostDocument, locale: Locale): string {
  const explicit = localizedValue(post, locale, "excerptNo", "excerptEn");
  if (explicit) return explicit;

  const seoDescription = localizedValue(
    post,
    locale,
    "seoDescriptionNo",
    "seoDescriptionEn",
  );
  if (seoDescription) return seoDescription;

  return localizedValue(post, locale, "contentNo", "contentEn")
    .replace(/[#*_>`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function timeValue(post: CmsPostDocument): number {
  const value = new Date(post.publishedAt || post.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function buildLatestGuideCards(
  posts: CmsPostDocument[],
  locale: Locale,
  limit = 3,
): LatestGuideCard[] {
  return [...posts]
    .filter(
      (post) =>
        isPubliclyPublishedPost(post) &&
        availablePostLocales(post).includes(locale),
    )
    .sort((a, b) => timeValue(b) - timeValue(a))
    .slice(0, Math.max(0, limit))
    .map((post) => {
      const title = localizedValue(post, locale, "titleNo", "titleEn");
      return {
        id: post.id,
        slug: post.slug,
        title,
        excerpt: excerptFrom(post, locale),
        category:
          locale === "no" ? post.category?.trim() || "Takråd" : "Roof advice",
        publishedAt: post.publishedAt || post.createdAt,
        image: resolvePostImage(post, "card", title),
      };
    });
}
