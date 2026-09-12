import type { Payload } from "payload";
import type { Media, Post } from "@/payload/payload-types";
import {
  PexelsStockImageProvider,
  pexelsLicenseUrl,
} from "@/lib/providers/pexels-stock-image-provider";

type StockPost = {
  id: number;
  titleNo: string;
  primaryKeyword?: string | null;
  ctaVariant?: "assessment" | "wash" | "renewal" | "new_roof" | null;
  imageAlt?: string | null;
  editorialStatus?: string | null;
  stockImage?: {
    provider?: string | null;
    assetId?: string | null;
  } | null;
  heroImage?: unknown;
};

const queryByVariant: Record<NonNullable<StockPost["ctaVariant"]>, string> = {
  assessment: "Norwegian house roof tiles exterior",
  wash: "mossy dirty tiled roof house",
  renewal: "renovated tiled roof house exterior",
  new_roof: "new tiled roof house exterior",
};

export function stockQueryForPost(post: StockPost, requestedQuery?: string) {
  const requested = requestedQuery?.trim().replace(/\s+/g, " ");
  if (requested && requested.length >= 3) return requested.slice(0, 120);
  if (/\b(mose|lav|alger|begroing)\b/i.test(`${post.titleNo} ${post.primaryKeyword || ""}`)) {
    return "mossy tiled roof house exterior";
  }
  return queryByVariant[post.ctaVariant || "assessment"];
}

export function shouldPersistPexelsMedia(
  environment: Record<string, string | undefined> = process.env,
) {
  if (environment.NODE_ENV !== "production") return true;
  return Boolean(environment.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * A stock asset must never inherit an AI-written alt text about the article,
 * its subject, or its location. Use Pexels' own description when supplied;
 * otherwise retain only neutral source provenance.
 */
export function pexelsImageAlt(value?: string | null) {
  const description = value?.trim().replace(/\s+/g, " ");
  return description ? description.slice(0, 180) : "Pexels-bilde";
}

export type StockImageReplacementResult =
  | {
      outcome: "replaced";
      post: Post;
      media: Media | null;
      selected: Awaited<ReturnType<PexelsStockImageProvider["search"]>>[number];
      query: string;
      reviewInvalidated: boolean;
    }
  | {
      outcome: "no_alternative";
      query: string;
      existingAssetId: string;
    };

function isUnchangedPexelsImage(
  post: StockPost,
  assetId: string,
  imageAlt: string,
) {
  return (
    !post.heroImage &&
    post.stockImage?.provider === "pexels" &&
    post.stockImage.assetId === assetId &&
    post.imageAlt?.trim() === imageAlt
  );
}

export async function attachPexelsStockImageToPost(input: {
  payload: Payload;
  post: StockPost;
  query?: string;
  provider?: PexelsStockImageProvider;
  persistToMedia?: boolean;
  /** Only the generator's server-side initial enrichment may set this. */
  preserveInitialQuality?: boolean;
}): Promise<StockImageReplacementResult> {
  const provider = input.provider || new PexelsStockImageProvider();
  const query = stockQueryForPost(input.post, input.query);
  const candidates = await provider.search(query);
  const existingAssetId =
    input.post.stockImage?.provider === "pexels"
      ? input.post.stockImage.assetId?.trim()
      : undefined;
  const selected = candidates.find(
    (candidate) => String(candidate.id) !== existingAssetId,
  );
  if (!selected)
    return {
      outcome: "no_alternative",
      query,
      existingAssetId: existingAssetId || "",
    };
  const selectedAt = new Date().toISOString();
  const imageAlt = pexelsImageAlt(selected.alt);
  const reviewInvalidated =
    input.preserveInitialQuality !== true &&
    !isUnchangedPexelsImage(input.post, String(selected.id), imageAlt);
  let media: Media | null = null;
  const persistToMedia = input.persistToMedia ?? shouldPersistPexelsMedia();
  if (persistToMedia) {
    try {
      const file = await provider.download(selected);
      media = await input.payload.create({
        collection: "media",
        overrideAccess: true,
        file,
        data: {
          alt: imageAlt,
          stockProvider: "pexels",
          stockAssetId: String(selected.id),
          stockSourceUrl: selected.pageUrl,
          stockPhotographer: selected.photographer,
          stockPhotographerUrl: selected.photographerUrl,
          stockLicenseUrl: pexelsLicenseUrl,
          stockRetrievedAt: selectedAt,
          stockQuery: query,
        },
      });
    } catch {
      input.payload.logger.warn(
        `Pexels image ${selected.id} could not be persisted to public media storage; using the approved remote asset with attribution instead.`,
      );
    }
  } else {
    input.payload.logger.warn(
      `Pexels image ${selected.id} uses the approved remote asset with attribution because PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN is not configured.`,
    );
  }
  const post: Post = await input.payload.update({
    collection: "posts",
    id: input.post.id,
    draft: true,
    overrideAccess: true,
    // A later human-triggered stock replacement invalidates prior QA/review
    // evidence whenever its Pexels asset or factual alt text changes.
    ...(input.preserveInitialQuality === true
      ? { context: { trustedBlogQualityRevalidation: true } }
      : {}),
    data: {
      ...(media ? { heroImage: media.id } : { heroImage: null }),
      imageAlt,
      ...(reviewInvalidated
        ? {
            _status: "draft" as const,
            editorialStatus: "human_review" as const,
            qualityScore: null,
            qualityChecks: null,
            reviewerName: null,
            reviewedAt: null,
            scheduledAt: null,
          }
        : {}),
      stockImage: {
        provider: "pexels",
        assetId: String(selected.id),
        imageUrl: selected.imageUrl,
        sourceUrl: selected.pageUrl,
        photographer: selected.photographer,
        photographerUrl: selected.photographerUrl,
        licenseUrl: pexelsLicenseUrl,
        query,
        selectedAt,
      },
    },
  });
  return {
    outcome: "replaced",
    post,
    media,
    selected,
    query,
    reviewInvalidated,
  };
}
