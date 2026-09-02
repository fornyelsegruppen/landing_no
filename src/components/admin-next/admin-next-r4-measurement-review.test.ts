import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminNextR4MeasurementReview,
  RoofFusionTransientR4Drawer,
} from "@/components/admin-next/admin-next-r4-measurement-review";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";
import type { HeightSurfaceVisualizationV1 } from "@/lib/roof-fusion/hoydedata-surface-visualization-v1";

const measurement = adminNextCaseWorkspaceFixture.measurementReview;
const transientVisualization = {
  schemaVersion: "height-surface-visualization.v1" as const,
  mimeType: "image/png" as const,
  dataUrl: "data:image/png;base64,AA==",
  width: 120,
  height: 80,
  overlayPoints: "0,0 120,0 120,80 0,80",
  planes: [
    {
      planeId: "plane-1",
      overlayPoints: "0,0 60,0 60,80 0,80",
      pitchDegrees: 26.57,
      azimuthDegrees: 90,
      horizontalAreaSquareMeters: 60,
      surfaceAreaSquareMeters: 67.1,
    },
    {
      planeId: "plane-2",
      overlayPoints: "60,0 120,0 120,80 60,80",
      pitchDegrees: 26.57,
      azimuthDegrees: 270,
      horizontalAreaSquareMeters: 60,
      surfaceAreaSquareMeters: 67.1,
    },
  ],
  ridge: {
    overlayPoints: "60,0 60,80",
    lengthMeters: 19.8,
  },
  minHeightAboveTerrainM: 3,
  maxHeightAboveTerrainM: 9,
  attribution:
    "Kartverket · NLOD 2.0 + OpenStreetMap contributors · ODbL 1.0",
} satisfies HeightSurfaceVisualizationV1;

describe("Admin Next R4 measurement review", () => {
  it("presents the owner-critical measurement facts and provenance", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        address: adminNextCaseWorkspaceFixture.address,
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
        owner: adminNextCaseWorkspaceFixture.owner.name,
      }),
    );

    expect(html).toContain("186,4");
    expect(html).toContain("82 %");
    expect(html).toContain("Reikia patikrinti 2 kraštus");
    expect(html).toContain("E-04");
    expect(html).toContain("E-11");
    expect(html).toContain("EVD-R4-1042-01");
  });

  it("keeps approval disabled and exposes only the working mutation fallback", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        address: adminNextCaseWorkspaceFixture.address,
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
        owner: adminNextCaseWorkspaceFixture.owner.name,
      }),
    );

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Confirm užrakintas");
    expect(html).toContain(`href="${measurement.fallbackHref}"`);
  });

  it("renders four primary slopes, photos, R3 delta and verification gates", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        address: adminNextCaseWorkspaceFixture.address,
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
        owner: adminNextCaseWorkspaceFixture.owner.name,
      }),
    );

    expect(html).toContain("S1");
    expect(html).toContain("S4");
    expect(html).toContain("Šaltiniai ir įrodymai");
    expect(html).toContain("Pasikeitė nuo R3");
    expect(html).toContain("Patikros vartai");
  });

  it("renders an approved canonical snapshot without fixture-only edge warnings", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const approved = {
      ...measurement,
      state: "verified" as const,
      planeCount: 2,
      reviewEdges: [],
      primarySlopes: measurement.primarySlopes.slice(0, 2),
      verificationGates: measurement.verificationGates.map((gate) => ({
        ...gate,
        state: "verified" as const,
        detail: gate.id === "review_edges" ? "0 conflict edge(s)" : "pass",
      })),
      nextAction: "Ready for approved rendering",
      diagram: {
        vertices: [
          { id: "v1", xMeters: 0, yMeters: 0 },
          { id: "v2", xMeters: 10, yMeters: 0 },
          { id: "v3", xMeters: 10, yMeters: 8 },
          { id: "v4", xMeters: 0, yMeters: 8 },
        ],
        surfaces: [
          { id: "S1", vertexIds: ["v1", "v2", "v3"] },
          { id: "S2", vertexIds: ["v1", "v3", "v4"] },
        ],
        edges: [
          { id: "ridge-1", fromVertexId: "v1", toVertexId: "v3", state: "verified" as const },
        ],
      },
    };
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        address: "Testgata 13, 0013 Oslo",
        locale: "lt",
        caseReference: "TF-13",
        customer: "UAT-01 Testkunde",
        measurement: approved,
        owner: "Aistė",
        source: "canonical",
      }),
    );

    expect(html).toContain("Canonical Roof Fusion");
    expect(html).toContain("Paruošta tvirtinti");
    expect(html).toContain("Duomenų pakanka");
    expect(html).toContain("Aistė");
    expect(html).toContain("Konfliktinių kraštų nėra");
    expect(html).toContain("Snapshot patvirtintas");
    expect(html).not.toContain("E-04");
    expect(html).not.toContain("E-11");
    expect(html).not.toContain("Sintetiniai Preview duomenys");
  });

  it("renders real evidence previews only through the authenticated admin proxy", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const withEvidence = {
      ...measurement,
      photos: [
        {
          id: "lead-13-photo-0",
          label: "Kliento nuotrauka 1",
          source: "Pateikė klientas",
          capturedAt: "2026-09-02T00:30:00.000Z",
          previewHref: "/api/admin/leads/13/photo?index=0",
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        address: "Testgata 13, 0013 Oslo",
        locale: "lt",
        caseReference: "TF-13",
        customer: "UAT-01 Testkunde",
        measurement: withEvidence,
        owner: "Aistė",
        source: "canonical",
      }),
    );

    expect(html).toContain("Kliento nuotrauka 1");
    expect(html).toContain("/api/admin/leads/13/photo?index=0");
    expect(html).not.toContain("blob.vercel-storage.com");
  });

  it("renders a transient Høydedata preview drawer with locked CTA and exact overlay wiring", () => {
    const html = renderToStaticMarkup(
      createElement(RoofFusionTransientR4Drawer, {
        locale: "lt",
        visualization: transientVisualization,
        horizontalAreaSquareMeters: 120,
        snapshotHash: "b".repeat(64),
      }),
    );

    expect(html).toContain('data-r4-transient-drawer="hoydedata_preview"');
    expect(html).toContain("Høydedata Preview");
    expect(html).toContain("review_required");
    expect(html).toContain("Patvirtinimas užrakintas");
    expect(html).toContain('viewBox="0 0 120 80"');
    expect(html).toContain('points="0,0 120,0 120,80 0,80"');
    expect(html).toContain('points="60,0 60,80"');
    expect(html).toContain("Horizontalus plotas");
    expect(html).toContain("120 m²");
    expect(html).toContain("Nežinoma");
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Patvirtinti R4 negalima");
    expect(html).not.toContain("0°");
    expect(html).not.toContain("/admin-next-preview/cases/");
    expect(html).not.toContain("<form");
  });
});
