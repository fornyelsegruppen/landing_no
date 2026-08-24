import { z } from "zod";
import type { AddressCandidate, MapProvider, ProviderHealth } from "./contracts";

const responseSchema = z.object({
  adresser: z.array(z.object({
    adressetekst: z.string(),
    postnummer: z.string(),
    poststed: z.string(),
    kommunenummer: z.string(),
    gardsnummer: z.number().int(),
    bruksnummer: z.number().int(),
    festenummer: z.number().int().optional().default(0),
    undernummer: z.number().int().nullable().optional(),
    representasjonspunkt: z.object({
      epsg: z.string(),
      lat: z.number(),
      lon: z.number(),
    }),
  })).default([]),
});

export class KartverketAddressProvider implements MapProvider {
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly endpoint = "https://ws.geonorge.no/adresser/v1/sok",
  ) {}

  health(): ProviderHealth {
    return {
      status: "ready",
      provider: "kartverket-address-rest-v1",
      detail: "Official Matrikkelen address distribution; normally updated daily.",
    };
  }

  async searchAddress(query: string): Promise<AddressCandidate[]> {
    // Kartverket's free-text search returns zero hits for otherwise valid
    // addresses when postal/city parts are comma-separated.
    const normalized = query.trim().replace(/[;,]+/g, " ").replace(/\s+/g, " ");
    if (normalized.length < 4 || normalized.length > 180) return [];
    const url = new URL(this.endpoint);
    url.searchParams.set("sok", normalized);
    url.searchParams.set("treffPerSide", "10");
    url.searchParams.set("side", "0");

    const response = await this.fetcher(url, {
      headers: { Accept: "application/json", "User-Agent": "Takfornyelse-address-validation/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Kartverket address lookup failed (${response.status})`);
    const parsed = responseSchema.parse(await response.json());
    return parsed.adresser.map((address) => ({
      id: `${address.kommunenummer}-${address.gardsnummer}-${address.bruksnummer}-${address.festenummer}-${address.undernummer ?? 0}-${address.adressetekst}`,
      label: `${address.adressetekst}, ${address.postnummer} ${address.poststed}`,
      postalCode: address.postnummer,
      city: address.poststed,
      latitude: address.representasjonspunkt.lat,
      longitude: address.representasjonspunkt.lon,
      source: "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
    }));
  }
}

export type ImageryAccess = {
  status: "ready" | "configuration_required";
  provider: "norge-i-bilder";
  credits: "© norgeibilder.no";
  reason?: string;
};

export function norgeIBilderAccess(): ImageryAccess {
  if (process.env.NORGE_I_BILDER_TOKEN?.trim() && process.env.MAP_TERMS_ACCEPTED_AT?.trim()) {
    return { status: "ready", provider: "norge-i-bilder", credits: "© norgeibilder.no" };
  }
  return {
    status: "configuration_required",
    provider: "norge-i-bilder",
    credits: "© norgeibilder.no",
    reason: "GeoID/Norge digitalt access agreement, token and recorded terms approval are required before orthophoto automation.",
  };
}
