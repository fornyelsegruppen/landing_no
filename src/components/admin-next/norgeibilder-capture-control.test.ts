import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  captureMatchesSelectedAddress,
  NorgeIBilderCaptureControl,
  normalizeOrthoOverlayPoints,
  type NorgeIBilderCaptureResult,
} from "./norgeibilder-capture-control";
import type { GeoReference } from "./norgeibilder-projection";

const capturedAddress = {
  id: "0301-1-2-0-0-Lyngveien 28A",
  label: "Lyngveien 28A, 1182 OSLO",
  postalCode: "1182",
  city: "OSLO",
  latitude: 59.91137749505985,
  longitude: 10.749403964838672,
  source: "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
};

describe("Norge i bilder capture control", () => {
  const geoReference: GeoReference = {
    crs: "EPSG:25833",
    extentTrust: "actual-visible-extent",
    bounds: {
      minEastingM: 0,
      minNorthingM: 0,
      maxEastingM: 10,
      maxNorthingM: 10,
    },
    imageWidth: 1000,
    imageHeight: 500,
  };

  it("normalizes a georeferenced outline for the unified workbench", () => {
    expect(
      normalizeOrthoOverlayPoints("100,50 900,50 900,450", geoReference),
    ).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
    ]);
  });

  it("does not activate an outline when projected points are outside the image", () => {
    expect(
      normalizeOrthoOverlayPoints("-1,50 900,50 900,450", geoReference),
    ).toBeNull();
  });

  it("accepts the server-resolved address identity in the capture response", () => {
    const result: NorgeIBilderCaptureResult = {
      addressLabel: "Storgata 1, Oslo",
      attribution: "©norgeibilder.no",
      capturedAt: "2026-09-02T10:00:00Z",
      imageUrl: "data:image/png;base64,preview",
      source: "norgeibilder.no",
    };
    expect(result.addressLabel).toContain("Storgata");
  });

  it("renders a single explicit case action with attribution contract", () => {
    const html = renderToStaticMarkup(
      createElement(NorgeIBilderCaptureControl, {
        api: async () => ({ imageUrl: "data:image/png;base64,preview" }),
        caseReference: "TF-13",
        leadId: 13,
      }),
    );

    expect(html).toContain('data-norgeibilder-capture="single-case"');
    expect(html).toContain("Gauti vaizdą iš Norge i bilder");
    expect(html).toContain("©norgeibilder.no");
    expect(html).not.toContain("Naudoti vaizdą");
    expect(html).not.toContain("masinis");
  });

  it("keeps the default server capture path available when no adapter is injected", () => {
    const html = renderToStaticMarkup(
      createElement(NorgeIBilderCaptureControl, {
        caseReference: "TF-13",
        leadId: 13,
      }),
    );
    expect(html).toContain("Gauti vaizdą iš Norge i bilder");
  });

  it("only binds the overlay when capture and selected address identities match", () => {
    expect(
      captureMatchesSelectedAddress(capturedAddress, capturedAddress),
    ).toBe(true);
    expect(
      captureMatchesSelectedAddress(capturedAddress, {
        ...capturedAddress,
        id: "4601-9-9-0-0-Annen vei 1",
        label: "Annen vei 1, 5003 BERGEN",
      }),
    ).toBe(false);
  });

  it("accepts harmless Kartverket identity drift for the same nearby address", () => {
    expect(
      captureMatchesSelectedAddress(capturedAddress, {
        ...capturedAddress,
        id: `${capturedAddress.id}-normalized`,
        label: "  LYNGVEIEN 28A, 1182 oslo ",
        latitude: capturedAddress.latitude + 0.000_02,
        longitude: capturedAddress.longitude - 0.000_02,
      }),
    ).toBe(true);
  });
});
