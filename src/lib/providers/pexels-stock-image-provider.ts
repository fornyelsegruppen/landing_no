import { z } from "zod";

const PEXELS_API_URL = "https://api.pexels.com/v1/search";
const PEXELS_IMAGE_HOST = "images.pexels.com";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const pexelsResponseSchema = z.object({
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
  ) {
    this.apiKey = env.PEXELS_API_KEY?.trim() || "";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async search(query: string): Promise<PexelsStockPhoto[]> {
    if (!this.apiKey) {
      throw new TypeError("PEXELS_API_KEY mangler i Preview-miljøet");
    }
    const cleanQuery = query.trim().replace(/\s+/g, " ").slice(0, 120);
    if (cleanQuery.length < 3) throw new TypeError("Bildesøket er for kort");

    const url = new URL(PEXELS_API_URL);
    url.searchParams.set("query", cleanQuery);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("size", "large");
    url.searchParams.set("per_page", "12");

    const response = await this.request(url, {
      headers: { Authorization: this.apiKey },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`Pexels search failed with HTTP ${response.status}`);
    }
    const parsed = pexelsResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Pexels returned an invalid response");

    return parsed.data.photos
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
  }

  async download(photo: PexelsStockPhoto): Promise<DownloadedStockImage> {
    const url = assertPexelsImageUrl(photo.imageUrl);
    const response = await this.request(url, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
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
