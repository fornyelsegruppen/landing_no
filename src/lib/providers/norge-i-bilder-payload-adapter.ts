import sharp from "sharp";
import type { Payload } from "payload";
import { createPrivateMedia } from "@/lib/private-media-storage";
import { rateLimit } from "@/lib/rate-limit";
import { NORGE_I_BILDER_SCREENSHOT_SOURCE } from "@/lib/measurements/evidence-policy";
import {
  type BrowserCaptureResult,
  type CaptureReservation,
  type NorgeIBilderCaptureLedger,
  type NorgeIBilderFinalImageStore,
  NORGE_I_BILDER_ATTRIBUTION,
} from "./norge-i-bilder-capture-provider";

const DAY_SECONDS = 2 * 24 * 60 * 60;
const MONTH_SECONDS = 35 * 24 * 60 * 60;

function requireDurableRateLimit() {
  if (!process.env.NORGE_I_BILDER_CAPTURE_APPROVAL_REFERENCE?.trim()) {
    throw new Error(
      "Norge i bilder capture is unavailable until the written approval reference is recorded",
    );
  }
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Norge i bilder capture is unavailable until durable Upstash/KV rate limiting is configured",
    );
  }
}

function periodKeys(triggeredAt: string) {
  const date = new Date(triggeredAt);
  const daily = date.toISOString().slice(0, 10);
  return { daily, monthly: daily.slice(0, 7) };
}

/**
 * A shared-store ledger. It reserves capacity before launching Chromium, so a
 * failed map render consumes quota conservatively rather than enabling a retry
 * loop to become untracked source traffic.
 */
export class UpstashNorgeIBilderCaptureLedger implements NorgeIBilderCaptureLedger {
  async reserve(input: {
    caseId: string;
    employeeId: string;
    clickId: string;
    triggeredAt: string;
    dailyLimit: number;
    monthlyLimit: number;
  }) {
    requireDurableRateLimit();
    const { daily, monthly } = periodKeys(input.triggeredAt);
    // The click ID is supplied by the same-origin UI and retained for 31 days
    // so a transport retry cannot launch a second browser lifecycle.
    const click = await rateLimit("norge-i-bilder-click", input.clickId, {
      limit: 1,
      windowSec: MONTH_SECONDS,
    });
    if (!click.success) {
      return { allowed: false as const, reason: "This employee click has already been used" };
    }
    const caseBurst = await rateLimit(
      "norge-i-bilder-case-burst",
      input.caseId,
      { limit: 1, windowSec: 15 },
    );
    if (!caseBurst.success) {
      return { allowed: false as const, reason: "A capture is already in progress for this case" };
    }
    const day = await rateLimit("norge-i-bilder-day", daily, {
      limit: input.dailyLimit,
      windowSec: DAY_SECONDS,
    });
    if (!day.success) {
      return { allowed: false as const, reason: "Daily Norge i bilder capture limit reached" };
    }
    const month = await rateLimit("norge-i-bilder-month", monthly, {
      limit: input.monthlyLimit,
      windowSec: MONTH_SECONDS,
    });
    if (!month.success) {
      return { allowed: false as const, reason: "Monthly Norge i bilder capture limit reached" };
    }
    return { allowed: true as const, reservation: { id: input.clickId } };
  }

  async recordAttempt(input: {
    reservation: CaptureReservation;
    attempt: number;
    outcome: BrowserCaptureResult["kind"];
  }) {
    // The successful file plus route audit event are durable evidence. Do not
    // persist failed image bytes or browser/page payloads.
    void input;
  }

  async finalize(input: {
    reservation: CaptureReservation;
    outcome: "captured" | "failed";
  }) {
    void input;
  }
}

function watermarkSvg(width: number, height: number) {
  const fontSize = Math.max(16, Math.min(28, Math.round(width / 80)));
  const padding = Math.max(10, Math.round(fontSize * 0.65));
  const label = NORGE_I_BILDER_ATTRIBUTION;
  const labelWidth = Math.round(label.length * fontSize * 0.63);
  const boxWidth = Math.min(width, labelWidth + padding * 2);
  const boxHeight = fontSize + padding * 2;
  const x = Math.max(0, width - boxWidth - padding);
  const y = Math.max(0, height - boxHeight - padding);
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(padding / 2)}" fill="#000" fill-opacity="0.78"/><text x="${x + padding}" y="${y + padding + fontSize - 2}" fill="#fff" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700">${label}</text></svg>`,
  );
}

/** Exposed for image-level verification; all stored capture files are PNG. */
export async function burnNorgeIBilderAttribution(image: Uint8Array) {
  const source = sharp(image, { failOn: "error" });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Norge i bilder screenshot metadata is incomplete");
  }
  return source
    .composite([{ input: watermarkSvg(metadata.width, metadata.height), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** The only private-media ownership shape accepted for screenshot evidence. */
export function norgeIBilderCapturePrivateMediaDescriptor(
  leadCaseId: string,
  captureId: string,
) {
  if (!/^lead-[1-9][0-9]*$/.test(leadCaseId)) {
    throw new Error("Norge i bilder capture requires a canonical lead case ID");
  }
  if (!/^[a-zA-Z0-9._:-]{1,160}$/.test(captureId)) {
    throw new Error("Norge i bilder capture ID is invalid");
  }
  return {
    classification: "measurement" as const,
    ownerType: "norge-i-bilder-capture",
    ownerId: leadCaseId,
    alt: `Norge i bilder screenshot — ${NORGE_I_BILDER_ATTRIBUTION}`,
    filename: `${NORGE_I_BILDER_SCREENSHOT_SOURCE}-${captureId}.png`,
  };
}

export class PayloadNorgeIBilderFinalImageStore implements NorgeIBilderFinalImageStore {
  constructor(private readonly payload: Payload) {}

  async saveFinal(input: Parameters<NorgeIBilderFinalImageStore["saveFinal"]>[0]) {
    const image = await burnNorgeIBilderAttribution(input.image);
    const descriptor = norgeIBilderCapturePrivateMediaDescriptor(
      input.caseId,
      input.captureId,
    );
    const media = await createPrivateMedia(
      this.payload,
      {
        classification: descriptor.classification,
        ownerType: descriptor.ownerType,
        ownerId: descriptor.ownerId,
        alt: descriptor.alt,
      },
      {
        data: image,
        filename: descriptor.filename,
        mimeType: "image/png",
      },
    );
    return { mediaId: String(media.id) };
  }
}
