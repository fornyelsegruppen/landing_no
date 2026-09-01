import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

const measurement = adminNextCaseWorkspaceFixture.measurementReview;

describe("Admin Next R4 measurement review", () => {
  it("presents the owner-critical measurement facts and provenance", () => {
    expect(measurement).toBeDefined();
    if (!measurement) return;
    const html = renderToStaticMarkup(
      createElement(AdminNextR4MeasurementReview, {
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
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
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
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
        locale: "lt",
        caseReference: adminNextCaseWorkspaceFixture.reference,
        customer: adminNextCaseWorkspaceFixture.customer,
        measurement,
      }),
    );

    expect(html).toContain("S1");
    expect(html).toContain("S4");
    expect(html).toContain("Nuotraukos ir šaltiniai");
    expect(html).toContain("Pasikeitė nuo R3");
    expect(html).toContain("Verification gates");
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
        locale: "lt",
        caseReference: "TF-13",
        customer: "UAT-01 Testkunde",
        measurement: approved,
        source: "canonical",
      }),
    );

    expect(html).toContain("Canonical Roof Fusion");
    expect(html).toContain("Patvirtinta");
    expect(html).toContain("Konfliktinių kraštų nėra");
    expect(html).toContain("Snapshot patvirtintas");
    expect(html).not.toContain("E-04");
    expect(html).not.toContain("E-11");
    expect(html).not.toContain("Sintetiniai Preview duomenys");
  });
});
