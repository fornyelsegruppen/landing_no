import { describe, expect, it } from "vitest";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";
import { appendAdminNextR4LeadPhotoEvidence } from "@/lib/admin-next/r4-evidence-photo-adapter";

const measurement = adminNextCaseWorkspaceFixture.measurementReview;

describe("Admin Next R4 lead photo evidence adapter", () => {
  it("adds only authenticated admin proxy URLs and caps the drawer at four photos", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;

    const result = appendAdminNextR4LeadPhotoEvidence({
      measurement,
      leadId: 13,
      photoCount: 9,
      capturedAt: "2026-09-02T00:30:00.000Z",
      locale: "lt",
    });

    expect(result.photos.slice(0, 4)).toEqual([
      expect.objectContaining({
        label: "Kliento nuotrauka 1",
        previewHref: "/api/admin/leads/13/photo?index=0",
      }),
      expect.objectContaining({ previewHref: "/api/admin/leads/13/photo?index=1" }),
      expect.objectContaining({ previewHref: "/api/admin/leads/13/photo?index=2" }),
      expect.objectContaining({ previewHref: "/api/admin/leads/13/photo?index=3" }),
    ]);
    expect(result.photos.filter((photo) => photo.id.startsWith("lead-13-photo-"))).toHaveLength(4);
    expect(JSON.stringify(result.photos)).not.toContain("blob.vercel-storage.com");
  });

  it("keeps the canonical measurement unchanged when there are no lead photos", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;

    expect(
      appendAdminNextR4LeadPhotoEvidence({
        measurement,
        leadId: 13,
        photoCount: 0,
        capturedAt: "2026-09-02T00:30:00.000Z",
        locale: "en",
      }),
    ).toBe(measurement);
  });
});
