import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  prepareAutomaticLeadMeasurement,
  selectAutomaticBuildingCandidate,
} from "./automatic-package";

vi.mock("@/lib/measurements/persist-evidence", () => ({
  persistSchematicMeasurementEvidence: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/cases/case-command", () => ({
  updateCaseState: vi.fn().mockResolvedValue({}),
}));

function candidate(
  overrides: Partial<BuildingFootprintCandidate> = {},
): BuildingFootprintCandidate {
  return {
    id: "way/1",
    label: "house · 120 m²",
    polygon: [
      { latitude: 59, longitude: 10 },
      { latitude: 59, longitude: 10.001 },
      { latitude: 59.001, longitude: 10.001 },
    ],
    horizontalAreaSquareMeters: 120,
    distanceToAddressMeters: 0,
    containsAddress: true,
    confidence: "high",
    confidenceReasoning: "Adressepunktet ligger i bygningskonturen.",
    source: "OpenStreetMap building footprint via Overpass API",
    sourceUrl: "https://www.openstreetmap.org/way/1",
    license: "Open Database License (ODbL) 1.0",
    credits: "© OpenStreetMap contributors",
    ...overrides,
  };
}

describe("automatic building selection", () => {
  it("selects one high-confidence footprint containing the address", () => {
    expect(selectAutomaticBuildingCandidate([candidate()])).toMatchObject({
      candidate: { id: "way/1" },
      reason: null,
    });
  });

  it("blocks when more than one building contains the address", () => {
    expect(
      selectAutomaticBuildingCandidate([
        candidate(),
        candidate({ id: "way/2" }),
      ]),
    ).toEqual({
      candidate: null,
      reason: "multiple_buildings_contain_address",
    });
  });

  it("accepts a clearly nearest medium-confidence building but blocks a close tie", () => {
    const nearest = candidate({
      containsAddress: false,
      confidence: "medium",
      distanceToAddressMeters: 7,
    });
    const distant = candidate({
      id: "way/2",
      containsAddress: false,
      confidence: "medium",
      distanceToAddressMeters: 24,
    });
    expect(
      selectAutomaticBuildingCandidate([nearest, distant]).candidate?.id,
    ).toBe("way/1");
    expect(
      selectAutomaticBuildingCandidate([
        nearest,
        candidate({
          id: "way/3",
          containsAddress: false,
          confidence: "medium",
          distanceToAddressMeters: 11,
        }),
      ]),
    ).toMatchObject({ candidate: null, reason: "building_match_ambiguous" });
  });

  it("prepares measurement evidence without reading pricing or creating commercial records", async () => {
    const touchedCollections: string[] = [];
    const lead = {
      id: 7,
      status: "new",
      address: "Lyngveien 28A",
      postal: "1182",
      city: "Oslo",
      addressVerificationStatus: "verified",
      addressVerificationProvider: "kartverket-address-rest-v1",
      addressVerificationProviderId: "address-7",
      addressLatitude: 59.86,
      addressLongitude: 10.81,
      addressVerifiedAt: "2026-09-05T08:00:00.000Z",
      caseRevision: 1,
    };
    const payload = {
      async findByID({ collection }: { collection: string }) {
        touchedCollections.push(collection);
        return structuredClone(lead);
      },
      async find({ collection }: { collection: string }) {
        touchedCollections.push(collection);
        return { docs: [] };
      },
      async create({
        collection,
        data,
      }: {
        collection: string;
        data: Record<string, unknown>;
      }) {
        touchedCollections.push(collection);
        return { id: 70, ...structuredClone(data) };
      },
      async update({
        collection,
        data,
      }: {
        collection: string;
        data: Record<string, unknown>;
      }) {
        touchedCollections.push(collection);
        return { id: 70, ...structuredClone(data) };
      },
      async delete({ collection }: { collection: string }) {
        touchedCollections.push(collection);
        return {};
      },
    } as unknown as Payload;
    const addressProvider = {
      searchAddress: vi.fn().mockResolvedValue([
        {
          id: "address-7",
          label: "Lyngveien 28A, 1182 Oslo",
          postalCode: "1182",
          latitude: 59.86,
          longitude: 10.81,
        },
      ]),
    };
    const buildingProvider = {
      findBuildings: vi.fn().mockResolvedValue([candidate()]),
    };

    const result = await prepareAutomaticLeadMeasurement(payload, 7, {
      addresses: addressProvider as never,
      buildings: buildingProvider as never,
    });

    expect(result).toMatchObject({
      status: "ready",
      measurementId: 70,
      duplicate: false,
    });
    expect(touchedCollections).toContain("roof-measurements");
    expect(touchedCollections).not.toEqual(
      expect.arrayContaining([
        "price-rules",
        "price-calculations",
        "quotes",
        "contracts",
      ]),
    );
    expect(addressProvider.searchAddress).not.toHaveBeenCalled();
  });

  it("blocks automatic measurement when address text has no server verification evidence", async () => {
    const update = vi.fn().mockResolvedValue({});
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 8,
        status: "new",
        address: "Manualveien 8",
        postal: "1182",
        city: "Oslo",
        addressVerificationStatus: "manual",
        caseRevision: 1,
      }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      update,
    } as unknown as Payload;
    const buildings = { findBuildings: vi.fn() };

    const result = await prepareAutomaticLeadMeasurement(payload, 8, {
      buildings: buildings as never,
    });

    expect(result).toMatchObject({
      status: "blocked",
      code: "ADDRESS_UNVERIFIED",
    });
    expect(buildings.findBuildings).not.toHaveBeenCalled();
  });
});
