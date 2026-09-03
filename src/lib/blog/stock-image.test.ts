import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  attachPexelsStockImageToPost,
  shouldPersistPexelsMedia,
  stockQueryForPost,
} from "./stock-image";
import type { PexelsStockImageProvider } from "@/lib/providers/pexels-stock-image-provider";

describe("blog stock images", () => {
  it("uses a distinct public-media token in production", () => {
    expect(
      shouldPersistPexelsMedia({
        NODE_ENV: "production",
        BLOB_READ_WRITE_TOKEN: "private-store-token",
      }),
    ).toBe(false);
    expect(
      shouldPersistPexelsMedia({
        NODE_ENV: "production",
        PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN: "public-store-token",
      }),
    ).toBe(true);
  });

  it("derives a conservative roof-only query and accepts an admin override", () => {
    const post = { id: 9, titleNo: "Takvask", ctaVariant: "wash" as const };
    expect(stockQueryForPost(post)).toBe("mossy dirty tiled roof house");
    expect(stockQueryForPost(post, "  clean roof Norway  ")).toBe(
      "clean roof Norway",
    );
  });

  it("uses a moss-relevant query for moss topics", () => {
    expect(
      stockQueryForPost({
        id: 9,
        titleNo: "Mose på taket",
        primaryKeyword: "mose på taket",
        ctaVariant: "assessment",
      }),
    ).toBe("mossy tiled roof house exterior");
  });

  it("imports attribution metadata and replaces the draft hero image", async () => {
    const search = vi.fn(async () => [
      {
        id: 123,
        width: 2400,
        height: 1350,
        pageUrl: "https://www.pexels.com/photo/roof-123/",
        photographer: "Test Photographer",
        photographerUrl: "https://www.pexels.com/@test/",
        alt: "Tiled roof",
        imageUrl: "https://images.pexels.com/photos/123/roof.jpeg",
      },
    ]);
    const download = vi.fn(async () => ({
      data: Buffer.from([1, 2, 3]),
      mimetype: "image/jpeg",
      name: "pexels-123.jpg",
      size: 3,
    }));
    const create = vi.fn(async () => ({ id: 41 }));
    const update = vi.fn(async () => ({ id: 9, heroImage: 41 }));
    const result = await attachPexelsStockImageToPost({
      payload: { create, update } as unknown as Payload,
      post: {
        id: 9,
        titleNo: "Takvask etter vinteren",
        ctaVariant: "wash",
        imageAlt: "Tak med mose før vask",
      },
      provider: { search, download } as unknown as PexelsStockImageProvider,
      persistToMedia: true,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "media",
        data: expect.objectContaining({
          alt: "Tak med mose før vask",
          stockProvider: "pexels",
          stockAssetId: "123",
          stockPhotographer: "Test Photographer",
          stockLicenseUrl: "https://www.pexels.com/license/",
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "posts",
        id: 9,
        draft: true,
        data: expect.objectContaining({
          heroImage: 41,
          stockImage: expect.objectContaining({
            provider: "pexels",
            assetId: "123",
            imageUrl: "https://images.pexels.com/photos/123/roof.jpeg",
            photographer: "Test Photographer",
          }),
        }),
      }),
    );
    expect(result.media?.id).toBe(41);
  });

  it("keeps an approved remote Pexels image when media storage is unavailable", async () => {
    const selected = {
      id: 456,
      width: 2400,
      height: 1350,
      pageUrl: "https://www.pexels.com/photo/roof-456/",
      photographer: "Roof Photographer",
      photographerUrl: "https://www.pexels.com/@roof/",
      alt: "House roof",
      imageUrl: "https://images.pexels.com/photos/456/roof.jpeg",
    };
    const search = vi.fn(async () => [selected]);
    const download = vi.fn(async () => ({
      data: Buffer.from([4, 5, 6]),
      mimetype: "image/jpeg",
      name: "pexels-456.jpg",
      size: 3,
    }));
    const create = vi.fn(async () => {
      throw new Error("Blob upload unavailable");
    });
    const update = vi.fn(async (input) => ({ id: 12, ...input.data }));
    const warn = vi.fn();

    const result = await attachPexelsStockImageToPost({
      payload: { create, update, logger: { warn } } as unknown as Payload,
      post: {
        id: 12,
        titleNo: "Sjekk taket etter vinteren",
        ctaVariant: "assessment",
      },
      provider: { search, download } as unknown as PexelsStockImageProvider,
      persistToMedia: true,
    });

    expect(warn).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          heroImage: null,
          stockImage: expect.objectContaining({
            provider: "pexels",
            assetId: "456",
            imageUrl: selected.imageUrl,
            sourceUrl: selected.pageUrl,
          }),
        }),
      }),
    );
    expect(result.media).toBeNull();
  });

  it("skips incompatible media persistence while preserving remote attribution", async () => {
    const selected = {
      id: 789,
      width: 2400,
      height: 1350,
      pageUrl: "https://www.pexels.com/photo/roof-789/",
      photographer: "Safe Fallback",
      photographerUrl: "https://www.pexels.com/@safe/",
      alt: "Roof against the sky",
      imageUrl: "https://images.pexels.com/photos/789/roof.jpeg",
    };
    const create = vi.fn();
    const update = vi.fn(async (input) => ({ id: 13, ...input.data }));
    const warn = vi.fn();
    const download = vi.fn(async () => ({
      data: Buffer.from([7, 8, 9]),
      mimetype: "image/jpeg",
      name: "pexels-789.jpg",
      size: 3,
    }));

    const result = await attachPexelsStockImageToPost({
      payload: { create, update, logger: { warn } } as unknown as Payload,
      post: { id: 13, titleNo: "Takmaling", ctaVariant: "assessment" },
      provider: {
        search: vi.fn(async () => [selected]),
        download,
      } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(create).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("PUBLIC_MEDIA_BLOB_READ_WRITE_TOKEN"),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          heroImage: null,
          stockImage: expect.objectContaining({
            provider: "pexels",
            sourceUrl: selected.pageUrl,
            photographer: selected.photographer,
            licenseUrl: "https://www.pexels.com/license/",
          }),
        }),
      }),
    );
    expect(result.media).toBeNull();
  });
});
