import sharp from "sharp";
import {
  NORGE_I_BILDER_EXACT_ATTRIBUTION,
  NORGE_I_BILDER_SCREENSHOT_SOURCE,
} from "@/lib/measurements/evidence-policy";

/**
 * Contract guard for the written Kartverket permission held by
 * Fornyelse Gruppen AS (September 2026). This module deliberately does not
 * know about WMS/WMTS and rejects URLs that look like an OGC service.
 *
 * A production BrowserCaptureRuntime must run in an approved, authenticated
 * browser worker. Vercel request handlers must not impersonate a browser or
 * turn this into a background crawler.
 */
export const NORGE_I_BILDER_ATTRIBUTION = NORGE_I_BILDER_EXACT_ATTRIBUTION;
export const NORGE_I_BILDER_MAX_ATTEMPTS = 10;
export const NORGE_I_BILDER_MAX_DAILY_CAPTURES = 1_000;
export const NORGE_I_BILDER_MAX_MONTHLY_CAPTURES = 30_000;
export const NORGE_I_BILDER_MAX_WIDTH = 3_840;
export const NORGE_I_BILDER_MAX_HEIGHT = 2_160;
export const NORGE_I_BILDER_MAX_IMAGE_BYTES = 12_000_000;

const ALLOWED_HOSTS = new Set(["norgeibilder.no", "www.norgeibilder.no"]);

export type NorgeIBilderCaptureRequest = {
  /** Stable internal case ID; a capture cannot be made outside a concrete case. */
  caseId: string;
  /** The authenticated employee who pressed the button. */
  employeeId: string;
  /** A server-issued, single-use identifier for that explicit click. */
  clickId: string;
  triggeredAt: string;
  target: {
    latitude: number;
    longitude: number;
    addressLabel?: string;
  };
  viewport: {
    width: number;
    height: number;
  };
};

export type NorgeIBilderEpsg25833Bounds = {
  minEastingM: number;
  minNorthingM: number;
  maxEastingM: number;
  maxNorthingM: number;
};

/** Maps pixel coordinates in the final, cropped image to its source extent. */
export type NorgeIBilderGeoReference = {
  crs: "EPSG:25833";
  /**
   * Only a browser-observed ArcGIS extent may register an image for geometry
   * overlay. URL query bounds are merely a navigation hint and must never be
   * used as if they describe the final rendered canvas.
   */
  extentTrust: "actual-visible-extent";
  bounds: NorgeIBilderEpsg25833Bounds;
  imageWidth: number;
  imageHeight: number;
};

export type NorgeIBilderActualVisibleExtent = {
  crs: "EPSG:25833";
  bounds: NorgeIBilderEpsg25833Bounds;
};

export type BrowserCaptureResult =
  | { kind: "tiles_not_ready"; detail?: string }
  | { kind: "failed"; detail?: string }
  | {
      kind: "captured";
      image: Uint8Array;
      contentType: "image/png" | "image/jpeg" | "image/webp";
      /**
       * The ArcGIS view extent observed from the rendered interactive page.
       * Omit it when the browser cannot prove the captured canvas extent;
       * the screenshot remains contextual evidence but is not overlay-safe.
       */
      actualVisibleExtent?: NorgeIBilderActualVisibleExtent;
    };

export interface NorgeIBilderUrlBuilder {
  /**
   * Return the official interactive Norge i bilder page for one coordinate.
   * The actual documented deep-link format is injected instead of guessed.
   */
  build(input: Pick<NorgeIBilderCaptureRequest, "target" | "viewport">): {
    bounds: NorgeIBilderEpsg25833Bounds;
    url: URL;
  };
}

export interface BrowserCaptureRuntime {
  /**
   * Opens exactly one browser lifecycle for a user-triggered case capture.
   * A retry must reuse the returned session rather than creating a crawler
   * browser process for every attempt.
   */
  open(input: {
    viewport: NorgeIBilderCaptureRequest["viewport"];
  }): Promise<BrowserCaptureSession>;
}

export interface BrowserCaptureSession {
  /** Takes one map-only viewport screenshot from the trusted interactive page. */
  capture(url: URL): Promise<BrowserCaptureResult>;
  /** Must be idempotent and is always called by the provider's finally block. */
  close(): Promise<void>;
}

export type CaptureReservation = { id: string };

