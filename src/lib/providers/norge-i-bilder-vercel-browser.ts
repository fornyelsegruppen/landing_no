import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import type { Page } from "puppeteer-core";
import type {
  BrowserCaptureRuntime,
  BrowserCaptureSession,
  NorgeIBilderActualVisibleExtent,
  NorgeIBilderCaptureRequest,
  NorgeIBilderEpsg25833Bounds,
} from "./norge-i-bilder-capture-provider";

const NAVIGATION_TIMEOUT_MS = 12_000;
const MAP_READY_TIMEOUT_MS = 3_500;
const MAP_PAINT_SETTLE_MS = 700;
const MAP_FRAME_COMPARE_MS = 450;

type MapClip = { x: number; y: number; width: number; height: number };

type ArcGisExtentCandidate = {
  xmin?: unknown;
  ymin?: unknown;
  xmax?: unknown;
  ymax?: unknown;
  spatialReference?: { wkid?: unknown; latestWkid?: unknown };
  viewWidth?: unknown;
  viewHeight?: unknown;
};

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableRenderError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" ||
      /(?:navigation timeout|frame detached|net::err_|target closed)/i.test(
        error.message,
      ))
  );
}

type MapFrameReadiness = {
  entropy: number;
  ready: boolean;
  sample: Uint8Array;
  whiteRatio: number;
};

