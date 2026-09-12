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
import { blogServiceAreas } from "./knowledge-base";

describe("blog stock images", () => {
  function expectReplacement(result: StockImageReplacementResult) {
    expect(result.outcome).toBe("replaced");
    if (result.outcome !== "replaced") {
      throw new Error("Expected a distinct Pexels replacement");
    }
    return result;
  }

  function photo(id: number, overrides: Record<string, string> = {}) {
    return {
      id,
      width: 2400,
      height: 1350,
      pageUrl: `https://www.pexels.com/photo/roof-${id}/`,
      photographer: "Rotation Fixture",
      photographerUrl: "https://www.pexels.com/@rotation-fixture/",
      alt: "Neutral tiled house roof",
      imageUrl: `https://images.pexels.com/photos/${id}/roof.jpeg`,
      ...overrides,
    };
  }

  function payloadWithEmptyVersionHistory<T extends Record<string, unknown>>(
    payload: T,
  ) {
    return {
      findVersions: vi.fn(async () => ({ docs: [] })),
      ...payload,
    } as unknown as Payload;
  }

  function providerWithPage(
    search: () => Promise<ReturnType<typeof photo>[]>,
    download?: () => Promise<unknown>,
  ) {
    return {
      searchPage: vi.fn(async () => ({
        photos: await search(),
        hasMore: false,
      })),
      ...(download ? { download } : {}),
    } as unknown as PexelsStockImageProvider;
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
      payload: payloadWithEmptyVersionHistory({ create, update }),
      post: {
        id: 9,
        titleNo: "Takvask etter vinteren",
        ctaVariant: "wash",
        imageAlt: "Tak med mose i Oslo før vask",
        editorialStatus: "ai_qa",
      },
      provider: providerWithPage(search, download),
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
        context: expect.objectContaining({
          trustedBlogQualityRevalidation: true,
        }),
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
        payload: payloadWithEmptyVersionHistory({
          update,
          logger: { warn: vi.fn() },
        }),
        post: {
          id: 22,
          titleNo: "Takfornying",
          editorialStatus,
          imageAlt: "Pexels-bilde",
          stockImage: { provider: "pexels", assetId: "111" },
        },
        provider: providerWithPage(async () => [selected]),
        persistToMedia: false,
      });
      expect(
        update.mock.calls[0]?.[0].context.trustedBlogQualityRevalidation,
      ).toBe(false);
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
      payload: payloadWithEmptyVersionHistory({
        update,
        logger: { warn: vi.fn() },
      }),
      post: {
        id: 23,
        titleNo: "Takfornying",
        editorialStatus: "approved",
        imageAlt: "Red tiled roof",
        stockImage: { provider: "pexels", assetId: "654" },
      },
      provider: providerWithPage(async () => [
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
      payload: payloadWithEmptyVersionHistory({
        update,
        logger: { warn: vi.fn() },
      }),
      post: {
        id: 23,
        titleNo: "Takfornying",
        imageAlt: "Current roof",
        stockImage: { provider: "pexels", assetId: "654" },
      },
      provider: providerWithPage(async () => [
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
      payload: payloadWithEmptyVersionHistory({
        update,
        logger: { warn: vi.fn() },
      }),
      post: {
        id: 11,
        titleNo: "Takfornying i Oslo",
        primaryKeyword: "takfornying Oslo",
        stockImage: { provider: "pexels", assetId: "29114658" },
      },
      provider: providerWithPage(async () => [
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
      payload: payloadWithEmptyVersionHistory({
        update,
        logger: { warn: vi.fn() },
      }),
      post: {
        id: 11,
        titleNo: "Takfornying i Oslo",
        primaryKeyword: "takfornying Oslo",
        stockImage: { provider: "pexels", assetId: "29114658" },
      },
      provider: providerWithPage(async () => [
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
      persistToMedia: false,
    });

    expect(update).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "no_alternative",
      query: "Norwegian house roof tiles exterior",
      existingAssetId: "29114658",
    });
  });

  it("rotates through four recent-version-aware stock assets across reload-shaped requests", async () => {
    const versions = [
      { version: { stockImage: { provider: "pexels", assetId: "100" } } },
    ];
    const findVersions = vi.fn(async () => ({ docs: versions }));
    const update = vi.fn(async (input) => {
      versions.push({ version: { stockImage: input.data.stockImage } });
      return { id: 12, ...input.data };
    });
    const searchPage = vi.fn(async () => ({
      photos: [100, 101, 102, 103, 104].map((id) => photo(id)),
      hasMore: false,
    }));
    let post = {
      id: 12,
      titleNo: "Takfornying i Oslo",
      stockImage: { provider: "pexels", assetId: "100" },
    };
    const selectedIds: number[] = [];

    for (const expectedId of [101, 102, 103, 104]) {
      const result = await attachPexelsStockImageToPost({
        payload: {
          findVersions,
          update,
          logger: { warn: vi.fn() },
        } as unknown as Payload,
        post,
        provider: { searchPage } as unknown as PexelsStockImageProvider,
        persistToMedia: false,
      });
      const replacement = expectReplacement(result);
      selectedIds.push(replacement.selected.id);
      const nextStockImage = replacement.post.stockImage;
      if (
        nextStockImage?.provider !== "pexels" ||
        typeof nextStockImage.assetId !== "string"
      ) {
        throw new Error(
          "Expected the replacement post to retain a Pexels asset ID",
        );
      }
      post = {
        ...post,
        stockImage: {
          provider: nextStockImage.provider,
          assetId: nextStockImage.assetId,
        },
      };
      expect(replacement.reviewInvalidated).toBe(true);
      expect(expectedId).toBe(replacement.selected.id);
    }

    expect(selectedIds).toEqual([101, 102, 103, 104]);
    expect(new Set(selectedIds).size).toBe(4);
    expect(findVersions).toHaveBeenCalledTimes(4);
  });

  it("uses one cheap first page when it already contains an unused valid candidate", async () => {
    const update = vi.fn(async (input) => ({ id: 13, ...input.data }));
    const searchPage = vi.fn(async (_query, { page }: { page: number }) => {
      if (page === 1) {
        return { photos: [photo(100), photo(101), photo(103)], hasMore: true };
      }
      if (page === 2) {
        return {
          photos: [
            photo(101),
            photo(102, {
              alt: "Colorful historic buildings in Bryggen, Bergen",
              pageUrl: "https://www.pexels.com/photo/bryggen-bergen-102/",
            }),
          ],
          hasMore: true,
        };
      }
      return { photos: [photo(103)], hasMore: true };
    });
    const result = await attachPexelsStockImageToPost({
      payload: {
        findVersions: vi.fn(async () => ({
          docs: [
            { version: { stockImage: { provider: "pexels", assetId: "100" } } },
            { version: { stockImage: { provider: "pexels", assetId: "101" } } },
          ],
        })),
        update,
        logger: { warn: vi.fn() },
      } as unknown as Payload,
      post: {
        id: 13,
        titleNo: "Takfornying i Oslo",
        stockImage: { provider: "pexels", assetId: "101" },
      },
      provider: { searchPage } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(expectReplacement(result).selected.id).toBe(103);
    expect(searchPage).toHaveBeenCalledTimes(1);
    expect(searchPage.mock.calls.map(([, options]) => options.page)).toEqual([
      1,
    ]);
  });

  it("advances through page two and page three before selecting an unused candidate", async () => {
    const findVersions = vi.fn(async () => ({
      docs: [
        { version: { stockImage: { provider: "pexels", assetId: "100" } } },
        { version: { stockImage: { provider: "pexels", assetId: "101" } } },
      ],
    }));
    const update = vi.fn(async (input) => ({ id: 16, ...input.data }));
    const searchPage = vi.fn(async (_query, { page }: { page: number }) => ({
      photos: [photo(99 + page)],
      hasMore: true,
    }));

    const result = await attachPexelsStockImageToPost({
      payload: {
        findVersions,
        update,
        logger: { warn: vi.fn() },
      } as unknown as Payload,
      post: {
        id: 16,
        titleNo: "Takfornying i Oslo",
        stockImage: { provider: "pexels", assetId: "100" },
      },
      provider: { searchPage } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(expectReplacement(result).selected.id).toBe(102);
    expect(searchPage.mock.calls.map(([, options]) => options)).toEqual([
      { page: 1, perPage: 30 },
      { page: 2, perPage: 30 },
      { page: 3, perPage: 30 },
    ]);
    expect(findVersions).toHaveBeenCalledWith({
      collection: "posts",
      where: { parent: { equals: 16 } },
      sort: "-updatedAt",
      limit: 20,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });
  });

  it("caps an exhausted has-more result set at three pages without mutating the post", async () => {
    const update = vi.fn();
    const searchPage = vi.fn(async (_query, { page }: { page: number }) => ({
      photos: [photo(99 + page)],
      hasMore: true,
    }));
    const result = await attachPexelsStockImageToPost({
      payload: {
        findVersions: vi.fn(async () => ({
          docs: [
            { version: { stockImage: { provider: "pexels", assetId: "100" } } },
            { version: { stockImage: { provider: "pexels", assetId: "101" } } },
            { version: { stockImage: { provider: "pexels", assetId: "102" } } },
          ],
        })),
        update,
        logger: { warn: vi.fn() },
      } as unknown as Payload,
      post: {
        id: 17,
        titleNo: "Takfornying i Oslo",
        stockImage: { provider: "pexels", assetId: "102" },
      },
      provider: { searchPage } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(result).toEqual({
      outcome: "no_alternative",
      query: "Norwegian house roof tiles exterior",
      existingAssetId: "102",
    });
    expect(update).not.toHaveBeenCalled();
    expect(searchPage.mock.calls.map(([, options]) => options.page)).toEqual([
      1, 2, 3,
    ]);
  });

  it("keeps the post unchanged when all bounded-page candidates are exhausted", async () => {
    const update = vi.fn();
    const searchPage = vi.fn(async (_query, { page }: { page: number }) => ({
      photos: page === 1 ? [photo(100)] : [photo(101)],
      hasMore: page === 1,
    }));
    const result = await attachPexelsStockImageToPost({
      payload: {
        findVersions: vi.fn(async () => ({
          docs: [
            { version: { stockImage: { provider: "pexels", assetId: "100" } } },
            { version: { stockImage: { provider: "pexels", assetId: "101" } } },
          ],
        })),
        update,
        logger: { warn: vi.fn() },
      } as unknown as Payload,
      post: {
        id: 14,
        titleNo: "Takfornying i Oslo",
        stockImage: { provider: "pexels", assetId: "101" },
      },
      provider: { searchPage } as unknown as PexelsStockImageProvider,
      persistToMedia: false,
    });

    expect(result).toMatchObject({
      outcome: "no_alternative",
      existingAssetId: "101",
    });
    expect(update).not.toHaveBeenCalled();
    expect(searchPage).toHaveBeenCalledTimes(2);
  });

  it("fails before provider search when recent-version history cannot be read", async () => {
    const searchPage = vi.fn();
    const update = vi.fn();
    await expect(
      attachPexelsStockImageToPost({
        payload: {
          findVersions: vi.fn(async () => {
            throw new Error("versions unavailable");
          }),
          update,
          logger: { warn: vi.fn() },
        } as unknown as Payload,
        post: { id: 15, titleNo: "Takfornying i Oslo" },
        provider: { searchPage } as unknown as PexelsStockImageProvider,
        persistToMedia: false,
      }),
    ).rejects.toThrow("versions unavailable");
    expect(searchPage).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each(blogServiceAreas)(
    "rejects the exact Bergen landmark fixture for the %s Oslo service area",
    async (location) => {
      const update = vi.fn();
      const result = await attachPexelsStockImageToPost({
        payload: payloadWithEmptyVersionHistory({
          update,
          logger: { warn: vi.fn() },
        }),
        post: {
          id: 11,
          titleNo: `Takfornying i ${location}`,
          primaryKeyword: `takfornying ${location}`,
          stockImage: { provider: "pexels", assetId: "29114658" },
        },
        provider: providerWithPage(async () => [
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
        persistToMedia: false,
      });

      expect(update).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        outcome: "no_alternative",
        existingAssetId: "29114658",
      });
    },
  );

  it("rejects mixed Oslo and Bergen metadata instead of accepting one matching location", async () => {
    const update = vi.fn();
    const result = await attachPexelsStockImageToPost({
      payload: payloadWithEmptyVersionHistory({
        update,
        logger: { warn: vi.fn() },
      }),
      post: {
        id: 11,
        titleNo: "Takfornying i Oslo",
        primaryKeyword: "takfornying Oslo",
        stockImage: { provider: "pexels", assetId: "29114658" },
      },
      provider: providerWithPage(async () => [
        {
          id: 29525397,
          width: 2400,
          height: 1350,
          pageUrl:
            "https://www.pexels.com/photo/oslo-and-bergen-roof-view-29525397/",
          photographer: "Mixed Metadata Photographer",
          photographerUrl: "https://www.pexels.com/@mixed/",
          alt: "Oslo roof view with Bergen Bryggen buildings",
          imageUrl:
            "https://images.pexels.com/photos/29525397/mixed-metadata.jpeg",
        },
      ]),
      persistToMedia: false,
    });

    expect(update).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      outcome: "no_alternative",
      existingAssetId: "29114658",
    });
  });

  it("invalidates scheduled review evidence when an uploaded hero overrides matching stock metadata", async () => {
    const update = vi.fn(async (input) => ({ id: 24, ...input.data }));
    const result = await attachPexelsStockImageToPost({
      payload: payloadWithEmptyVersionHistory({
        update,
        logger: { warn: vi.fn() },
      }),
      post: {
        id: 24,
        titleNo: "Takfornying",
        editorialStatus: "scheduled",
        imageAlt: "Pexels-bilde",
        heroImage: 999,
        stockImage: { provider: "pexels", assetId: "222" },
      },
      provider: providerWithPage(async () => [
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
      payload: payloadWithEmptyVersionHistory({
        create,
        update,
        logger: { warn },
      }),
      post: {
        id: 12,
        titleNo: "Sjekk taket etter vinteren",
        ctaVariant: "assessment",
      },
      provider: providerWithPage(search, download),
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
      payload: payloadWithEmptyVersionHistory({
        create,
        update,
        logger: { warn },
      }),
      post: { id: 13, titleNo: "Takmaling", ctaVariant: "assessment" },
      provider: providerWithPage(async () => [selected], download),
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
