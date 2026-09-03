import { createHash } from "node:crypto";
import sharp from "sharp";

export const KARTVERKET_HEIGHT_SURFACE_SCHEMA_VERSION =
  "kartverket-height-surface.v1" as const;
export const KARTVERKET_HEIGHT_CRS = "EPSG:25833" as const;

const DOM_COVERAGE_ID = "nhm_dom_topo_25833";
const DTM_COVERAGE_ID = "nhm_dtm_topo_25833";
const DEFAULT_DOM_ENDPOINT =
  "https://wcs.geonorge.no/skwms1/wcs.hoyde-dom-nhm-25833";
const DEFAULT_DTM_ENDPOINT =
  "https://wcs.geonorge.no/skwms1/wcs.hoyde-dtm-nhm-25833";
const DEFAULT_PADDING_METERS = 8;
const DEFAULT_RESOLUTION_METERS = 1;
const MAX_GRID_SIDE_PIXELS = 256;
const MAX_RESPONSE_BYTES = 2_000_000;
const MIN_COVERAGE_RATIO = 0.8;
const COVERAGE_ATTEMPT_TIMEOUT_MS = 12_000;
const MAX_COVERAGE_ATTEMPTS = 2;

function isRetriableTransportError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

export type Wgs84Point = {
  latitude: number;
  longitude: number;
};

export type Etrs89Utm33Point = {
  eastingM: number;
  northingM: number;
};

export type KartverketHeightSurfaceV1 = {
  schemaVersion: typeof KARTVERKET_HEIGHT_SURFACE_SCHEMA_VERSION;
  provider: "Kartverket Nasjonal detaljert høydemodell WCS";
  coordinateSystem: typeof KARTVERKET_HEIGHT_CRS;
  bbox: {
    minEastingM: number;
    minNorthingM: number;
    maxEastingM: number;
    maxNorthingM: number;
  };
  grid: {
    width: number;
    height: number;
    cellWidthM: number;
    cellHeightM: number;
    rowOrder: "north_to_south";
  };
  values: {
    domElevationM: Array<number | null>;
    dtmElevationM: Array<number | null>;
    heightAboveTerrainM: Array<number | null>;
  };
  quality: {
    status: "usable" | "limited";
    coverageRatio: number;
    validSamples: number;
    totalSamples: number;
    maxHeightAboveTerrainM: number;
    reasons: string[];
  };
  provenance: {
    retrievedAt: string;
    domCoverageId: typeof DOM_COVERAGE_ID;
    dtmCoverageId: typeof DTM_COVERAGE_ID;
    domContentSha256: string;
    dtmContentSha256: string;
    resolutionM: number;
    license: "Norsk lisens for offentlige data (NLOD) 2.0";
    attribution: "Kartverket";
  };
};

export class KartverketHeightDataError extends Error {
  constructor(
    readonly code:
      | "INVALID_GEOMETRY"
      | "REQUEST_TOO_LARGE"
      | "PROVIDER_UNAVAILABLE"
      | "INVALID_PROVIDER_RESPONSE"
      | "INSUFFICIENT_COVERAGE",
    message: string,
  ) {
    super(message);
    this.name = "KartverketHeightDataError";
  }
}

function finiteCoordinate(value: number) {
  return Number.isFinite(value);
}

function assertNorwegianPoint(point: Wgs84Point) {
  if (
    !finiteCoordinate(point.latitude) ||
    !finiteCoordinate(point.longitude) ||
    point.latitude < 57 ||
    point.latitude > 72 ||
    point.longitude < 4 ||
    point.longitude > 32
  ) {
    throw new KartverketHeightDataError(
      "INVALID_GEOMETRY",
      "Høydedata Preview requires finite coordinates inside mainland Norway",
    );
  }
}

/**
 * ETRS89 geographic coordinates (EPSG:4258) to ETRS89 / UTM zone 33N
 * (EPSG:25833), using the GRS80 ellipsoid. The national 25833 Høydedata
 * coverages let the adapter use one deterministic CRS throughout Norway.
 */
