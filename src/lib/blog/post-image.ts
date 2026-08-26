import { resolveMedia, type CmsMedia } from "@/lib/cms-content";
import type { CmsPostDocument } from "@/lib/cms-pages";

export function approvedPexelsImageUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "images.pexels.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function resolvePostImage(
  post: CmsPostDocument,
  preferredSize: "hero" | "card",
  fallbackAlt: string,
): CmsMedia | undefined {
  const uploaded = resolveMedia(post.heroImage, preferredSize);
  if (uploaded) {
    return {
      ...uploaded,
      alt: uploaded.alt || post.imageAlt?.trim() || fallbackAlt,
    };
  }

  const stockUrl = approvedPexelsImageUrl(post.stockImage?.imageUrl);
  return stockUrl
    ? {
        url: stockUrl,
        alt: post.imageAlt?.trim() || fallbackAlt,
      }
    : undefined;
}
