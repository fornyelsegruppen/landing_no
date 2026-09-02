import { afterEach, describe, expect, it } from "vitest";
import {
  KartverketAddressProvider,
  norgeIBilderAccess,
} from "./kartverket-address-provider";

describe("Kartverket address provider", () => {
  afterEach(() => {
    delete process.env.NORGE_I_BILDER_TOKEN;
    delete process.env.NORGE_I_BILDER_TOKEN_EXPIRES_AT;
    delete process.env.NORGE_I_BILDER_WMS_LAYER;
    delete process.env.MAP_TERMS_ACCEPTED_AT;
  });

  it("normalizes punctuation and official Matrikkelen address results", async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).searchParams.get("sok")).toBe(
        "Lyngveien 28 1182 Oslo",
      );
      return new Response(
        JSON.stringify({
          adresser: [
            {
              adressetekst: "Lyngveien 28A",
              postnummer: "1182",
              poststed: "OSLO",
              kommunenummer: "0301",
              gardsnummer: 149,
              bruksnummer: 181,
              festenummer: 0,
              undernummer: null,
              representasjonspunkt: {
                epsg: "EPSG:4258",
                lat: 59.8964,
                lon: 10.798,
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const provider = new KartverketAddressProvider(fetcher as typeof fetch);
    await expect(
      provider.searchAddress(" Lyngveien 28, 1182, Oslo "),
    ).resolves.toEqual([
      expect.objectContaining({
        label: "Lyngveien 28A, 1182 OSLO",
        postalCode: "1182",
        latitude: 59.8964,
        source: expect.stringContaining("Kartverket"),
      }),
    ]);
  });

  it("fails closed on malformed provider data", async () => {
    const provider = new KartverketAddressProvider(
      (async () =>
        new Response(
          JSON.stringify({ adresser: [{ bad: true }] }),
        )) as typeof fetch,
    );
    await expect(provider.searchAddress("valid query")).rejects.toThrow();
  });

  it("blocks imagery until a licensed token is configured", () => {
    expect(norgeIBilderAccess().status).toBe("configuration_required");
    process.env.NORGE_I_BILDER_TOKEN = "configured-in-host-only";
    process.env.NORGE_I_BILDER_TOKEN_EXPIRES_AT = new Date(
      Date.now() + 24 * 60 * 60 * 1_000,
    ).toISOString();
    process.env.NORGE_I_BILDER_WMS_LAYER = "licensed-layer";
    process.env.MAP_TERMS_ACCEPTED_AT = "2026-08-23T00:00:00Z";
    expect(norgeIBilderAccess()).toMatchObject({
      status: "ready",
      credits: "© norgeibilder.no",
    });
  });
});
