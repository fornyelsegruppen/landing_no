import { describe, expect, it, vi } from "vitest";
import { FakeMapEvidenceProvider } from "./schematic-evidence";
import { persistSchematicMeasurementEvidence } from "./persist-evidence";

describe("persist schematic measurement evidence", () => {
  it("stores private immutable evidence and links its hash to the measurement", async () => {
    const create = vi.fn().mockResolvedValue({ id: 91, filename: "proof.svg" });
    const update = vi.fn().mockResolvedValue({ id: 12, evidenceSnapshot: 91 });
    const provider = new FakeMapEvidenceProvider({
      bytes: Buffer.from("<svg/>", "utf8"), filename: "proof.svg", hash: "a".repeat(64), mimeType: "image/svg+xml",
      snapshot: { schemaVersion: 1, address: "Test", addressPoint: { latitude: 60, longitude: 10 }, candidates: [{ id: "way/1", label: "House", polygon: [{ latitude: 60, longitude: 10 }, { latitude: 60.1, longitude: 10 }, { latitude: 60, longitude: 10.1 }] }], selectedBuildingId: "way/1", source: "OSM", attribution: "© OSM", generatedAt: "2026-08-25T12:00:00.000Z" },
    });
    const result = await persistSchematicMeasurementEvidence({
      payload: { create, update } as never, provider, leadId: 7, measurementId: 12,
      address: "Test", addressPoint: { latitude: 60, longitude: 10 }, candidates: [], selectedBuildingId: "way/1", source: "OSM", attribution: "© OSM", generatedAt: new Date("2026-08-25T12:00:00.000Z"),
    });
    expect(result.evidence.hash).toBe("a".repeat(64));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ collection: "private-media", data: expect.objectContaining({ classification: "measurement", ownerId: "12" }) }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ collection: "roof-measurements", id: 12, data: expect.objectContaining({ evidenceHash: "a".repeat(64), evidenceSnapshot: 91, measurementMode: "schematic" }) }));
  });
});
