import { z } from "zod";
import type { AddressCandidate } from "./contracts";

export type EnturAddressSuggestionV1 = Readonly<{
  id: string;
  kind: "address" | "street";
  label: string;
  address?: AddressCandidate;
}>;

const featureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    id: z.string().min(1),
    layer: z.enum(["address", "street"]),
    source: z.literal("kartverket-matrikkelenadresse"),
    names: z.object({
      default: z.string().min(1),
      display: z.string().min(1),
    }),
    address: z
      .object({
        houseNumber: z.string().optional(),
        postalCode: z.string().optional(),
        locality: z.string().optional(),
        countryCode: z.literal("no"),
      })
      .optional(),
  }),
});

const responseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(featureSchema).max(100),
});

export function normalizeEnturAutocompleteQueryV1(query: string) {
  return query.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function parseEnturAutocompleteResponseV1(
  input: unknown,
): EnturAddressSuggestionV1[] {
  const response = responseSchema.parse(input);
  return response.features.slice(0, 6).map((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    const properties = feature.properties;
    const concrete =
      properties.layer === "address" &&
      properties.id.startsWith("KVE:PostalAddress:") &&
      Boolean(properties.address?.houseNumber) &&
      Boolean(properties.address?.postalCode) &&
      Boolean(properties.address?.locality);
    return {
      id: properties.id,
      kind: concrete ? "address" : "street",
      label: properties.names.display,
      ...(concrete
        ? {
            address: {
              id: properties.id,
              label: properties.names.display,
              postalCode: properties.address!.postalCode!,
              city: properties.address!.locality!,
              latitude,
              longitude,
              source: "Kartverket matrikkeladresser per Entur Geocoder v3",
            },
          }
        : {}),
    };
  });
}

export async function fetchEnturAutocompleteV1(
  query: string,
  fetcher: typeof fetch = fetch,
) {
  const normalized = normalizeEnturAutocompleteQueryV1(query);
  if (normalized.length < 3 || normalized.length > 120) return [];
  const url = new URL("https://api.entur.io/geocoder/v3/autocomplete");
  url.searchParams.set("q", normalized);
  url.searchParams.set("lang", "no");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countries", "no");
  url.searchParams.set("layers", "address,street");
  url.searchParams.set("sources", "kartverket-matrikkelenadresse");
  const response = await fetcher(url, {
    headers: {
      Accept: "application/json",
      "ET-Client-Name": "fornyelsegruppen-roof-fusion",
    },
    signal: AbortSignal.timeout(3_500),
  });
  if (!response.ok) throw new Error(`ENTUR_AUTOCOMPLETE_${response.status}`);
  return parseEnturAutocompleteResponseV1(await response.json());
}

export function addressCandidateFromEnturSelectionV1(formData: FormData) {
  const id = String(formData.get("selectedAddressId") ?? "").trim();
  const label = String(formData.get("selectedAddressLabel") ?? "").trim();
  const postalCode = String(
    formData.get("selectedAddressPostalCode") ?? "",
  ).trim();
  const city = String(formData.get("selectedAddressCity") ?? "").trim();
  const latitude = Number(formData.get("selectedAddressLatitude"));
  const longitude = Number(formData.get("selectedAddressLongitude"));
  if (
    !/^KVE:PostalAddress:[A-Za-z0-9._:-]+$/u.test(id) ||
    label.length < 4 ||
    label.length > 180 ||
    !/^\d{4}$/u.test(postalCode) ||
    city.length < 1 ||
    city.length > 100 ||
    !Number.isFinite(latitude) ||
    latitude < 57 ||
    latitude > 72 ||
    !Number.isFinite(longitude) ||
    longitude < 4 ||
    longitude > 32
  ) {
    return null;
  }
  return {
    id,
    label,
    postalCode,
    city,
    latitude,
    longitude,
    source: "Kartverket matrikkeladresser per Entur Geocoder v3",
  } satisfies AddressCandidate;
}

export async function resolveRoofFusionAddressQueryV1(
  formData: FormData,
  fallback: (query: string) => Promise<AddressCandidate[]>,
) {
  const selected = addressCandidateFromEnturSelectionV1(formData);
  if (selected) return selected;
  const query = normalizeEnturAutocompleteQueryV1(
    String(formData.get("addressQuery") ?? ""),
  );
  return (await fallback(query))[0] ?? null;
}