/** Rejects blank/partially painted canvases before they can become evidence. */
export async function analyzeMapFrameReadiness(
  image: Uint8Array,
): Promise<MapFrameReadiness> {
  const pipeline = sharp(image, { failOn: "error" });
  const stats = await pipeline.stats();
  const { data, info } = await pipeline
    .clone()
    .resize({ width: 64, height: 36, fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let whitePixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (
      data[offset] >= 245 &&
      data[offset + 1] >= 245 &&
      data[offset + 2] >= 245
    ) {
      whitePixels += 1;
    }
  }
  const pixelCount = data.length / info.channels;
  const whiteRatio = pixelCount ? whitePixels / pixelCount : 1;
  return {
    entropy: stats.entropy,
    ready: stats.entropy >= 3.5 && whiteRatio <= 0.35,
    sample: new Uint8Array(data),
    whiteRatio,
  };
}

function meanAbsoluteFrameDelta(left: Uint8Array, right: Uint8Array) {
  if (!left.length || left.length !== right.length) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return total / left.length;
}

/**
 * Converts only an explicitly EPSG:25833 ArcGIS view extent into a geometry
 * registration contract. The screenshot may still be stored when this is
 * unavailable, but callers must then treat it as contextual imagery only.
 */
export function normalizeActualArcgisVisibleExtent(
  candidate: ArcGisExtentCandidate | null | undefined,
  capturedClip?: Pick<MapClip, "width" | "height">,
): NorgeIBilderActualVisibleExtent | undefined {
  const wkid =
    candidate?.spatialReference?.latestWkid ??
    candidate?.spatialReference?.wkid;
  const values = [
    candidate?.xmin,
    candidate?.ymin,
    candidate?.xmax,
    candidate?.ymax,
  ];
  if (
    wkid !== 25833 ||
    values.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    return undefined;
  }
  if (
    capturedClip &&
    (typeof candidate?.viewWidth !== "number" ||
      typeof candidate.viewHeight !== "number" ||
      Math.abs(candidate.viewWidth - capturedClip.width) > 2 ||
      Math.abs(candidate.viewHeight - capturedClip.height) > 2)
  ) {
    return undefined;
  }
  const [minEastingM, minNorthingM, maxEastingM, maxNorthingM] =
    values as number[];
  if (maxEastingM <= minEastingM || maxNorthingM <= minNorthingM)
    return undefined;
  const bounds: NorgeIBilderEpsg25833Bounds = {
    minEastingM,
    minNorthingM,
    maxEastingM,
    maxNorthingM,
  };
  return { crs: "EPSG:25833", bounds };
}

/**
 * Finds the largest map-rendering canvas only. It intentionally does not use
 * a full-page screenshot, which would retain the website UI, search terms or
 * unrelated page controls in the stored case evidence.
 */
export class NorgeIBilderVercelBrowserRuntime implements BrowserCaptureRuntime {
  constructor(
    private readonly chromiumPackUrl = process.env.NORGE_I_BILDER_CHROMIUM_PACK_URL?.trim(),
  ) {}

  async open(input: {
    viewport: NorgeIBilderCaptureRequest["viewport"];
  }): Promise<BrowserCaptureSession> {
    if (!this.chromiumPackUrl) {
      throw new Error(
        "Norge i bilder capture is not configured: NORGE_I_BILDER_CHROMIUM_PACK_URL is required",
      );
    }
    let packUrl: URL;
    try {
      packUrl = new URL(this.chromiumPackUrl);
    } catch {
      throw new Error("Norge i bilder Chromium pack URL is invalid");
    }
    if (packUrl.protocol !== "https:") {
      throw new Error("Norge i bilder Chromium pack URL must use HTTPS");
    }

    // Norge i bilder uses the ArcGIS WebGL renderer. Sparticuz provides
    // SwiftShader specifically so WebGL can render on a serverless host.
    chromium.setGraphicsMode = true;
    const browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      defaultViewport: {
        width: input.viewport.width,
        height: input.viewport.height,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: input.viewport.width >= input.viewport.height,
        isMobile: false,
      },
      executablePath: await chromium.executablePath(packUrl.toString()),
      headless: "shell",
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    page.setDefaultTimeout(MAP_READY_TIMEOUT_MS);
    await page.setUserAgent("Takfornyelse-NorgeIBilder-Capture/1.0 (+https://www.takfornyelse.as)");

    let closed = false;
    let loadedUrl: string | undefined;
    return {
      async capture(url) {
        try {
          const requestedUrl = url.toString();
          if (loadedUrl !== requestedUrl) {
            await page.goto(requestedUrl, {
              waitUntil: "domcontentloaded",
              timeout: NAVIGATION_TIMEOUT_MS,
            });
            loadedUrl = requestedUrl;
          }
          const clip = await findMapCanvasClip(page);
          if (!clip) return { kind: "tiles_not_ready" };
          // Canvas existence alone is not readiness: the viewer initially
          // paints an almost-white frame before its orthophoto tiles arrive.
          await wait(MAP_PAINT_SETTLE_MS);
          const firstImage = new Uint8Array(
            await page.screenshot({
              type: "png",
              clip,
              captureBeyondViewport: false,
              optimizeForSpeed: true,
            }),
          );
          const first = await analyzeMapFrameReadiness(firstImage);
          if (!first.ready) return { kind: "tiles_not_ready" };
          await wait(MAP_FRAME_COMPARE_MS);
          const image = new Uint8Array(
            await page.screenshot({
              type: "png",
              clip,
              captureBeyondViewport: false,
              optimizeForSpeed: true,
            }),
          );
          const second = await analyzeMapFrameReadiness(image);
          if (
            !second.ready ||
            meanAbsoluteFrameDelta(first.sample, second.sample) > 3
          ) {
            return { kind: "tiles_not_ready" };
          }
          return {
            kind: "captured",
            image,
            contentType: "image/png",
            actualVisibleExtent: await readActualArcgisVisibleExtent(
              page,
              clip,
            ),
          };
        } catch (error) {
          if (page.isClosed()) loadedUrl = undefined;
          if (isRetryableRenderError(error)) {
            return {
              kind: "tiles_not_ready",
              detail: error instanceof Error ? error.message : undefined,
            };
          }
          return {
            kind: "failed",
            detail: error instanceof Error ? error.message : "Browser capture failed",
          };
        }
      },
      async close() {
        if (closed) return;
        closed = true;
        await browser.close();
      },
    };
  }
}

/**
 * ArcGIS exposes the active View extent on its map web component. This probes
 * only that public in-page state; it does not request map tiles or services.
 */
async function readActualArcgisVisibleExtent(
  page: Page,
  clip: MapClip,
): Promise<NorgeIBilderActualVisibleExtent | undefined> {
  try {
    const candidate = await page.evaluate(() => {
      type ArcGisMapElement = Element & {
        extent?: ArcGisExtentCandidate;
        view?: {
          extent?: ArcGisExtentCandidate;
          width?: unknown;
          height?: unknown;
        };
      };
      const containers = Array.from(
        document.querySelectorAll(
          "arcgis-map, #arcgis-map, [aria-label='arcgis-map']",
        ),
      );
      const roots = containers.flatMap((container) => {
        const nested = [
          ...Array.from(container.querySelectorAll("arcgis-map")),
          ...Array.from(
            container.shadowRoot?.querySelectorAll("arcgis-map") || [],
          ),
        ];
        return [container, ...nested];
      }) as ArcGisMapElement[];
      for (const root of roots) {
        const extent = root.view?.extent ?? root.extent;
        const viewWidth = root.view?.width;
        const viewHeight = root.view?.height;
        if (extent) {
          return {
            xmin: extent.xmin,
            ymin: extent.ymin,
            xmax: extent.xmax,
            ymax: extent.ymax,
            spatialReference: extent.spatialReference
              ? {
                  wkid: extent.spatialReference.wkid,
                  latestWkid: extent.spatialReference.latestWkid,
                }
              : undefined,
            viewWidth,
            viewHeight,
          };
        }
      }
      return null;
    });
    return normalizeActualArcgisVisibleExtent(candidate, clip);
  } catch {
    return undefined;
  }
}

async function findMapCanvasClip(page: Page): Promise<MapClip | null> {
  try {
    await page.waitForFunction(
      () => {
        const root =
          document.getElementById("arcgis-map") ||
          document.querySelector('[aria-label="arcgis-map"]');
        const canvasRoot = root?.shadowRoot || root;
        return Array.from(canvasRoot?.querySelectorAll("canvas") || []).some((canvas) => {
          const rect = canvas.getBoundingClientRect();
          const style = getComputedStyle(canvas);
          return (
            rect.width >= 120 &&
            rect.height >= 120 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        });
      },
      { timeout: MAP_READY_TIMEOUT_MS },
    );
  } catch {
    return null;
  }
  return page.evaluate(() => {
    const root =
      document.getElementById("arcgis-map") ||
      document.querySelector('[aria-label="arcgis-map"]');
    const canvasRoot = root?.shadowRoot || root;
    const candidates = Array.from(canvasRoot?.querySelectorAll("canvas") || [])
      .map((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const style = getComputedStyle(canvas);
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          visible:
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            Number(style.opacity || "1") > 0,
        };
      })
      .filter(
        (candidate) =>
          candidate.visible && candidate.width >= 120 && candidate.height >= 120,
      )
      .sort(
        (left, right) =>
          right.width * right.height - left.width * left.height,
      );
    const candidate = candidates[0];
    if (!candidate) return null;
    return {
      x: Math.max(0, Math.floor(candidate.x)),
      y: Math.max(0, Math.floor(candidate.y)),
      width: Math.floor(candidate.width),
      height: Math.floor(candidate.height),
    };
  });
}
