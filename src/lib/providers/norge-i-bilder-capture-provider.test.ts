import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  type BrowserCaptureResult,
  NorgeIBilderCaptureError,
  NorgeIBilderCaptureProvider,
  NORGE_I_BILDER_ATTRIBUTION,
  NORGE_I_BILDER_MAX_ATTEMPTS,
  type NorgeIBilderCaptureLedger,
} from "./norge-i-bilder-capture-provider";

async function png(width = 32, height = 18) {
  return new Uint8Array(
    await sharp({
      create: { width, height, channels: 3, background: "#336699" },
    })
      .png()
      .toBuffer(),
  );
}

function fixture(input?: {
  url?: string;
  captures?: BrowserCaptureResult[];
  allowed?: boolean;
}) {
  const attempts: string[] = [];
  const finalizations: string[] = [];
  const saved: Array<Record<string, unknown>> = [];
  let closed = 0;
  const ledger: NorgeIBilderCaptureLedger = {
    async reserve() {
      return input?.allowed === false
        ? {
            allowed: false as const,
            reason: "single-use click was already consumed",
          }
        : { allowed: true as const, reservation: { id: "reservation-1" } };
    },
    async recordAttempt(entry) {
      attempts.push(`${entry.attempt}:${entry.outcome}`);
    },
    async finalize(entry) {
      finalizations.push(entry.outcome);
    },
  };
  let captureIndex = 0;
  const provider = new NorgeIBilderCaptureProvider({
    urlBuilder: {
      build: () => ({
        url: new URL(
          input?.url ?? "https://www.norgeibilder.no/?lat=59.91&lon=10.75",
        ),
        bounds: {
          minEastingM: 262338.294,
          minNorthingM: 6649146.086,
          maxEastingM: 262434.294,
          maxNorthingM: 6649200.086,
        },
      }),
    },
    browser: {
      async open() {
        return {
          async capture() {
            return (
              input?.captures?.[captureIndex++] ?? {
                kind: "captured",
                image: await png(),
                contentType: "image/png",
              }
            );
          },
          async close() {
            closed += 1;
          },
        };
      },
    },
    ledger,
    store: {
      async saveFinal(entry) {
        saved.push(entry);
        return { mediaId: "private-media-42" };
      },
    },
  });
  return { provider, attempts, finalizations, saved, closed: () => closed };
}

const request = {
  caseId: "lead-123",
  employeeId: "employee-8",
  clickId: "click-6d5f",
  triggeredAt: "2026-09-02T12:00:00.000Z",
  target: { latitude: 59.911, longitude: 10.749, addressLabel: "Oslo" },
  viewport: { width: 3840, height: 2160 },
};

describe("Norge i bilder server capture policy", () => {
  it("makes one approved interactive-page capture and persists the mandatory attribution", async () => {
    const { provider, attempts, finalizations, saved, closed } = fixture();

    await expect(provider.capture(request)).resolves.toEqual({
      mediaId: "private-media-42",
      capturedAt: expect.any(String),
      attribution: NORGE_I_BILDER_ATTRIBUTION,
      source: "norge-i-bilder-screenshot",
      attempts: 1,
      geoReference: {
        crs: "EPSG:25833",
        bounds: {
          minEastingM: 262338.294,
          minNorthingM: 6649146.086,
          maxEastingM: 262434.294,
          maxNorthingM: 6649200.086,
        },
        imageWidth: 32,
        imageHeight: 18,
      },
    });

    expect(attempts).toEqual(["1:captured"]);
    expect(finalizations).toEqual(["captured"]);
    expect(closed()).toBe(1);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      source: "norge-i-bilder-screenshot",
      attribution: "©norgeibilder.no",
      trainingProhibited: true,
      coordinates: request.target,
    });
  });

  it("retries only tile-readiness failures and stores only the final successful frame", async () => {
    const { provider, attempts, saved } = fixture({
      captures: [
        { kind: "tiles_not_ready" },
        { kind: "tiles_not_ready" },
        { kind: "captured", image: await png(), contentType: "image/png" },
      ],
    });

    await expect(provider.capture(request)).resolves.toMatchObject({
      attempts: 3,
    });
    expect(attempts).toEqual([
      "1:tiles_not_ready",
      "2:tiles_not_ready",
      "3:captured",
    ]);
    expect(saved).toHaveLength(1);
  });

  it("stops after the approved maximum of ten retries without storing an image", async () => {
    const { provider, attempts, finalizations, saved, closed } = fixture({
      captures: Array.from({ length: NORGE_I_BILDER_MAX_ATTEMPTS }, () => ({
        kind: "tiles_not_ready" as const,
      })),
    });

    await expect(provider.capture(request)).rejects.toMatchObject({
      code: "CAPTURE_FAILED",
    });
    expect(attempts).toHaveLength(NORGE_I_BILDER_MAX_ATTEMPTS);
    expect(finalizations).toEqual(["failed"]);
    expect(closed()).toBe(1);
    expect(saved).toHaveLength(0);
  });

  it("fails closed before browser navigation when the durable policy ledger denies the click", async () => {
    const { provider, attempts, saved } = fixture({ allowed: false });

    await expect(provider.capture(request)).rejects.toMatchObject({
      code: "POLICY_DENIED",
    });
    expect(attempts).toEqual([]);
    expect(saved).toEqual([]);
  });

  it.each([
    "https://wms.geonorge.no/orthophoto?service=WMS&request=GetMap",
    "https://www.norgeibilder.no/wmts?request=GetCapabilities",
    "https://example.test/norgeibilder",
  ])("rejects non-interactive or OGC source URLs: %s", async (url) => {
    const { provider, attempts } = fixture({ url });

    await expect(provider.capture(request)).rejects.toMatchObject({
      code: "UNTRUSTED_SOURCE_URL",
    });
    expect(attempts).toEqual([]);
  });

  it("rejects coordinates and dimensions outside the written single-frame contract", async () => {
    const { provider } = fixture();
    await expect(
      provider.capture({
        ...request,
        target: { latitude: 54, longitude: 10 },
      }),
    ).rejects.toBeInstanceOf(NorgeIBilderCaptureError);
    await expect(
      provider.capture({ ...request, viewport: { width: 3841, height: 2160 } }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("does not accept a browser result whose real pixel dimensions exceed the viewport", async () => {
    const { provider, saved } = fixture({
      captures: [
        {
          kind: "captured",
          image: await png(64, 24),
          contentType: "image/png",
        },
      ],
    });

    await expect(
      provider.capture({ ...request, viewport: { width: 32, height: 24 } }),
    ).rejects.toMatchObject({ code: "INVALID_CAPTURE" });
    expect(saved).toEqual([]);
  });

  it("fails closed when the map crop does not keep the extent viewport aspect", async () => {
    const { provider, saved } = fixture({
      captures: [
        {
          kind: "captured",
          image: await png(32, 24),
          contentType: "image/png",
        },
      ],
    });

    await expect(provider.capture(request)).rejects.toMatchObject({
      code: "INVALID_CAPTURE",
    });
    expect(saved).toEqual([]);
  });
});
