import { z } from "zod";

const PEXELS_API_URL = "https://api.pexels.com/v1/search";
const PEXELS_IMAGE_HOST = "images.pexels.com";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_SEARCH_PER_PAGE = 80;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const pexelsResponseSchema = z.object({
  total_results: z.number().int().nonnegative(),
  photos: z.array(
    z.object({
      id: z.number().int().positive(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      url: z.string().url(),
      photographer: z.string().trim().min(1).max(200),
      photographer_url: z.string().url(),
      alt: z.string().trim().max(500).optional().default(""),
      src: z.object({
        landscape: z.string().url().optional(),
        large2x: z.string().url().optional(),
        large: z.string().url().optional(),
        original: z.string().url(),
      }),
    }),
  ),
});

export type PexelsStockPhoto = {
  id: number;
  width: number;
  height: number;
  pageUrl: string;
  photographer: string;
  photographerUrl: string;
  alt: string;
  imageUrl: string;
};

export type DownloadedStockImage = {
  data: Buffer;
  mimetype: string;
  name: string;
  size: number;
};

export type PexelsSearchOptions = {
  page?: number;
  perPage?: number;
};

export type PexelsStockSearchPage = {
  photos: PexelsStockPhoto[];
  hasMore: boolean;
};

function assertPexelsImageUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== PEXELS_IMAGE_HOST) {
    throw new TypeError("Stock image URL is not an approved Pexels image host");
  }
  return url;
}

function extensionFor(mimetype: string) {
  if (mimetype === "image/png") return "png";
  if (mimetype === "image/webp") return "webp";
  return "jpg";
}

export class PexelsStockImageProvider {
  private readonly apiKey: string;

  constructor(
    env: Record<string, string | undefined> = process.env,
    private readonly request: typeof fetch = fetch,
    private readonly signal?: AbortSignal,
  ) {
    this.apiKey = env.PEXELS_API_KEY?.trim() || "";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async search(
    query: string,
    { page = 1, perPage = 30 }: PexelsSearchOptions = {},
  ): Promise<PexelsStockPhoto[]> {
    return (await this.searchPage(query, { page, perPage })).photos;
  }

  async searchPage(
    query: string,
    { page = 1, perPage = 30 }: PexelsSearchOptions = {},
  ): Promise<PexelsStockSearchPage> {
    if (!this.apiKey) {
      throw new TypeError("PEXELS_API_KEY mangler i Preview-miljøet");
    }
    const cleanQuery = query.trim().replace(/\s+/g, " ").slice(0, 120);
    if (cleanQuery.length < 3) throw new TypeError("Bildesøket er for kort");
    if (!Number.isInteger(page) || page < 1) {
      throw new TypeError("Pexels-siden er ugyldig");
    }
    if (
      !Number.isInteger(perPage) ||
      perPage < 1 ||
      perPage > MAX_SEARCH_PER_PAGE
    ) {
      throw new TypeError("Pexels sideantall er ugyldig");
    }

    const url = new URL(PEXELS_API_URL);
    url.searchParams.set("query", cleanQuery);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const response = await this.request(url, {
      headers: { Authorization: this.apiKey },
      signal: this.signal
        ? AbortSignal.any([this.signal, AbortSignal.timeout(12_000)])
        : AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`Pexels search failed with HTTP ${response.status}`);
    }
    const parsed = pexelsResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Pexels returned an invalid response");

    const photos = parsed.data.photos
      .filter((photo) => photo.width / photo.height >= 1.3)
      .map((photo) => {
        const imageUrl =
          photo.src.landscape ||
          photo.src.large2x ||
          photo.src.large ||
          photo.src.original;
        assertPexelsImageUrl(imageUrl);
        return {
          id: photo.id,
          width: photo.width,
          height: photo.height,
          pageUrl: photo.url,
          photographer: photo.photographer,
          photographerUrl: photo.photographer_url,
          alt: photo.alt,
          imageUrl,
        };
      });
    return {
      photos,
      hasMore: page * perPage < parsed.data.total_results,
    };
  }

  async download(photo: PexelsStockPhoto): Promise<DownloadedStockImage> {
    const url = assertPexelsImageUrl(photo.imageUrl);
    const response = await this.request(url, {
      redirect: "error",
      signal: this.signal
        ? AbortSignal.any([this.signal, AbortSignal.timeout(20_000)])
        : AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(
        `Pexels image download failed with HTTP ${response.status}`,
      );
    }
    const mimetype = (response.headers.get("content-type") || "")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimetype)) {
      throw new TypeError("Pexels returned an unsupported image type");
    }
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_IMAGE_BYTES) {
      throw new TypeError(
        "Pexels image is larger than the allowed upload size",
      );
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length || data.length > MAX_IMAGE_BYTES) {
      throw new TypeError("Pexels image has an invalid upload size");
    }
    return {
      data,
      mimetype,
      name: `pexels-${photo.id}.${extensionFor(mimetype)}`,
      size: data.length,
    };
  }
}

export const pexelsLicenseUrl = "https://www.pexels.com/license/";
