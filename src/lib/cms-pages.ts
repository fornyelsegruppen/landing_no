import "server-only";

import { cache } from "react";
import { draftMode } from "next/headers";
import type { Where } from "payload";
import { getPayload } from "@/lib/payload";
import {
  isReservedPageSlug,
  redirectPathCandidates,
} from "@/lib/content-paths";
import type { Locale } from "@/lib/site";
import { availablePostLocales as editorialAvailablePostLocales } from "@/lib/blog/editorial-policy";
import { publishedPostWhere } from "@/lib/blog/publication-visibility";

export type CmsContentDocument = {
  id: number | string;
  slug: string;
  titleNo: string;
  titleEn?: string | null;
  excerptNo?: string | null;
  excerptEn?: string | null;
  contentNo: string;
  contentEn?: string | null;
  seoTitleNo?: string | null;
  seoTitleEn?: string | null;
  seoDescriptionNo?: string | null;
  seoDescriptionEn?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _status?: "draft" | "published" | null;
};

export type CmsPostDocument = CmsContentDocument & {
  category?: string | null;
  editorialStatus?:
    | "draft"
    | "ai_qa"
    | "human_review"
    | "rejected"
    | "approved"
    | "scheduled"
    | "published"
    | null;
  imageAlt?: string | null;
  heroImage?:
    | number
    | string
    | {
        url?: string | null;
        alt?: string | null;
        sizes?: {
          hero?: { url?: string | null } | null;
          card?: { url?: string | null } | null;
        } | null;
        stockProvider?: "manual" | "pexels" | null;
        stockSourceUrl?: string | null;
        stockPhotographer?: string | null;
        stockPhotographerUrl?: string | null;
      }
    | null;
  stockImage?: {
    provider?: string | null;
    assetId?: string | null;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    photographer?: string | null;
    photographerUrl?: string | null;
    licenseUrl?: string | null;
    query?: string | null;
    selectedAt?: string | null;
  } | null;
  authorName?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  ctaVariant?: "assessment" | "wash" | "renewal" | "new_roof" | null;
  sources?:
    | {
        label: string;
        url: string;
        publisher?: string | null;
        accessedAt?: string | null;
      }[]
    | null;
  faqItems?:
    | {
        questionNo: string;
        answerNo: string;
        questionEn?: string | null;
        answerEn?: string | null;
      }[]
    | null;
  relatedPosts?: (number | string | CmsPostDocument)[] | null;
  relatedServices?:
    | (
        | number
        | string
        | {
            id: number | string;
            key: string;
            titleNo: string;
            titleEn: string;
          }
      )[]
    | null;
};

export type CmsRedirectDocument = {
  fromPath: string;
  toPath?: string | null;
  toUrl?: string | null;
  permanent?: boolean | null;
};

export type LocalizedContent = {
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
};

function publishedWhere(slug?: string): Where {
  const conditions: Where[] = [
    {
      _status: {
        equals: "published",
      },
    },
  ];

  if (slug) {
    conditions.unshift({
      slug: {
        equals: slug,
      },
    });
  }

  return { and: conditions };
}

function slugWhere(slug: string, includeDrafts: boolean): Where {
  return includeDrafts
    ? {
        slug: {
          equals: slug,
        },
      }
    : publishedWhere(slug);
}

function postSlugWhere(slug: string, includeDrafts: boolean): Where {
  return includeDrafts ? { slug: { equals: slug } } : publishedPostWhere(slug);
}

const findPageBySlug = cache(
  async (
    slug: string,
    includeDrafts: boolean,
  ): Promise<CmsContentDocument | null> => {
    if (isReservedPageSlug(slug)) return null;

    const payload = await getPayload();
    const result = await payload.find({
      collection: "pages",
      depth: 0,
      draft: includeDrafts,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: slugWhere(slug, includeDrafts),
    });

    return (
      (result.docs[0] as unknown as CmsContentDocument | undefined) ?? null
    );
  },
);

const findPostBySlug = cache(
  async (
    slug: string,
    includeDrafts: boolean,
  ): Promise<CmsPostDocument | null> => {
    const payload = await getPayload();
    const result = await payload.find({
      collection: "posts",
      depth: 2,
      draft: includeDrafts,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: postSlugWhere(slug, includeDrafts),
    });

    return (result.docs[0] as unknown as CmsPostDocument | undefined) ?? null;
  },
);

const findPosts = cache(
  async (includeDrafts: boolean): Promise<CmsPostDocument[]> => {
    const payload = await getPayload();
    const result = await payload.find({
      collection: "posts",
      depth: 1,
      draft: includeDrafts,
      limit: 100,
      overrideAccess: true,
      pagination: false,
      sort: "-publishedAt",
      where: includeDrafts ? undefined : publishedPostWhere(),
    });

    return result.docs as unknown as CmsPostDocument[];
  },
);

