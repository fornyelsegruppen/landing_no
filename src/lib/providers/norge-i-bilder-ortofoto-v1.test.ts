import { describe, expect, it, vi } from "vitest";
import {
  NORGE_I_BILDER_ORTHOPHOTO_ENDPOINT,
  NORGE_I_BILDER_TOKEN_ENDPOINT,
  NorgeIBilderOrtofotoProviderV1,
  readNorgeIBilderPublicAccessV1,
} from "./norge-i-bilder-ortofoto-v1";

const terms = "2026-09-02T00:00:00Z";

describe("Norge i bilder orthophoto provider v1", () => {
  it("fails closed and publishes only missing configuration names", () => {
    const access = readNorgeIBilderPublicAccessV1({});
    expect(access).toMatchObject({
      schemaVersion: "norge-i-bilder-access.v1",
      status: "configuration_required",
      credentialMode: null,
      credits: "© norgeibilder.no",
    });
    expect(access.missing).toEqual([
      "MAP_TERMS_ACCEPTED_AT",
      "NORGE_I_BILDER_WMS_LAYER",
      "NORGE_I_BILDER_TOKEN or NORGE_I_BILDER_GEOID_USERNAME + NORGE_I_BILDER_GEOID_PASSWORD + NORGE_I_BILDER_HTTP_REFERER",
    ]);
  });

  it("accepts a configured short-lived token without exposing it", () => {
    const access = readNorgeIBilderPublicAccessV1(
      {
        MAP_TERMS_ACCEPTED_AT: terms,
        NORGE_I_BILDER_TOKEN: "top-secret",
        NORGE_I_BILDER_TOKEN_EXPIRES_AT: "2026-09-03T00:00:00Z",
        NORGE_I_BILDER_WMS_LAYER: "licensed-layer",
      },
      Date.parse("2026-09-02T00:00:00Z"),
    );
    expect(access).toMatchObject({
      status: "ready",
      credentialMode: "configured_token",
      missing: [],
    });
    expect(JSON.stringify(access)).not.toContain("top-secret");
  });

  it("fails closed when a configured token is expired", () => {
    const access = readNorgeIBilderPublicAccessV1(
      {
        MAP_TERMS_ACCEPTED_AT: terms,
        NORGE_I_BILDER_TOKEN: "expired-secret",
        NORGE_I_BILDER_TOKEN_EXPIRES_AT: "2026-09-01T00:00:00Z",
        NORGE_I_BILDER_WMS_LAYER: "licensed-layer",
      },
      Date.parse("2026-09-02T00:00:00Z"),
    );
    expect(access).toMatchObject({
      status: "configuration_required",
      credentialMode: null,
      missing: ["NORGE_I_BILDER_TOKEN_EXPIRES_AT"],
    });
    expect(JSON.stringify(access)).not.toContain("expired-secret");
  });

  it("mints a referer-bound token server-side and fetches a bounded WMS image", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async (input, init) => {
        expect(String(input)).toBe(NORGE_I_BILDER_TOKEN_ENDPOINT);
        expect(init?.method).toBe("POST");
        expect(init?.headers).toMatchObject({
          Authorization: `Basic ${Buffer.from("geoid-user:geoid-password").toString("base64")}`,
        });
        expect(String(init?.body)).toContain("client=referer");
        expect(String(init?.body)).toContain("expiration=60");
        return Response.json({ token: "short-lived-tile-token" });
      })
      .mockImplementationOnce(async (input, init) => {
        const url = new URL(String(input));
        expect(url.origin + url.pathname).toBe(
          NORGE_I_BILDER_ORTHOPHOTO_ENDPOINT,
        );
        expect(url.searchParams.get("REQUEST")).toBe("GetMap");
        expect(url.searchParams.get("CRS")).toBe("EPSG:3857");
        expect(url.searchParams.get("LAYERS")).toBe("licensed-layer");
        expect(url.searchParams.has("token")).toBe(false);
        expect(init?.headers).toMatchObject({
          "X-Esri-Authorization": "Bearer short-lived-tile-token",
          Referer: "https://takfornyelse-admin-next-uat.vercel.app",
        });
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/jpeg" },
        });
      });
    const provider = new NorgeIBilderOrtofotoProviderV1(
      {
        MAP_TERMS_ACCEPTED_AT: terms,
        NORGE_I_BILDER_GEOID_USERNAME: "geoid-user",
        NORGE_I_BILDER_GEOID_PASSWORD: "geoid-password",
        NORGE_I_BILDER_HTTP_REFERER:
          "https://takfornyelse-admin-next-uat.vercel.app",
        NORGE_I_BILDER_WMS_LAYER: "licensed-layer",
      },
      fetcher,
    );

    await expect(
      provider.getMap({
        bboxWebMercator: [1, 2, 3, 4],
        width: 620,
        height: 330,
      }),
    ).resolves.toMatchObject({
      contentType: "image/jpeg",
      credits: "© norgeibilder.no",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid bounds before sending WMS traffic", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new NorgeIBilderOrtofotoProviderV1(
      {
        MAP_TERMS_ACCEPTED_AT: terms,
        NORGE_I_BILDER_TOKEN: "short-lived-token",
        NORGE_I_BILDER_TOKEN_EXPIRES_AT: new Date(
          Date.now() + 24 * 60 * 60 * 1_000,
        ).toISOString(),
        NORGE_I_BILDER_WMS_LAYER: "licensed-layer",
      },
      fetcher,
    );
    await expect(
      provider.getMap({
        bboxWebMercator: [3, 2, 1, 4],
        width: 620,
        height: 330,
      }),
    ).rejects.toThrow("bounding box is invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