export interface NorgeIBilderCaptureLedger {
  /**
   * Atomically verifies that clickId has not been used, that this is an
   * employee-triggered case capture, and that daily/monthly limits permit it.
   * Implement this with durable shared storage in production; an in-memory
   * counter is not safe for serverless deployments.
   */
  reserve(input: {
    caseId: string;
    employeeId: string;
    clickId: string;
    triggeredAt: string;
    dailyLimit: number;
    monthlyLimit: number;
  }): Promise<
    | { allowed: true; reservation: CaptureReservation }
    | {
        allowed: false;
        reason: string;
      }
  >;
  recordAttempt(input: {
    reservation: CaptureReservation;
    attempt: number;
    outcome: BrowserCaptureResult["kind"];
  }): Promise<void>;
  finalize(input: {
    reservation: CaptureReservation;
    outcome: "captured" | "failed";
  }): Promise<void>;
}

export interface NorgeIBilderFinalImageStore {
  /** Stores only the final successful single-frame capture with its attribution. */
  saveFinal(input: {
    /** Must be an idempotency key in the final-media store. */
    captureId: string;
    caseId: string;
    image: Uint8Array;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    attribution: typeof NORGE_I_BILDER_ATTRIBUTION;
    source: typeof NORGE_I_BILDER_SCREENSHOT_SOURCE;
    capturedAt: string;
    coordinates: NorgeIBilderCaptureRequest["target"];
    trainingProhibited: true;
  }): Promise<{ mediaId: string }>;
}

export class NorgeIBilderCaptureError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "POLICY_DENIED"
      | "UNTRUSTED_SOURCE_URL"
      | "INVALID_CAPTURE"
      | "CAPTURE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "NorgeIBilderCaptureError";
  }
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

function assertRequest(input: NorgeIBilderCaptureRequest) {
  if (
    !input.caseId.trim() ||
    !input.employeeId.trim() ||
    !input.clickId.trim() ||
    !Number.isFinite(Date.parse(input.triggeredAt))
  ) {
    throw new NorgeIBilderCaptureError(
      "INVALID_REQUEST",
      "A concrete case, employee, single-use click and timestamp are required",
    );
  }
  if (
    !isFiniteNumber(input.target.latitude) ||
    !isFiniteNumber(input.target.longitude) ||
    input.target.latitude < 57 ||
    input.target.latitude > 72 ||
    input.target.longitude < 4 ||
    input.target.longitude > 32
  ) {
    throw new NorgeIBilderCaptureError(
      "INVALID_REQUEST",
      "Norge i bilder capture coordinates must be inside Norway",
    );
  }
  if (
    !Number.isInteger(input.viewport.width) ||
    !Number.isInteger(input.viewport.height) ||
    input.viewport.width < 1 ||
    input.viewport.height < 1 ||
    input.viewport.width > NORGE_I_BILDER_MAX_WIDTH ||
    input.viewport.height > NORGE_I_BILDER_MAX_HEIGHT
  ) {
    throw new NorgeIBilderCaptureError(
      "INVALID_REQUEST",
      `Capture viewport must be no larger than ${NORGE_I_BILDER_MAX_WIDTH}x${NORGE_I_BILDER_MAX_HEIGHT}`,
    );
  }
}

function assertInteractiveNorgeIBilderUrl(url: URL) {
  const protocol = url.protocol.toLowerCase();
  const joined = `${url.pathname}?${url.search}`.toLowerCase();
  if (
    protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
    /(?:wms|wmts|service=|request=getmap|getcapabilities|tile)/.test(joined)
  ) {
    throw new NorgeIBilderCaptureError(
      "UNTRUSTED_SOURCE_URL",
      "Capture is limited to the interactive norgeibilder.no page; OGC services are forbidden",
    );
  }
}

async function assertImageWithinContract(input: {
  image: Uint8Array;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  viewport: NorgeIBilderCaptureRequest["viewport"];
}): Promise<{ imageWidth: number; imageHeight: number }> {
  if (
    input.image.byteLength === 0 ||
    input.image.byteLength > NORGE_I_BILDER_MAX_IMAGE_BYTES
  ) {
    throw new NorgeIBilderCaptureError(
      "INVALID_CAPTURE",
      "Captured image is empty or exceeds the safe single-image size",
    );
  }
  try {
    const metadata = await sharp(input.image, {
      failOn: "error",
      limitInputPixels: NORGE_I_BILDER_MAX_WIDTH * NORGE_I_BILDER_MAX_HEIGHT,
    }).metadata();
    const formatToMime = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    } as const;
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > NORGE_I_BILDER_MAX_WIDTH ||
      metadata.height > NORGE_I_BILDER_MAX_HEIGHT ||
      metadata.width > input.viewport.width ||
      metadata.height > input.viewport.height ||
      Math.abs(
        metadata.width / metadata.height -
          input.viewport.width / input.viewport.height,
      ) > 0.002 ||
      formatToMime[metadata.format as keyof typeof formatToMime] !==
        input.contentType
    ) {
      throw new Error("unexpected screenshot dimensions or MIME type");
    }
    return { imageWidth: metadata.width, imageHeight: metadata.height };
  } catch (error) {
    throw new NorgeIBilderCaptureError(
      "INVALID_CAPTURE",
      `Captured data is not an allowed single screenshot${error instanceof Error ? `: ${error.message}` : ""}`,
    );
  }
}

