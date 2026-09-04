import { describe, expect, it, vi } from "vitest";
import {
  addressCandidateFromEnturSelectionV1,
  fetchEnturAutocompleteV1,
  parseEnturAutocompleteResponseV1,
  resolveRoofFusionAddressQueryV1,
} from "./entur-geocoder-v3";

const response = {
  type: "FeatureCollection",
  features: [
    {
      geometry: { type: "Point", coordinates: [10.7494, 59.91138] },
      properties: {
        id: "KVE:PostalAddress:123",
        layer: "address",
        source: "kartverket-matrikkelenadresse",
        names: { default: "Lyngveien 28A", display: "Lyngveien 28A, Oslo" },
        address: {
          houseNumber: "28A",
          postalCode: "1182",
          locality: "Oslo",
          countryCode: "no",
        },
      },
    },
    {
      geometry: { type: "Point", coordinates: [10.75, 59.91] },
      properties: {
        id: "KVE:TopographicPlace:0301-LYNGVEIEN",
        layer: "street",
        source: "kartverket-matrikkelenadresse",
        names: { default: "Lyngveien", display: "Lyngveien, Oslo" },
        address: { locality: "Oslo", countryCode: "no" },
      },
    },
  ],
};

describe("Entur Geocoder v3 adapter", () => {
  it("uses only the current Norwegian Kartverket address/street endpoint and required identity header", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(response), { status: 200 }),
    );
    const suggestions = await fetchEnturAutocompleteV1(
      "  Lyngveien   28A ",
      fetcher,
    );
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain("/geocoder/v3/autocomplete");
    expect(String(url)).toContain("q=Lyngveien+28A");
    expect(String(url)).toContain("limit=6");
    expect(String(url)).toContain("countries=no");
    expect(String(url)).toContain("layers=address%2Cstreet");
    expect(String(url)).toContain("sources=kartverket-matrikkelenadresse");
    expect(init?.headers).toMatchObject({
      "ET-Client-Name": "fornyelsegruppen-roof-fusion",
    });
    expect(suggestions).toHaveLength(2);
  });

  it("maps a concrete address to canonical coordinates but leaves streets non-actionable", () => {
    const suggestions = parseEnturAutocompleteResponseV1(response);
    expect(suggestions[0]).toMatchObject({
      id: "KVE:PostalAddress:123",
      kind: "address",
      address: {
        latitude: 59.91138,
        longitude: 10.7494,
        postalCode: "1182",
      },
    });
    expect(suggestions[1]).toMatchObject({ kind: "street" });
    expect(suggestions[1]?.address).toBeUndefined();
  });

  it("accepts only bounded Norwegian official address form evidence", () => {
    const form = new FormData();
    form.set("selectedAddressId", "KVE:PostalAddress:123");
    form.set("selectedAddressLabel", "Lyngveien 28A, Oslo");
    form.set("selectedAddressPostalCode", "1182");
    form.set("selectedAddressCity", "Oslo");
    form.set("selectedAddressLatitude", "59.91138");
    form.set("selectedAddressLongitude", "10.7494");
    expect(addressCandidateFromEnturSelectionV1(form)).toMatchObject({
      id: "KVE:PostalAddress:123",
      latitude: 59.91138,
      longitude: 10.7494,
    });
    form.set("selectedAddressLatitude", "0");
    expect(addressCandidateFromEnturSelectionV1(form)).toBeNull();
  });

  it("uses selected Entur coordinates without duplicate geocoding and retains manual fallback", async () => {
    const fallback = vi.fn(async () => [
      {
        id: "manual",
        label: "Manuell adresse",
        postalCode: "0001",
        city: "Oslo",
        latitude: 59.9,
        longitude: 10.7,
        source: "Kartverket",
      },
    ]);
    const selected = new FormData();
    selected.set("addressQuery", "Lyngveien 28A");
    selected.set("selectedAddressId", "KVE:PostalAddress:123");
    selected.set("selectedAddressLabel", "Lyngveien 28A, Oslo");
    selected.set("selectedAddressPostalCode", "1182");
    selected.set("selectedAddressCity", "Oslo");
    selected.set("selectedAddressLatitude", "59.91138");
    selected.set("selectedAddressLongitude", "10.7494");
    expect(
      await resolveRoofFusionAddressQueryV1(selected, fallback),
    ).toMatchObject({
      id: "KVE:PostalAddress:123",
      latitude: 59.91138,
    });
    expect(fallback).not.toHaveBeenCalled();

    const manual = new FormData();
    manual.set("addressQuery", "Storgata 1 Oslo");
    expect(
      await resolveRoofFusionAddressQueryV1(manual, fallback),
    ).toMatchObject({
      id: "manual",
    });
    expect(fallback).toHaveBeenCalledOnce();
  });
});
