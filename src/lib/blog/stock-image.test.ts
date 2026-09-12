import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  attachPexelsStockImageToPost,
  pexelsImageAlt,
  shouldPersistPexelsMedia,
  stockQueryForPost,
  type StockImageReplacementResult,
} from "./stock-image";
import type { PexelsStockImageProvider } from "@/lib/providers/pexels-stock-image-provider";

describe("blog stock images", () => {
  function expectReplacement(result: StockImageReplacementResult) {
    expect(result.outcome).toBe("replaced");
    if (result.outcome !== "replaced") {
      throw new Error("Expected a distinct Pexels replacement");
    }
    return result;
  }

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

  it("never derives stock alt text from the article topic or location", () => {
    expect(pexelsImageAlt("  Red tiled roof against blue sky  ")).toBe(
      "Red tiled roof against blue sky",
    );
    expect(pexelsImageAlt("")).toBe("Pexels-bilde");
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
        imageAlt: "Tak med mose i Oslo før vask",
        editorialStatus: "ai_qa",
      },
      provider: { search, download } as unknown as PexelsStockImageProvider,
      persistToMedia: true,
      preserveInitialQuality: true,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "media",
        data: expect.objectContaining({
          alt: "Tiled roof",
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
        context: { trustedBlogQualityRevalidation: true },
        data: expect.objectContaining({
          heroImage: 41,
          imageAlt: "Tiled roof",
          stockImage: expect.objectContaining({
            provider: "pexels",
            assetId: "123",
            imageUrl: "https://images.pexels.com/photos/123/roof.jpeg",
            photographer: "Test Photographer",
          }),
        }),
      }),
    );
    expect(expectReplacement(result).media?.id).toBe(41);
  });

  it("invalidates manual replacement for ai_qa and approved drafts even with a neutral unchanged alt", async () => {
    const selected = {
      id: 321,
      width: 2400,
      height: 1350,
      pageUrl: "https://www.pexels.com/photo/roof-321/",
      photographer: "Manual Review",
      photographerUrl: "https://www.pexels.com/@manual/",
      alt: "",
      imageUrl: "https://images.pexels.com/photos/321/roof.jpeg",
    };

    for (const editorialStatus of ["ai_qa", "approved"]) {
      const update = vi.fn(async (input) => ({ id: 22, ...input.data }));
      const result = await attachPexelsStockImageToPost({
        payload: { update, logger: { warn: vi.fn() } } as unknown as Payload,
        post: {
          id: 22,
          titleNo: "Takfornying",
          editorialStatus,
          imageAlt: "Pexels-bilde",
          stockImage: { provider: "pexels", assetId: "111" },
        },
        provider: {
          search: vi.fn(async () => [selected]),
        } as unknown as PexelsStockImageProvider,
        persistToMedia: false,
      });
      expect(update.mock.calls[0]?.[0]).not.toHaveProperty("context");
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imageAlt: "Pexels-bilde",
            editorialStatus: "human_review",
            qualityScore: null,
            qualityChecks: null,
            reviewerName: null,
            reviewedAt: null,
            scheduledAt: null,
            _status: "draft",
            stockImage: expect.objectContaining({ assetId: "321" }),
          }),
        }),
      );
      expect(expectReplacement(result).reviewInvalidated).toBe(true);
    }
  });

  it("returns an honest no-alternative outcome without updating when Pexels returns only the current asset", async () => {
    const update = vi.fn(async (input) => ({ id: 23, ...input.data }));
    const result = await attachPexelsStockImageToPost({
      payload: { update, logger: { warn: vi.fn() } } as unknown as Payload,
      post: {
        id: 23,
        titleNo: "Takfornying",
        editorialStatus: "approved",
        imageAlt: "Red tiled roof",
        stockImage: { provider: "pexels", assetId: "654" },
      },
      provider: {
        search: vi.fn(async () => [
          {
            id: 654,
            width: 2400,
            height: 1350,
            pageUrl: "https://www.pexels.com/photo/roof-654/",
            photographer: "Same Asset",
            photographerUrl: "https://www.pexels.com/@same/",
            alt: "Red tiled roof",
            imageUrl: "https://images.pexels.com/photos/654/roof.jpeg",
          },
        ]),
      } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        outcome: "no_alternative",
        existingAssetId: "654",
      }),
    );
  });

  it("excludes the current Pexels asset and selects a genuine alternative", async () => {
    const update = vi.fn(async (input) => ({ id: 23, ...input.data }));
    const result = await attachPexelsStockImageToPost({
      payload: { update, logger: { warn: vi.fn() } } as unknown as Payload,
      post: {
        id: 23,
        titleNo: "Takfornying",
        imageAlt: "Current roof",
        stockImage: { provider: "pexels", assetId: "654" },
      },
      provider: {
        search: vi.fn(async () => [
          {
            id: 654,
            width: 2400,
            height: 1350,
            pageUrl: "https://www.pexels.com/photo/roof-654/",
            photographer: "Current Asset",
            photographerUrl: "https://www.pexels.com/@current/",
            alt: "Current roof",
            imageUrl: "https://images.pexels.com/photos/654/roof.jpeg",
          },
          {
            id: 655,
            width: 2400,
            height: 1350,
            pageUrl: "https://www.pexels.com/photo/roof-655/",
            photographer: "Alternative Asset",
            photographerUrl: "https://www.pexels.com/@alternative/",
            alt: "Alternative roof",
            imageUrl: "https://images.pexels.com/photos/655/roof.jpeg",
          },
        ]),
      } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(result).toMatchObject({
      outcome: "replaced",
      selected: { id: 655 },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageAlt: "Alternative roof",
          stockImage: expect.objectContaining({ assetId: "655" }),
        }),
      }),
    );
  });

  it("skips explicit Bergen landmark metadata for an Oslo article but keeps a neutral roof alternative", async () => {
    const update = vi.fn(async (input) => ({ id: 11, ...input.data }));
    const result = await attachPexelsStockImageToPost({
      payload: { update, logger: { warn: vi.fn() } } as unknown as Payload,
      post: {
        id: 11,
        titleNo: "Takfornying i Oslo",
        primaryKeyword: "takfornying Oslo",
        stockImage: { provider: "pexels", assetId: "29114658" },
      },
      provider: {
        search: vi.fn(async () => [
          {
            id: 29525395,
            width: 2400,
            height: 1350,
            pageUrl:
              "https://www.pexels.com/photo/colorful-bryggen-buildings-in-bergen-norway-29525395/",
            photographer: "Fixture Photographer",
            photographerUrl: "https://www.pexels.com/@fixture/",
            alt: "Colorful historic buildings in Bryggen, Bergen under a bright blue sky.",
            imageUrl: "https://images.pexels.com/photos/29525395/bryggen.jpeg",
          },
          {
            id: 29525396,
            width: 2400,
            height: 1350,
            pageUrl:
              "https://www.pexels.com/photo/red-tiled-house-roof-29525396/",
            photographer: "Roof Photographer",
            photographerUrl: "https://www.pexels.com/@roof/",
            alt: "Red tiled house roof under a clear sky",
            imageUrl:
              "https://images.pexels.com/photos/29525396/red-tiled-roof.jpeg",
          },
        ]),
      } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(result).toMatchObject({
      outcome: "replaced",
      selected: { id: 29525396 },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockImage: expect.objectContaining({ assetId: "29525396" }),
        }),
      }),
    );
  });

  it("keeps NO_ALTERNATIVE when the only distinct candidate is an explicit wrong-city landmark", async () => {
    const update = vi.fn();
    const result = await attachPexelsStockImageToPost({
      payload: { update, logger: { warn: vi.fn() } } as unknown as Payload,
      post: {
        id: 11,
        titleNo: "Takfornying i Oslo",
        primaryKeyword: "takfornying Oslo",
        stockImage: { provider: "pexels", assetId: "29114658" },
      },
      provider: {
        search: vi.fn(async () => [
          {
            id: 29525395,
            width: 2400,
            height: 1350,
            pageUrl:
              "https://www.pexels.com/photo/colorful-bryggen-buildings-in-bergen-norway-29525395/",
            photographer: "Fixture Photographer",
            photographerUrl: "https://www.pexels.com/@fixture/",
            alt: "Colorful historic buildings in Bryggen, Bergen under a bright blue sky.",
            imageUrl: "https://images.pexels.com/photos/29525395/bryggen.jpeg",
          },
        ]),
      } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "no_alternative",
      query: "Norwegian house roof tiles exterior",
      existingAssetId: "29114658",
    });
  });

  it("invalidates scheduled review evidence when an uploaded hero overrides matching stock metadata", async () => {
    const update = vi.fn(async (input) => ({ id: 24, ...input.data }));
    const result = await attachPexelsStockImageToPost({
      payload: { update, logger: { warn: vi.fn() } } as unknown as Payload,
      post: {
        id: 24,
        titleNo: "Takfornying",
        editorialStatus: "scheduled",
        imageAlt: "Pexels-bilde",
        heroImage: 999,
        stockImage: { provider: "pexels", assetId: "222" },
      },
      provider: {
        search: vi.fn(async () => [
          {
            id: 223,
            width: 2400,
            height: 1350,
            pageUrl: "https://www.pexels.com/photo/roof-223/",
            photographer: "Matching Metadata",
            photographerUrl: "https://www.pexels.com/@matching/",
            alt: "",
            imageUrl: "https://images.pexels.com/photos/223/roof.jpeg",
          },
        ]),
      } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          heroImage: null,
          editorialStatus: "human_review",
          qualityScore: null,
          qualityChecks: null,
          reviewerName: null,
          reviewedAt: null,
          scheduledAt: null,
          _status: "draft",
        }),
      }),
    );
    expect(expectReplacement(result).reviewInvalidated).toBe(true);
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
          imageAlt: "House roof",
          stockImage: expect.objectContaining({
            provider: "pexels",
            assetId: "456",
            imageUrl: selected.imageUrl,
            sourceUrl: selected.pageUrl,
          }),
        }),
      }),
    );
    expect(expectReplacement(result).media).toBeNull();
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
    expect(expectReplacement(result).media).toBeNull();
  });
});
