import type { Payload } from "payload";
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
  return queryByVariant[post.ctaVariant || "assessment"];
}

export function shouldPersistPexelsMedia(
  environment: Record<string, string | undefined> = process.env,
) {
  if (environment.NODE_ENV !== "production") return true;
  return Boolean(environment.PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN?.trim());
}

export async function attachPexelsStockImageToPost(input: {
  payload: Payload;
  post: StockPost;
  query?: string;
  provider?: PexelsStockImageProvider;
  persistToMedia?: boolean;
}) {
  const provider = input.provider || new PexelsStockImageProvider();
  const query = stockQueryForPost(input.post, input.query);
  const candidates = await provider.search(query);
  const selected = candidates[0];
  if (!selected)
    throw new TypeError("Fant ingen egnet Pexels-bilde for dette søket");
  const selectedAt = new Date().toISOString();
  let media: Awaited<ReturnType<Payload["create"]>> | null = null;
  const persistToMedia = input.persistToMedia ?? shouldPersistPexelsMedia();
  if (persistToMedia) {
    try {
      const file = await provider.download(selected);
      media = await input.payload.create({
        collection: "media",
        overrideAccess: true,
        file,
        data: {
          alt:
            input.post.imageAlt?.trim() || selected.alt || input.post.titleNo,
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
  const post = await input.payload.update({
    collection: "posts",
    id: input.post.id,
    draft: true,
    overrideAccess: true,
    data: {
      ...(media ? { heroImage: media.id } : { heroImage: null }),
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
  return { post, media, selected, query };
}
