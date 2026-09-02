import { z } from "zod";

export const NORGE_I_BILDER_ORTHOPHOTO_ENDPOINT =
  "https://services.norgeibilder.no/wms/ortofoto" as const;
export const NORGE_I_BILDER_TOKEN_ENDPOINT =
  "https://backend-api.klienter-prod-k8s2.norgeibilder.no/token/tilecache" as const;

export type NorgeIBilderPublicAccessV1 = {
  schemaVersion: "norge-i-bilder-access.v1";
  status: "ready" | "configuration_required";
  provider: "norge-i-bilder";
  credits: "© norgeibilder.no";
  credentialMode: "configured_token" | "geoid_basic" | null;
  missing: string[];
  reason?: string;
};

type NorgeIBilderEnvironmentV1 = Readonly<Record<string, string | undefined>>;

const tokenResponseSchema = z.object({
  token: z.string().trim().min(1),
});

const mapRequestSchema = z.object({
  bboxWebMercator: z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
  width: z.number().int().min(64).max(2048),
  height: z.number().int().min(64).max(2048),
});

function configured(environment: NorgeIBilderEnvironmentV1, key: string) {
  return Boolean(environment[key]?.trim());
}

function validTimestamp(value: string | undefined) {
  return Boolean(value?.trim() && Number.isFinite(Date.parse(value)));
}

function validHttpsReferer(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function readNorgeIBilderPublicAccessV1(
  environment: NorgeIBilderEnvironmentV1 = process.env,
  now = Date.now(),
): NorgeIBilderPublicAccessV1 {
  const tokenPresent = configured(environment, "NORGE_I_BILDER_TOKEN");
  const tokenExpiresAt = environment.NORGE_I_BILDER_TOKEN_EXPIRES_AT;
  const maximumTokenLifetimeMs = 7 * 24 * 60 * 60 * 1_000 + 5 * 60 * 1_000;
  const tokenExpiryValid =
    validTimestamp(tokenExpiresAt) &&
    Date.parse(tokenExpiresAt!) > now + 60_000 &&
    Date.parse(tokenExpiresAt!) <= now + maximumTokenLifetimeMs;
  const tokenConfigured = tokenPresent && tokenExpiryValid;
  const geoidUsernameConfigured = configured(
    environment,
    "NORGE_I_BILDER_GEOID_USERNAME",
  );
  const geoidPasswordConfigured = configured(
    environment,
    "NORGE_I_BILDER_GEOID_PASSWORD",
  );
  const geoidConfigured =
    geoidUsernameConfigured &&
    geoidPasswordConfigured &&
    validHttpsReferer(environment.NORGE_I_BILDER_HTTP_REFERER);
  const termsAccepted =
    validTimestamp(environment.MAP_TERMS_ACCEPTED_AT) &&
    Date.parse(environment.MAP_TERMS_ACCEPTED_AT!) <= now;
  const layerConfigured = configured(environment, "NORGE_I_BILDER_WMS_LAYER");
  const missing = [
    ...(!termsAccepted ? ["MAP_TERMS_ACCEPTED_AT"] : []),
    ...(!layerConfigured ? ["NORGE_I_BILDER_WMS_LAYER"] : []),
    ...(tokenPresent && !tokenExpiryValid && !geoidConfigured
      ? ["NORGE_I_BILDER_TOKEN_EXPIRES_AT"]
      : []),
    ...(!tokenPresent && !geoidConfigured
      ? [
          "NORGE_I_BILDER_TOKEN or NORGE_I_BILDER_GEOID_USERNAME + NORGE_I_BILDER_GEOID_PASSWORD + NORGE_I_BILDER_HTTP_REFERER",
        ]
      : []),
  ];

  if (missing.length) {
    return {
      schemaVersion: "norge-i-bilder-access.v1",
      status: "configuration_required",
      provider: "norge-i-bilder",
      credits: "© norgeibilder.no",
      credentialMode: null,
      missing,
      reason:
        "GeoID/Norge digitalt access agreement, a WMS layer and recorded terms approval are required before orthophoto automation.",
    };
  }

  return {
    schemaVersion: "norge-i-bilder-access.v1",
    status: "ready",
    provider: "norge-i-bilder",
    credits: "© norgeibilder.no",
    credentialMode: tokenConfigured ? "configured_token" : "geoid_basic",
    missing: [],
  };
}

export class NorgeIBilderOrtofotoProviderV1 {
  constructor(
    private readonly environment: NorgeIBilderEnvironmentV1 = process.env,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  access(): NorgeIBilderPublicAccessV1 {
    return readNorgeIBilderPublicAccessV1(this.environment);
  }

  private async tileToken() {
    const configuredToken = this.environment.NORGE_I_BILDER_TOKEN?.trim();
    if (configuredToken) return configuredToken;

    const username = this.environment.NORGE_I_BILDER_GEOID_USERNAME?.trim();
    const password = this.environment.NORGE_I_BILDER_GEOID_PASSWORD?.trim();
    const referer = this.environment.NORGE_I_BILDER_HTTP_REFERER?.trim();
    if (!username || !password || !referer || !validHttpsReferer(referer)) {
      throw new Error("Norge i bilder credentials are not configured");
    }

    const body = new URLSearchParams({
      client: "referer",
      referer,
      expiration: "60",
      f: "json",
    });
    const response = await this.fetcher(NORGE_I_BILDER_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new Error(
        `Norge i bilder token request failed (${response.status})`,
      );
    }
    return tokenResponseSchema.parse(await response.json()).token;
  }

  async getMap(input: z.input<typeof mapRequestSchema>) {
    const access = this.access();
    if (access.status !== "ready") {
      throw new Error(
        `Norge i bilder access requires configuration: ${access.missing.join(", ")}`,
      );
    }
    const parsed = mapRequestSchema.parse(input);
    const [minX, minY, maxX, maxY] = parsed.bboxWebMercator;
    if (minX >= maxX || minY >= maxY) {
      throw new TypeError("Norge i bilder WMS bounding box is invalid");
    }

    const url = new URL(NORGE_I_BILDER_ORTHOPHOTO_ENDPOINT);
    url.search = new URLSearchParams({
      SERVICE: "WMS",
      REQUEST: "GetMap",
      VERSION: "1.3.0",
      LAYERS: this.environment.NORGE_I_BILDER_WMS_LAYER!.trim(),
      STYLES: "",
      FORMAT: "image/jpeg",
      TRANSPARENT: "false",
      CRS: "EPSG:3857",
      BBOX: parsed.bboxWebMercator.join(","),
      WIDTH: String(parsed.width),
      HEIGHT: String(parsed.height),
    }).toString();

    const token = await this.tileToken();
    const response = await this.fetcher(url, {
      headers: {
        Accept: "image/jpeg,image/png",
        "X-Esri-Authorization": `Bearer ${token}`,
        ...(this.environment.NORGE_I_BILDER_HTTP_REFERER?.trim()
          ? { Referer: this.environment.NORGE_I_BILDER_HTTP_REFERER.trim() }
          : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`Norge i bilder WMS request failed (${response.status})`);
    }
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (contentType !== "image/jpeg" && contentType !== "image/png") {
      throw new TypeError("Norge i bilder WMS returned a non-image response");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 5_000_000) {
      throw new TypeError("Norge i bilder WMS image size is invalid");
    }
    return {
      bytes,
      contentType,
      credits: access.credits,
      sourceUrl: url.toString(),
    } as const;
  }
}
