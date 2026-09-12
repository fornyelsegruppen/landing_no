import { describe, expect, it, vi } from "vitest";
import { PexelsStockImageProvider } from "./pexels-stock-image-provider";

function photoResponse(
  imageUrl = "https://images.pexels.com/photos/123/roof.jpeg",
) {
  return {
    total_results: 61,
    photos: [
      {
        id: 123,
        width: 2400,
        height: 1350,
        url: "https://www.pexels.com/photo/tiled-house-roof-123/",
        photographer: "Test Photographer",
        photographer_url: "https://www.pexels.com/@test-photographer/",
        alt: "Tiled house roof",
        src: {
          landscape: imageUrl,
          original: imageUrl,
        },
      },
    ],
  };
}

describe("Pexels stock image provider", () => {
  it("requires configuration without exposing a key", async () => {
    const provider = new PexelsStockImageProvider({});
    await expect(provider.search("house roof")).rejects.toThrow(
      "PEXELS_API_KEY mangler",
    );
  });

  it("keeps the API key in the authorization header and constructs bounded pages", async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json(photoResponse(), { status: 200 });
      },
    );
    const provider = new PexelsStockImageProvider(
      { PEXELS_API_KEY: "pexels-secret" },
      request as typeof fetch,
    );
    const page = await provider.searchPage("mossy tiled roof", {
      page: 2,
      perPage: 30,
    });
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).not.toContain("pexels-secret");
    expect(String(url)).toContain("page=2");
    expect(String(url)).toContain("per_page=30");
    expect(String(url)).not.toContain("size=");
    expect((options?.headers as Record<string, string>).Authorization).toBe(
      "pexels-secret",
    );
    expect(page).toMatchObject({ hasMore: true });
    expect(page.photos[0]).toMatchObject({
      id: 123,
      photographer: "Test Photographer",
    });
  });

  it("keeps hasMore from total results when landscape filtering leaves a page empty", async () => {
    const request = vi.fn(async () =>
      Response.json({
        total_results: 31,
        photos: [
          {
            id: 124,
            width: 1000,
            height: 1000,
            url: "https://www.pexels.com/photo/square-roof-124/",
            photographer: "Square Fixture",
            photographer_url: "https://www.pexels.com/@square-fixture/",
            alt: "Square roof image",
            src: { original: "https://images.pexels.com/photos/124/roof.jpeg" },
          },
        ],
      }),
    );
    const provider = new PexelsStockImageProvider(
      { PEXELS_API_KEY: "test" },
      request as typeof fetch,
    );

    await expect(provider.searchPage("house roof", { page: 1, perPage: 30 })).resolves.toEqual({
      photos: [],
      hasMore: true,
    });
  });

  it("rejects invalid page and per-page bounds before making a request", async () => {
    const request = vi.fn();
    const provider = new PexelsStockImageProvider(
      { PEXELS_API_KEY: "test" },
      request as typeof fetch,
    );

    await expect(provider.searchPage("house roof", { page: 0 })).rejects.toThrow("Pexels-siden er ugyldig");
    await expect(provider.searchPage("house roof", { page: 1.5 })).rejects.toThrow("Pexels-siden er ugyldig");
    await expect(provider.searchPage("house roof", { perPage: 0 })).rejects.toThrow("Pexels sideantall er ugyldig");
    await expect(provider.searchPage("house roof", { perPage: 81 })).rejects.toThrow("Pexels sideantall er ugyldig");
    await expect(provider.searchPage("house roof", { perPage: 1.5 })).rejects.toThrow("Pexels sideantall er ugyldig");
    expect(request).not.toHaveBeenCalled();
  });

  it("never follows a response next_page URL", async () => {
    const nextPage = "https://example.invalid/pexels-next-page";
    const request = vi.fn(async () => Response.json({ ...photoResponse(), next_page: nextPage }));
    const provider = new PexelsStockImageProvider(
      { PEXELS_API_KEY: "test" },
      request as typeof fetch,
    );

    await provider.searchPage("house roof", { page: 2, perPage: 30 });
    expect(request).toHaveBeenCalledOnce();
    expect(String(request.mock.calls[0]?.[0])).not.toContain(nextPage);
    expect(String(request.mock.calls[0]?.[0])).toContain("api.pexels.com/v1/search");
  });

  it("rejects image downloads outside the approved Pexels host", async () => {
    const request = vi.fn(async () =>
      Response.json(photoResponse("https://example.com/untrusted.jpg")),
    );
    const provider = new PexelsStockImageProvider(
      { PEXELS_API_KEY: "test" },
      request as typeof fetch,
    );
    await expect(provider.search("house roof")).rejects.toThrow(
      "approved Pexels image host",
    );
  });

  it("downloads only an allowed image type", async () => {
    const request = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/jpeg", "Content-Length": "3" },
        }),
    );
    const provider = new PexelsStockImageProvider(
      { PEXELS_API_KEY: "test" },
      request as typeof fetch,
    );
    const file = await provider.download({
      id: 123,
      width: 2400,
      height: 1350,
      pageUrl: "https://www.pexels.com/photo/roof-123/",
      photographer: "Test",
      photographerUrl: "https://www.pexels.com/@test/",
      alt: "Roof",
      imageUrl: "https://images.pexels.com/photos/123/roof.jpeg",
    });
    expect(file).toMatchObject({
      mimetype: "image/jpeg",
      name: "pexels-123.jpg",
      size: 3,
    });
  });
});