export function etrs89ToUtm33(point: Wgs84Point): Etrs89Utm33Point {
  assertNorwegianPoint(point);
  const semiMajorAxisM = 6_378_137;
  const flattening = 1 / 298.257222101;
  const scaleFactor = 0.9996;
  const eccentricitySquared = flattening * (2 - flattening);
  const secondEccentricitySquared =
    eccentricitySquared / (1 - eccentricitySquared);
  const latitude = (point.latitude * Math.PI) / 180;
  const longitude = (point.longitude * Math.PI) / 180;
  const centralMeridian = (15 * Math.PI) / 180;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const tangentSquared = Math.tan(latitude) ** 2;
  const etaSquared = secondEccentricitySquared * cosLatitude ** 2;
  const deltaLongitude = cosLatitude * (longitude - centralMeridian);
  const primeVerticalRadius =
    semiMajorAxisM / Math.sqrt(1 - eccentricitySquared * sinLatitude ** 2);
  const meridionalArc =
    semiMajorAxisM *
    ((1 -
      eccentricitySquared / 4 -
      (3 * eccentricitySquared ** 2) / 64 -
      (5 * eccentricitySquared ** 3) / 256) *
      latitude -
      ((3 * eccentricitySquared) / 8 +
        (3 * eccentricitySquared ** 2) / 32 +
        (45 * eccentricitySquared ** 3) / 1024) *
        Math.sin(2 * latitude) +
      ((15 * eccentricitySquared ** 2) / 256 +
        (45 * eccentricitySquared ** 3) / 1024) *
        Math.sin(4 * latitude) -
      ((35 * eccentricitySquared ** 3) / 3072) * Math.sin(6 * latitude));

  const eastingM =
    500_000 +
    scaleFactor *
      primeVerticalRadius *
      (deltaLongitude +
        ((1 - tangentSquared + etaSquared) * deltaLongitude ** 3) / 6 +
        ((5 -
          18 * tangentSquared +
          tangentSquared ** 2 +
          72 * etaSquared -
          58 * secondEccentricitySquared) *
          deltaLongitude ** 5) /
          120);
  const northingM =
    scaleFactor *
    (meridionalArc +
      primeVerticalRadius *
        Math.tan(latitude) *
        (deltaLongitude ** 2 / 2 +
          ((5 - tangentSquared + 9 * etaSquared + 4 * etaSquared ** 2) *
            deltaLongitude ** 4) /
            24 +
          ((61 -
            58 * tangentSquared +
            tangentSquared ** 2 +
            600 * etaSquared -
            330 * secondEccentricitySquared) *
            deltaLongitude ** 6) /
            720));

  return { eastingM, northingM };
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function heightRequestUrl(input: {
  endpoint: string;
  coverageId: string;
  bbox: KartverketHeightSurfaceV1["bbox"];
  width: number;
  height: number;
}) {
  const url = new URL(input.endpoint);
  const bbox = [
    input.bbox.minEastingM,
    input.bbox.minNorthingM,
    input.bbox.maxEastingM,
    input.bbox.maxNorthingM,
  ].join(",");
  const parameters = {
    service: "WCS",
    version: "1.0.0",
    request: "GetCoverage",
    coverage: input.coverageId,
    crs: KARTVERKET_HEIGHT_CRS,
    response_crs: KARTVERKET_HEIGHT_CRS,
    bbox,
    width: String(input.width),
    height: String(input.height),
    format: "GeoTIFF",
  };
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function readFloatRaster(input: {
  body: Uint8Array;
  expectedWidth: number;
  expectedHeight: number;
}) {
  try {
    const { data, info } = await sharp(input.body, {
      failOn: "error",
      limitInputPixels: MAX_GRID_SIDE_PIXELS ** 2,
    })
      .raw({ depth: "float" })
      .toBuffer({ resolveWithObject: true });
    if (
      info.width !== input.expectedWidth ||
      info.height !== input.expectedHeight ||
      info.channels < 1 ||
      info.channels > 4
    ) {
      throw new Error("Unexpected GeoTIFF dimensions or channels");
    }
    const raw = new Float32Array(
      data.buffer,
      data.byteOffset,
      data.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    return Array.from(
      { length: input.expectedWidth * input.expectedHeight },
      (_, index) => raw[index * info.channels],
    );
  } catch (error) {
    throw new KartverketHeightDataError(
      "INVALID_PROVIDER_RESPONSE",
      `Kartverket Høydedata returned an unreadable GeoTIFF${
        error instanceof Error ? `: ${error.message}` : ""
      }`,
    );
  }
}

function validElevation(value: number) {
  return Number.isFinite(value) && value > -1_000 && value < 10_000;
}

export class KartverketHeightDataProvider {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly domEndpoint = DEFAULT_DOM_ENDPOINT,
    private readonly dtmEndpoint = DEFAULT_DTM_ENDPOINT,
  ) {}

  health() {
    return {
      status: "ready" as const,
      provider: "kartverket-hoydedata-wcs-v1",
      detail:
        "Open national DOM/DTM GeoTIFF coverages in ETRS89 / UTM zone 33N.",
    };
  }

  async getSurface(input: {
    polygon: Wgs84Point[];
    retrievedAt?: string;
    paddingM?: number;
    resolutionM?: number;
    /** Preview UAT must never reuse a prior HTTP cache entry. */
    cacheMode?: "default" | "no-store";
    /** Absolute action budget shared by the independently retried DOM/DTM reads. */
    deadlineAtMs?: number;
  }): Promise<KartverketHeightSurfaceV1> {
    if (input.polygon.length < 3 || input.polygon.length > 500) {
      throw new KartverketHeightDataError(
        "INVALID_GEOMETRY",
        "Høydedata Preview requires a polygon with 3 to 500 vertices",
      );
    }
    const paddingM = input.paddingM ?? DEFAULT_PADDING_METERS;
    const resolutionM = input.resolutionM ?? DEFAULT_RESOLUTION_METERS;
    if (
      !Number.isFinite(paddingM) ||
      paddingM < 0 ||
      paddingM > 30 ||
      !Number.isFinite(resolutionM) ||
      resolutionM < 0.5 ||
      resolutionM > 5
    ) {
      throw new KartverketHeightDataError(
        "INVALID_GEOMETRY",
        "Høydedata padding or resolution is outside the Preview safety bounds",
      );
    }
    const projected = input.polygon.map(etrs89ToUtm33);
    const bbox = {
      minEastingM: Math.floor(
        Math.min(...projected.map((point) => point.eastingM)) - paddingM,
      ),
      minNorthingM: Math.floor(
        Math.min(...projected.map((point) => point.northingM)) - paddingM,
      ),
      maxEastingM: Math.ceil(
        Math.max(...projected.map((point) => point.eastingM)) + paddingM,
      ),
      maxNorthingM: Math.ceil(
        Math.max(...projected.map((point) => point.northingM)) + paddingM,
      ),
    };
    const width = Math.ceil(
      (bbox.maxEastingM - bbox.minEastingM) / resolutionM,
    );
    const height = Math.ceil(
      (bbox.maxNorthingM - bbox.minNorthingM) / resolutionM,
    );
    if (
      width < 1 ||
      height < 1 ||
      width > MAX_GRID_SIDE_PIXELS ||
      height > MAX_GRID_SIDE_PIXELS
    ) {
      throw new KartverketHeightDataError(
        "REQUEST_TOO_LARGE",
        "Høydedata Preview grid exceeds the 256 by 256 pixel safety limit",
      );
    }

    const requests = [
      { endpoint: this.domEndpoint, coverageId: DOM_COVERAGE_ID },
      { endpoint: this.dtmEndpoint, coverageId: DTM_COVERAGE_ID },
    ].map(async ({ endpoint, coverageId }) => {
      const url = heightRequestUrl({
        endpoint,
        coverageId,
        bbox,
        width,
        height,
      });
      let body: Uint8Array | undefined;
      let lastRetriableFailure = "request failed";
      for (let attempt = 1; attempt <= MAX_COVERAGE_ATTEMPTS; attempt += 1) {
        const remainingMs = input.deadlineAtMs
          ? input.deadlineAtMs - Date.now()
          : COVERAGE_ATTEMPT_TIMEOUT_MS;
        if (remainingMs <= 0) break;
        let response: Response;
        try {
          response = await this.fetcher(url, {
            headers: {
              Accept: "image/tiff",
              "User-Agent": "Takfornyelse-Roof-Fusion-Preview/1.0",
            },
            signal: AbortSignal.timeout(
              Math.max(1, Math.min(COVERAGE_ATTEMPT_TIMEOUT_MS, remainingMs)),
            ),
            ...(input.cacheMode === "no-store"
              ? { cache: "no-store" as const }
              : {
                  cache: "force-cache" as const,
                  next: { revalidate: 3_600 },
                }),
          } as RequestInit & { next?: { revalidate: number } });
        } catch (error) {
          if (!isRetriableTransportError(error)) {
            throw new KartverketHeightDataError(
              "PROVIDER_UNAVAILABLE",
              "Kartverket Høydedata request failed without retry",
            );
          }
          lastRetriableFailure =
            error instanceof Error ? error.name : "network failure";
          if (attempt < MAX_COVERAGE_ATTEMPTS) continue;
          break;
        }
        if (
          response.status === 429 ||
          (response.status >= 500 && response.status <= 599)
        ) {
          lastRetriableFailure = `HTTP ${response.status}`;
          if (attempt < MAX_COVERAGE_ATTEMPTS) continue;
          break;
        }
        const contentType = response.headers.get("content-type") ?? "";
        const contentLength = Number(response.headers.get("content-length"));
        if (
          !response.ok ||
          !contentType.toLowerCase().startsWith("image/tiff") ||
          (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES)
        ) {
          throw new KartverketHeightDataError(
            response.ok ? "INVALID_PROVIDER_RESPONSE" : "PROVIDER_UNAVAILABLE",
            `Kartverket Høydedata returned ${response.status} ${contentType || "without a content type"}`,
          );
        }
        try {
          body = new Uint8Array(await response.arrayBuffer());
          break;
        } catch (error) {
          if (!isRetriableTransportError(error)) {
            throw new KartverketHeightDataError(
              "PROVIDER_UNAVAILABLE",
              "Kartverket Høydedata response read failed without retry",
            );
          }
          lastRetriableFailure =
            error instanceof Error ? error.name : "response read failure";
          if (attempt >= MAX_COVERAGE_ATTEMPTS) break;
        }
      }
      if (!body) {
        throw new KartverketHeightDataError(
          "PROVIDER_UNAVAILABLE",
          `Kartverket Høydedata request failed after bounded retry (${lastRetriableFailure})`,
        );
      }
      if (body.byteLength === 0 || body.byteLength > MAX_RESPONSE_BYTES) {
        throw new KartverketHeightDataError(
          "INVALID_PROVIDER_RESPONSE",
          "Kartverket Høydedata response exceeded the safe binary size",
        );
      }
      return {
        body,
        hash: sha256(body),
        values: await readFloatRaster({
          body,
          expectedWidth: width,
          expectedHeight: height,
        }),
      };
    });
    const [dom, dtm] = await Promise.all(requests);
    const totalSamples = width * height;
    let validSamples = 0;
    let maxHeightAboveTerrainM = 0;
    let negativeDeltaSamples = 0;
    const domElevationM: Array<number | null> = [];
    const dtmElevationM: Array<number | null> = [];
    const heightAboveTerrainM: Array<number | null> = [];
    for (let index = 0; index < totalSamples; index += 1) {
      const domValue = dom.values[index];
      const dtmValue = dtm.values[index];
      if (!validElevation(domValue) || !validElevation(dtmValue)) {
        domElevationM.push(null);
        dtmElevationM.push(null);
        heightAboveTerrainM.push(null);
        continue;
      }
      validSamples += 1;
      const delta = domValue - dtmValue;
      if (delta < -0.5) negativeDeltaSamples += 1;
      const normalizedHeight = Math.max(0, delta);
      maxHeightAboveTerrainM = Math.max(
        maxHeightAboveTerrainM,
        normalizedHeight,
      );
      domElevationM.push(round(domValue));
      dtmElevationM.push(round(dtmValue));
      heightAboveTerrainM.push(round(normalizedHeight));
    }
    const coverageRatio = validSamples / totalSamples;
    if (coverageRatio < MIN_COVERAGE_RATIO) {
      throw new KartverketHeightDataError(
        "INSUFFICIENT_COVERAGE",
        `Kartverket Høydedata covered only ${round(coverageRatio * 100, 1)}% of the requested grid`,
      );
    }
    const reasons = [
      "DOM and DTM were retrieved from matching national 1 m WCS coverages",
    ];
    if (negativeDeltaSamples > totalSamples * 0.01) {
      reasons.push(
        "Some DOM cells were below DTM and were clamped to zero for review",
      );
    }

    return {
      schemaVersion: KARTVERKET_HEIGHT_SURFACE_SCHEMA_VERSION,
      provider: "Kartverket Nasjonal detaljert høydemodell WCS",
      coordinateSystem: KARTVERKET_HEIGHT_CRS,
      bbox,
      grid: {
        width,
        height,
        cellWidthM: round((bbox.maxEastingM - bbox.minEastingM) / width, 6),
        cellHeightM: round((bbox.maxNorthingM - bbox.minNorthingM) / height, 6),
        rowOrder: "north_to_south",
      },
      values: { domElevationM, dtmElevationM, heightAboveTerrainM },
      quality: {
        status:
          coverageRatio >= 0.98 && negativeDeltaSamples <= totalSamples * 0.01
            ? "usable"
            : "limited",
        coverageRatio: round(coverageRatio, 4),
        validSamples,
        totalSamples,
        maxHeightAboveTerrainM: round(maxHeightAboveTerrainM),
        reasons,
      },
      provenance: {
        retrievedAt: input.retrievedAt ?? new Date().toISOString(),
        domCoverageId: DOM_COVERAGE_ID,
        dtmCoverageId: DTM_COVERAGE_ID,
        domContentSha256: dom.hash,
        dtmContentSha256: dtm.hash,
        resolutionM,
        license: "Norsk lisens for offentlige data (NLOD) 2.0",
        attribution: "Kartverket",
      },
    };
  }
}
