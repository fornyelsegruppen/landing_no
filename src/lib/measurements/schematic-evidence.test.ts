import { describe, expect, it } from "vitest";
import {
  SchematicRoofEvidenceProvider,
  type SchematicEvidenceInput,
} from "./schematic-evidence";

const input = {
  address: "Lyngveien 28A, 1182 Oslo",
  addressPoint: { latitude: 59.88, longitude: 10.79 },
  candidates: [
    {
      id: "way/2",
      label: "Garasje",
      polygon: [
        { latitude: 59.8801, longitude: 10.7902 },
        { latitude: 59.8801, longitude: 10.7904 },
        { latitude: 59.8799, longitude: 10.7904 },
      ],
    },
    {
      id: "way/1",
      label: "Bolig",
      addressHouseNumber: "28A",
      addressStreet: "Lyngveien",
      polygon: [
        { latitude: 59.88, longitude: 10.7898 },
        { latitude: 59.8802, longitude: 10.79 },
        { latitude: 59.88, longitude: 10.7901 },
      ],
    },
  ],
  selectedBuildingId: "way/1",
  source: "OpenStreetMap building footprint via Overpass API",
  attribution: "© OpenStreetMap contributors",
  generatedAt: "2026-08-25T12:00:00.000Z",
} satisfies SchematicEvidenceInput;

describe("schematic roof evidence", () => {
  it("renders deterministic, attributed and visibly selected evidence", async () => {
    const provider = new SchematicRoofEvidenceProvider();
    const first = await provider.render(input);
    const second = await provider.render(input);
    expect(first.hash).toBe(second.hash);
    expect(first.mimeType).toBe("image/svg+xml");
    expect(first.bytes.toString()).toContain('data-building-id="way/1"');
    expect(first.bytes.toString()).toContain("#f2a900");
    expect(first.bytes.toString()).toContain("© OpenStreetMap contributors");
    expect(first.bytes.toString()).toContain("OVERSIKT");
    expect(first.bytes.toString()).toContain("VALGT BYGG");
    expect(first.bytes.toString()).toContain("Målt bygning");
    expect(first.bytes.toString()).toContain("Nærmeste gate: Lyngveien");
    expect(first.bytes.toString()).toContain("28A");
    expect(first.bytes.toString()).toContain("VALGT: 28A");
    expect(first.bytes.toString()).toContain("Målestokk");
    expect(first.snapshot.candidates.map((candidate) => candidate.id)).toEqual([
      "way/1",
      "way/2",
    ]);
    expect(first.snapshot.schemaVersion).toBe(2);
  });

  it("refuses to fabricate evidence without a polygon", async () => {
    await expect(
      new SchematicRoofEvidenceProvider().render({ ...input, candidates: [] }),
    ).rejects.toThrow(/polygon/);
  });
});
