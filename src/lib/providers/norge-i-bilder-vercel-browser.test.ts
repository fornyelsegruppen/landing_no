import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  analyzeMapFrameReadiness,
  NorgeIBilderVercelBrowserRuntime,
  normalizeActualArcgisVisibleExtent,
} from "./norge-i-bilder-vercel-browser";

describe("Norge i bilder Vercel browser runtime", () => {
  const originalPackUrl = process.env.NORGE_I_BILDER_CHROMIUM_PACK_URL;

  afterEach(() => {
    if (originalPackUrl === undefined) {
      delete process.env.NORGE_I_BILDER_CHROMIUM_PACK_URL;
    } else {
      process.env.NORGE_I_BILDER_CHROMIUM_PACK_URL = originalPackUrl;
    }
  });

  it("fails before launching a browser when the approved Chromium pack is absent", async () => {
    delete process.env.NORGE_I_BILDER_CHROMIUM_PACK_URL;
    const runtime = new NorgeIBilderVercelBrowserRuntime();

    await expect(
      runtime.open({ viewport: { width: 1280, height: 720 } }),
    ).rejects.toThrow("NORGE_I_BILDER_CHROMIUM_PACK_URL");
  });

  it("rejects a non-HTTPS Chromium pack URL before launching a browser", async () => {
    const runtime = new NorgeIBilderVercelBrowserRuntime(
      "http://example.test/chromium-pack.tar",
    );

    await expect(
      runtime.open({ viewport: { width: 1280, height: 720 } }),
    ).rejects.toThrow("must use HTTPS");
  });

  it("rejects the viewer's initial blank canvas and accepts a painted map", async () => {
    const blank = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();
    const pixels = Buffer.alloc(320 * 180 * 3);
    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = (index * 31 + Math.floor(index / 17) * 19) % 256;
    }
    const painted = await sharp(pixels, {
      raw: { width: 320, height: 180, channels: 3 },
    })
      .png()
      .toBuffer();

    await expect(analyzeMapFrameReadiness(blank)).resolves.toMatchObject({
      ready: false,
    });
    await expect(analyzeMapFrameReadiness(painted)).resolves.toMatchObject({
      ready: true,
    });
  });

  it("registers only an explicitly EPSG:25833 ArcGIS extent", () => {
    expect(
      normalizeActualArcgisVisibleExtent({
        xmin: 262338.294,
        ymin: 6649146.086,
        xmax: 262434.294,
        ymax: 6649200.086,
        spatialReference: { latestWkid: 25833 },
      }),
    ).toEqual({
      crs: "EPSG:25833",
      bounds: {
        minEastingM: 262338.294,
        minNorthingM: 6649146.086,
        maxEastingM: 262434.294,
        maxNorthingM: 6649200.086,
      },
    });
    expect(
      normalizeActualArcgisVisibleExtent({
        xmin: 1,
        ymin: 2,
        xmax: 3,
        ymax: 4,
        spatialReference: { wkid: 3857 },
      }),
    ).toBeUndefined();
  });

  it("refuses an ArcGIS extent when it does not belong to the captured canvas", () => {
    expect(
      normalizeActualArcgisVisibleExtent(
        {
          xmin: 262338.294,
          ymin: 6649146.086,
          xmax: 262434.294,
          ymax: 6649200.086,
          spatialReference: { wkid: 25833 },
          viewWidth: 1024,
          viewHeight: 768,
        },
        { width: 1280, height: 720 },
      ),
    ).toBeUndefined();
  });
});
