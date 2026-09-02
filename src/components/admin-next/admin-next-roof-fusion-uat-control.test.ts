import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminNextRoofFusionUatControl,
  RealAddressResult,
} from "./admin-next-roof-fusion-uat-control";

describe("Admin Next Roof Fusion UAT control", () => {
  it("renders an explicit, Preview-only synthetic preparation action", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextRoofFusionUatControl, {
        action: async () => ({ kind: "idle" as const }),
        addressLookupAction: async () => ({ kind: "idle" as const }),
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
    expect(html).toContain('name="addressQuery"');
    expect(html).toContain("Rasti pastatą");
    expect(html).toContain("Paieška neišsaugoma ir nesukuria matavimo");
  });

  it("renders a truthful real-address footprint without claiming orthophoto or roof planes", () => {
    const html = renderToStaticMarkup(
      createElement(RealAddressResult, {
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
    expect(html).toContain(
      "Ortofoto bus prijungtas gavus licencijuotą prieigą",
    );
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
});
