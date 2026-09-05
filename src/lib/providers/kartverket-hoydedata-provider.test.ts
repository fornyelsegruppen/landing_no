import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  etrs89ToUtm33,
  KartverketHeightDataError,
  KartverketHeightDataProvider,
} from "./kartverket-hoydedata-provider";

const polygon = [
  { latitude: 59.9113, longitude: 10.7493 },
  { latitude: 59.9113, longitude: 10.7495 },
  { latitude: 59.91145, longitude: 10.7495 },
  { latitude: 59.91145, longitude: 10.7493 },
];

async function constantTiff(width: number, height: number, value: number) {
  return sharp(Buffer.alloc(width * height, value), {
    raw: { width, height, channels: 1 },
  })
    .tiff({ compression: "lzw" })
    .toBuffer();
}

describe("Kartverket Høydedata provider", () => {
  it("projects ETRS89 coordinates into the national UTM33 grid", () => {
    const point = etrs89ToUtm33({
      latitude: 59.91137749505985,
      longitude: 10.749403964838672,
    });
    expect(point.eastingM).toBeCloseTo(262_386.294, 1);
    expect(point.northingM).toBeCloseTo(6_649_173.086, 1);
  });

  it("retrieves matching DOM and DTM GeoTIFF grids and normalizes height", async () => {
    const urls: URL[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      const width = Number(url.searchParams.get("width"));
      const height = Number(url.searchParams.get("height"));
      const value = url.searchParams.get("coverage")?.includes("_dom_")
        ? 20
        : 5;
      const body = await constantTiff(width, height, value);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "image/tiff",
          "Content-Length": String(body.byteLength),
        },
      });
    };
    const result = await new KartverketHeightDataProvider(
      fetcher as typeof fetch,
      "https://example.test/wcs-dom",
      "https://example.test/wcs-dtm",
    ).getSurface({ polygon, retrievedAt: "2026-09-02T12:00:00.000Z" });

    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.searchParams.get("service")).toBe("WCS");
      expect(url.searchParams.get("version")).toBe("1.0.0");
      expect(url.searchParams.get("format")).toBe("GeoTIFF");
      expect(url.searchParams.get("crs")).toBe("EPSG:25833");
      expect(Number(url.searchParams.get("width"))).toBeLessThanOrEqual(256);
      expect(Number(url.searchParams.get("height"))).toBeLessThanOrEqual(256);
    }
    expect(result).toMatchObject({
      schemaVersion: "kartverket-height-surface.v1",
      coordinateSystem: "EPSG:25833",
      quality: {
        status: "usable",
        coverageRatio: 1,
        maxHeightAboveTerrainM: 15,
      },
      provenance: {
        retrievedAt: "2026-09-02T12:00:00.000Z",
        attribution: "Kartverket",
        license: "Norsk lisens for offentlige data (NLOD) 2.0",
      },
    });
    expect(
      result.values.heightAboveTerrainM.every((value) => value === 15),
    ).toBe(true);
  });

  it.each(["network", "abort", "429", "503"] as const)(
    "retries each DOM/DTM read once for a transient %s failure and uses no-store",
    async (failure) => {
      const attempts = new Map<string, number>();
      const fetcher = async (
        input: RequestInfo | URL,
        init?: RequestInit & { next?: unknown },
      ) => {
        const url = new URL(String(input));
        const coverage = url.searchParams.get("coverage") ?? "unknown";
        const attempt = (attempts.get(coverage) ?? 0) + 1;
        attempts.set(coverage, attempt);
        expect(init?.cache).toBe("no-store");
        expect(init?.next).toBeUndefined();
        if (attempt === 1) {
          if (failure === "network") throw new TypeError("socket reset");
          if (failure === "abort") {
            throw new DOMException("request timed out", "AbortError");
          }
          return new Response("temporary", { status: Number(failure) });
        }
        const width = Number(url.searchParams.get("width"));
        const height = Number(url.searchParams.get("height"));
        const body = await constantTiff(
          width,
          height,
          coverage.includes("_dom_") ? 20 : 5,
        );
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "image/tiff" },
        });
      };

      await expect(
        new KartverketHeightDataProvider(fetcher as typeof fetch).getSurface({
          polygon,
          cacheMode: "no-store",
          deadlineAtMs: Date.now() + 5_000,
        }),
      ).resolves.toMatchObject({ quality: { coverageRatio: 1 } });
      expect([...attempts.values()]).toEqual([2, 2]);
    },
  );

  it.each([
    "400",
    "404",
    "xml",
    "oversized",
    "invalid_tiff",
    "non_transport_error",
  ] as const)("does not retry a non-retriable %s response", async (failure) => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      if (failure === "non_transport_error") {
        throw new Error("unexpected client failure");
      }
      if (failure === "400" || failure === "404")
        return new Response("bad request", { status: Number(failure) });
      if (failure === "xml") {
        return new Response("<ServiceExceptionReport />", {
          status: 200,
          headers: { "Content-Type": "application/vnd.ogc.se_xml" },
        });
      }
      if (failure === "oversized") {
        return new Response(new Uint8Array([1]), {
          status: 200,
          headers: {
            "Content-Type": "image/tiff",
            "Content-Length": "2000001",
          },
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/tiff" },
      });
    };
    await expect(
      new KartverketHeightDataProvider(fetcher as typeof fetch).getSurface({
        polygon,
        cacheMode: "no-store",
      }),
    ).rejects.toBeInstanceOf(KartverketHeightDataError);
    expect(calls).toBe(2);
  });

  it("does not start a retry after the action budget is exhausted", async () => {
    let calls = 0;
    const provider = new KartverketHeightDataProvider((async () => {
      calls += 1;
      throw new TypeError("must not be called");
    }) as typeof fetch);
    await expect(
      provider.getSurface({ polygon, deadlineAtMs: Date.now() - 1 }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(calls).toBe(0);
  });

  it("fails closed when a status-200 WCS exception is returned", async () => {
    const provider = new KartverketHeightDataProvider(
      (async () =>
        new Response("<ServiceExceptionReport />", {
          status: 200,
          headers: { "Content-Type": "application/vnd.ogc.se_xml" },
        })) as typeof fetch,
    );
    await expect(provider.getSurface({ polygon })).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE",
    });
  });

  it("rejects out-of-scope coordinates before contacting Kartverket", async () => {
    let called = false;
    const provider = new KartverketHeightDataProvider((async () => {
      called = true;
      throw new Error("must not be called");
    }) as typeof fetch);
    await expect(
      provider.getSurface({
        polygon: [
          { latitude: 54, longitude: 10 },
          { latitude: 54.1, longitude: 10 },
          { latitude: 54, longitude: 10.1 },
        ],
      }),
    ).rejects.toBeInstanceOf(KartverketHeightDataError);
    expect(called).toBe(false);
  });

  it("caps roof requests at a 256 by 256 grid", async () => {
    const provider = new KartverketHeightDataProvider((async () => {
      throw new Error("must not be called");
    }) as typeof fetch);
    await expect(
      provider.getSurface({
        polygon: [
          { latitude: 59.9, longitude: 10.7 },
          { latitude: 59.9, longitude: 10.72 },
          { latitude: 59.91, longitude: 10.72 },
        ],
      }),
    ).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE" });
  });
});
