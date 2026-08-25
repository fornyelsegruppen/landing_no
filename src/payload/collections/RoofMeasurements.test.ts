import { describe, expect, it } from "vitest";
import { enforceMeasurementApproval, protectApprovedMeasurement } from "./RoofMeasurements";

describe("approved roof measurement immutability", () => {
  it("allows status-only updates without treating omitted fields as changes", () => {
    expect(protectApprovedMeasurement({
      operation: "update", data: { status: "superseded" },
      originalDoc: { status: "approved", roofPlanes: [{ id: "a" }], normalizedAddress: "Test" },
    } as never)).toMatchObject({ status: "superseded" });
  });

  it("rejects editing an approved polygon in place", () => {
    expect(() => protectApprovedMeasurement({
      operation: "update", data: { roofPlanes: [{ id: "b" }] },
      originalDoc: { status: "approved", roofPlanes: [{ id: "a" }] },
    } as never)).toThrow(/new version/);
  });

  it("rejects replacing an approved evidence snapshot in place", () => {
    expect(() => protectApprovedMeasurement({
      operation: "update", data: { evidenceHash: "b".repeat(64) },
      originalDoc: { status: "approved", evidenceHash: "a".repeat(64) },
    } as never)).toThrow(/new version/);
  });

  it("blocks low confidence even through the collection API", async () => {
    const req = { user: { id: 1, active: true, role: "admin" }, payload: {
      findByID: async () => ({ inquiryType: "takvask" }),
      count: async () => ({ totalDocs: 1 }),
    } };
    await expect(enforceMeasurementApproval({ operation: "update", data: { status: "approved" }, originalDoc: {
      status: "blocked", lead: 2, addressSourceId: "official-1", imageryLicensed: true,
      buildingIdentifier: "building", confidence: "low", confidenceReasoning: "Roof edge is obscured and cannot be verified.",
      roofPlanes: [{ id: "a", polygon: [{ latitude: 60, longitude: 10 }, { latitude: 60, longitude: 10.001 }, { latitude: 60.001, longitude: 10 }], angleMinDegrees: 22, angleMaxDegrees: 32 }],
    }, req } as never)).rejects.toThrow(/confidence_low/);
  });

  it("allows an auditable manual no-visual measurement without fabricated map evidence", async () => {
    const req = { user: { id: 1, active: true, role: "admin" }, payload: {
      findByID: async () => ({ inquiryType: "takvask" }),
      count: async () => ({ totalDocs: 1 }),
    } };
    const result = await enforceMeasurementApproval({ operation: "update", data: { status: "approved" }, originalDoc: {
      id: 8, version: 1, status: "review_required", lead: 2, normalizedAddress: "Manuell adresse",
      measurementMode: "manual_no_visual", manualAreaSource: "customer", manualAreaReason: "Oppgitt og bekreftet av kunden.",
      calculationSnapshot: { manualOverride: { areaTenths: 1250 } },
    }, req } as never);
    expect(result).toMatchObject({ status: "approved", actualAreaMinTenths: 1250, actualAreaMaxTenths: 1250, blockingReasons: [] });
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
