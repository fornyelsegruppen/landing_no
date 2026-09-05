import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminNextRoofFusionUatControl,
  HeightAnalysisPanel,
  RealAddressResult,
  roofFusionHeightErrorMessage,
  selectActiveHeightState,
} from "./admin-next-roof-fusion-uat-control";
import type { RoofFusionHeightAnalysisState } from "./admin-next-roof-fusion-uat-control";

describe("Admin Next Roof Fusion UAT control", () => {
  it("does not mislabel an address/OSM revalidation outage as Høydedata failure", () => {
    expect(
      roofFusionHeightErrorMessage("lt", "SOURCE_VALIDATION_UNAVAILABLE"),
    ).toContain("Høydedata dar nebuvo skaitomi");
    expect(
      roofFusionHeightErrorMessage("lt", "SOURCE_VALIDATION_UNAVAILABLE"),
    ).not.toContain("aukščio duomenys laikinai nepasiekiami");
  });

  it("keeps the last valid surface visible when a manual correction fails", () => {
    const previous = {
      kind: "success",
      candidateId: "way/123",
      summary: {},
      visualization: {},
    } as unknown as Extract<RoofFusionHeightAnalysisState, { kind: "success" }>;

    expect(
      selectActiveHeightState(
        { kind: "error", code: "RIDGE_CORRECTION_REVIEW_REQUIRED" },
        previous,
        "way/123",
      ),
    ).toBe(previous);
    expect(
      selectActiveHeightState(
        { kind: "error", code: "RIDGE_CORRECTION_REVIEW_REQUIRED" },
        previous,
        "way/other",
      ),
    ).toBeNull();
    expect(
      roofFusionHeightErrorMessage("lt", "RIDGE_CORRECTION_REVIEW_REQUIRED"),
    ).toContain("kraigo korekcijos");
  });

  it("renders an explicit, Preview-only synthetic preparation action", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUatControl, {
        action: async () => ({ kind: "idle" as const }),
        actorId: "7",
        addressLookupAction: async () => ({ kind: "idle" as const }),
        heightAnalysisAction: async () => ({ kind: "idle" as const }),
        defaultCaseReference: "TF-13",
        locale: "lt",
      }),
    );

    expect(html).toContain('data-roof-fusion-uat="preview-only"');
    expect(html).toContain('name="caseReference"');
    expect(html).toContain("Paruošti R4 UAT");
    expect(html).toContain("TF-13");
    expect(html).toContain("Production duomenys neliečiami");
    expect(html).toContain('data-roof-fusion-address="lookup-only"');
    expect(html).toContain('data-rf-free-address-input="diagnostic-only"');
    expect(html).toContain('name="addressQuery"');
    expect(html).toContain("Diagnostinis RF UAT");
    expect(html).toContain("ne gyvas bylos procesas");
    expect(html).toContain("nepatenka į kainodarą ar pasiūlymą");
    expect(html).toContain("Rasti adresą ir atverti ortofoto");
    expect(html).toContain("vieną licencijuotą Norge i bilder ortofoto");
    expect(html).toContain("Matavimas dar nesukuriamas");
  });

  it("renders a truthful real-address footprint without claiming orthophoto or roof planes", () => {
    const html = renderToStaticMarkup(
      createElement(RealAddressResult, {
        actorId: "7",
        caseReference: "TF-13",
        heightAnalysisAction: async () => ({ kind: "idle" as const }),
        locale: "lt",
        result: {
          kind: "success" as const,
          address: {
            id: "0301-1-1-0-0-Storgata 1",
            label: "Storgata 1, 0155 Oslo",
            postalCode: "0155",
            city: "Oslo",
            latitude: 59.9127,
            longitude: 10.7461,
            source: "Kartverket",
          },
          candidates: [
            {
              id: "way/123",
              label: "house · 120 m²",
              polygon: [
                { latitude: 59.9126, longitude: 10.746 },
                { latitude: 59.9126, longitude: 10.7462 },
                { latitude: 59.9128, longitude: 10.7462 },
                { latitude: 59.9128, longitude: 10.746 },
              ],
              horizontalAreaSquareMeters: 120,
              distanceToAddressMeters: 0,
              containsAddress: true,
              confidence: "high",
              confidenceReasoning: "Address point is inside the footprint",
              source: "OpenStreetMap building footprint via Overpass API",
              sourceUrl: "https://www.openstreetmap.org/way/123",
              license: "Open Database License (ODbL) 1.0",
              credits: "© OpenStreetMap contributors",
            },
          ],
          enginePreviews: [
            {
              kind: "success" as const,
              candidateId: "way/123",
              summary: {
                schemaVersion: "roof-fusion-osm-preview.v1" as const,
                candidateId: "way/123",
                contractStatus: "valid" as const,
                reviewState: "review_required" as const,
                qualityStatus: "review_required" as const,
                measurementClass: "preliminary" as const,
                pricingReady: false as const,
                blockers: [
                  "ROOF_PLANES_REQUIRED" as const,
                  "ROOF_PITCH_REQUIRED" as const,
                  "LICENSED_IMAGERY_REQUIRED" as const,
                ],
                engineHorizontalAreaSquareMeters: 120.01,
                providerHorizontalAreaSquareMeters: 120,
                areaDeltaPercent: 0.008,
                footprintPerimeterMeters: 45.7,
                calculationHash: "a".repeat(64),
                snapshotHash: "b".repeat(64),
                renderHash: "c".repeat(64),
              },
            },
          ],
        },
      }),
    );

    expect(html).toContain("Storgata 1, 0155 Oslo");
    expect(html).toContain("120 m²");
    expect(html).toContain("© OpenStreetMap contributors");
    expect(html).toContain("gaukite nemokamą 1 m aukščių modelį");
    expect(html).toContain("Gauti tikrą stogo paviršių");
    expect(html).toContain("dar ne galutiniai stogo šlaitai");
    expect(html).toContain(
      'data-roof-fusion-engine-contract="valid-review-required"',
    );
    expect(html).toContain("Variklio kontraktas galioja");
    expect(html).toContain("DAR NETINKA KAINODARAI");
    expect(html).toContain("Reikia nustatyti tikrus stogo šlaitus");
    expect(html).toContain("120 m²");
    expect(html).toContain("45,7 m");
    expect(html).not.toContain("Paruošta tvirtinti");
  });

  it("renders segmented roof-plane overlays, real surface area, and explicit preview status", () => {
    const html = renderToStaticMarkup(
      createElement(HeightAnalysisPanel, {
        locale: "lt",
        state: {
          kind: "success" as const,
          candidateId: "way/123",
          summary: {
            schemaVersion: "roof-fusion-height-surface-preview.v1" as const,
            candidateId: "way/123",
            contractStatus: "valid" as const,
            reviewState: "review_required" as const,
            qualityStatus: "review_required" as const,
            measurementClass: "preliminary" as const,
            pricingReady: false as const,
            manualRidgeCorrectionStatus: "available" as const,
            blockers: [
              "ROOF_PLANES_REQUIRED" as const,
              "ROOF_PITCH_REQUIRED" as const,
              "ROOF_SURFACE_RENDER_REQUIRED" as const,
            ],
            engineHorizontalAreaSquareMeters: 120,
            footprintPerimeterMeters: 46,
            roofCells: 28,
            footprintCells: 32,
            roofCoverageRatio: 0.875,
            groundElevationMedianM: 101.2,
            roofHeightP10M: 5.8,
            roofHeightMedianM: 7.4,
            roofHeightP90M: 9.1,
            calculationHash: "a".repeat(64),
            snapshotHash: "b".repeat(64),
            renderHash: "c".repeat(64),
          },
          visualization: {
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
          },
        },
      }),
    );

    expect(html).toContain('data-roof-fusion-height-segmentation="present"');
    expect(html).toContain("PREVIEW");
    expect(html).toContain("Reikalinga rankinė peržiūra");
    expect(html).toContain("Šlaitų sluoksniai");
    expect(html).toContain("Tikras stogo paviršius");
    expect(html).toContain("134,2 m²");
    expect(html).toContain("Šlaitas 1");
    expect(html).toContain("26,6°");
    expect(html).toContain("Kraigo linija: 19,8 m");
  });
});