export async function getPageBySlug(
  slug: string,
): Promise<CmsContentDocument | null> {
  try {
    const { isEnabled } = await draftMode();
    return await findPageBySlug(slug, isEnabled);
  } catch (error) {
    console.error("CMS page could not be loaded:", error);
    return null;
  }
}

export async function getPostBySlug(
  slug: string,
): Promise<CmsPostDocument | null> {
  try {
    const { isEnabled } = await draftMode();
    return await findPostBySlug(slug, isEnabled);
  } catch (error) {
    console.error("CMS post could not be loaded:", error);
    return null;
  }
}

export async function getPosts(): Promise<CmsPostDocument[]> {
  try {
    const { isEnabled } = await draftMode();
    return await findPosts(isEnabled);
  } catch (error) {
    console.error("CMS posts could not be loaded:", error);
    return [];
  }
}

export async function getPublishedPages(): Promise<CmsContentDocument[]> {
  try {
    const payload = await getPayload();
    const result = await payload.find({
      collection: "pages",
      depth: 0,
      draft: false,
      limit: 1000,
      overrideAccess: true,
      pagination: false,
      sort: "slug",
      where: publishedWhere(),
    });

    return (result.docs as unknown as CmsContentDocument[]).filter(
      (page) => !isReservedPageSlug(page.slug),
    );
  } catch (error) {
    console.error("Published CMS pages could not be loaded:", error);
    return [];
  }
}

export async function getPublishedPosts(): Promise<CmsPostDocument[]> {
  try {
    const payload = await getPayload();
    const result = await payload.find({
      collection: "posts",
      depth: 0,
      draft: false,
      limit: 1000,
      overrideAccess: true,
      pagination: false,
      sort: "-publishedAt",
      where: publishedPostWhere(),
    });

    return result.docs as unknown as CmsPostDocument[];
  } catch (error) {
    console.error("Published CMS posts could not be loaded:", error);
    return [];
  }
}

export async function getLatestPublishedPosts(
  locale: Locale,
  limit = 3,
): Promise<CmsPostDocument[]> {
  try {
    const payload = await getPayload();
    const result = await payload.find({
      collection: "posts",
      depth: 1,
      draft: false,
      limit: 100,
      overrideAccess: true,
      pagination: false,
      sort: "-publishedAt",
      where: publishedPostWhere(),
    });

    return (result.docs as unknown as CmsPostDocument[])
      .filter((post) => postHasLocale(post, locale))
      .slice(0, Math.max(0, limit));
  } catch (error) {
    console.error("Latest published CMS posts could not be loaded:", error);
    return [];
  }
}

export async function getRedirectForPath(
  locale: Locale,
  path: string,
): Promise<CmsRedirectDocument | null> {
  try {
    const candidates = redirectPathCandidates(locale, path);
    const payload = await getPayload();
    const result = await payload.find({
      collection: "redirects",
      depth: 0,
      limit: candidates.length,
      overrideAccess: true,
      pagination: false,
      where: {
        or: candidates.map((candidate) => ({
          fromPath: {
            equals: candidate,
          },
        })),
      },
    });
    const redirects = result.docs as unknown as CmsRedirectDocument[];

    for (const candidate of candidates) {
      const match = redirects.find((item) => item.fromPath === candidate);
      if (match) return match;
    }

    return null;
  } catch (error) {
    console.error("CMS redirects could not be loaded:", error);
    return null;
  }
}

export function localizeContent(
  document: CmsContentDocument,
  locale: Locale,
): LocalizedContent {
  const norwegian = locale === "no";
  const title = (norwegian ? document.titleNo : document.titleEn)?.trim() || "";
  const excerpt =
    (norwegian ? document.excerptNo : document.excerptEn)?.trim() || "";
  const content = (norwegian ? document.contentNo : document.contentEn) || "";
  const seoTitle =
    (norwegian ? document.seoTitleNo : document.seoTitleEn)?.trim() || title;
  const seoDescription =
    (norwegian
      ? document.seoDescriptionNo
      : document.seoDescriptionEn
    )?.trim() ||
    excerpt ||
    content.replace(/\s+/g, " ").trim().slice(0, 160);

  return { title, excerpt, content, seoTitle, seoDescription };
}

export function availablePostLocales(post: CmsPostDocument): Locale[] {
  return editorialAvailablePostLocales(post);
}

export function postHasLocale(post: CmsPostDocument, locale: Locale): boolean {
  return availablePostLocales(post).includes(locale);
}

export function getRedirectDestination(
  redirectDocument: CmsRedirectDocument,
): string | null {
  return (
    redirectDocument.toPath?.trim() || redirectDocument.toUrl?.trim() || null
  );
}