export class NorgeIBilderCaptureProvider {
  constructor(
    private readonly dependencies: {
      urlBuilder: NorgeIBilderUrlBuilder;
      browser: BrowserCaptureRuntime;
      ledger: NorgeIBilderCaptureLedger;
      store: NorgeIBilderFinalImageStore;
    },
  ) {}

  async capture(input: NorgeIBilderCaptureRequest): Promise<{
    capturedAt: string;
    mediaId: string;
    attribution: typeof NORGE_I_BILDER_ATTRIBUTION;
    source: typeof NORGE_I_BILDER_SCREENSHOT_SOURCE;
    attempts: number;
    /** Absent unless the browser proved the final canvas' visible extent. */
    geoReference?: NorgeIBilderGeoReference;
  }> {
    assertRequest(input);
    const interactiveCapture = this.dependencies.urlBuilder.build({
      target: input.target,
      viewport: input.viewport,
    });
    assertInteractiveNorgeIBilderUrl(interactiveCapture.url);

    const reservationResult = await this.dependencies.ledger.reserve({
      caseId: input.caseId,
      employeeId: input.employeeId,
      clickId: input.clickId,
      triggeredAt: input.triggeredAt,
      dailyLimit: NORGE_I_BILDER_MAX_DAILY_CAPTURES,
      monthlyLimit: NORGE_I_BILDER_MAX_MONTHLY_CAPTURES,
    });
    if (!reservationResult.allowed) {
      throw new NorgeIBilderCaptureError(
        "POLICY_DENIED",
        reservationResult.reason,
      );
    }
    const reservation = reservationResult.reservation;
    let finalized = false;
    const finalize = async (outcome: "captured" | "failed") => {
      if (finalized) return;
      await this.dependencies.ledger.finalize({ reservation, outcome });
      finalized = true;
    };

    let session: BrowserCaptureSession | undefined;
    try {
      session = await this.dependencies.browser.open({
        viewport: input.viewport,
      });
      for (
        let attempt = 1;
        attempt <= NORGE_I_BILDER_MAX_ATTEMPTS;
        attempt += 1
      ) {
        const capture = await session.capture(interactiveCapture.url);
        await this.dependencies.ledger.recordAttempt({
          reservation,
          attempt,
          outcome: capture.kind,
        });
        if (capture.kind === "tiles_not_ready") continue;
        if (capture.kind === "failed") {
          throw new NorgeIBilderCaptureError(
            "CAPTURE_FAILED",
            capture.detail || "Norge i bilder capture failed",
          );
        }

        const imageDimensions = await assertImageWithinContract({
          image: capture.image,
          contentType: capture.contentType,
          viewport: input.viewport,
        });
        const capturedAt = new Date().toISOString();
        const stored = await this.dependencies.store.saveFinal({
          captureId: reservation.id,
          caseId: input.caseId,
          image: capture.image,
          contentType: capture.contentType,
          attribution: NORGE_I_BILDER_ATTRIBUTION,
          source: NORGE_I_BILDER_SCREENSHOT_SOURCE,
          capturedAt,
          coordinates: input.target,
          trainingProhibited: true,
        });
        await finalize("captured");
        return {
          mediaId: stored.mediaId,
          capturedAt,
          attribution: NORGE_I_BILDER_ATTRIBUTION,
          source: NORGE_I_BILDER_SCREENSHOT_SOURCE,
          attempts: attempt,
          geoReference: capture.actualVisibleExtent
            ? {
                ...capture.actualVisibleExtent,
                extentTrust: "actual-visible-extent",
                ...imageDimensions,
              }
            : undefined,
        };
      }
      throw new NorgeIBilderCaptureError(
        "CAPTURE_FAILED",
        `Norge i bilder tiles were not ready after ${NORGE_I_BILDER_MAX_ATTEMPTS} attempts`,
      );
    } catch (error) {
      await finalize("failed");
      throw error;
    } finally {
      // Closing must not turn an already persisted, audited single frame into
      // a client-visible failure that invites a duplicate user capture.
      await session?.close().catch(() => undefined);
    }
  }
}
