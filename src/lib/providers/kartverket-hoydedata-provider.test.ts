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
