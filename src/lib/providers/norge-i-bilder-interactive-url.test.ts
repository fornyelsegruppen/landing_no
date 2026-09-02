import { describe, expect, it } from "vitest";
import {
  norgeIBilderInteractiveExtent,
  NorgeIBilderInteractiveUrlBuilder,
} from "./norge-i-bilder-interactive-url";

describe("Norge i bilder interactive URL builder", () => {
  it("builds the approved interactive EPSG:25833 extent URL without OGC parameters", () => {
    const result = new NorgeIBilderInteractiveUrlBuilder().build({
      target: {
        latitude: 59.91137749505985,
        longitude: 10.749403964838672,
      },
      viewport: { width: 1920, height: 1080 },
    });
    const { url } = result;

    expect(url.origin + url.pathname).toBe("https://norgeibilder.no/");
    expect(url.searchParams.get("wkid")).toBe("25833");
    expect(url.searchParams.get("is3d")).toBe("false");
    expect(Number(url.searchParams.get("xmax"))).toBeCloseTo(262434.294, 2);
    expect(Number(url.searchParams.get("xmin"))).toBeCloseTo(262338.294, 2);
    expect(Number(url.searchParams.get("ymax"))).toBeCloseTo(6649200.086, 2);
    expect(Number(url.searchParams.get("ymin"))).toBeCloseTo(6649146.086, 2);
    expect(url.toString().toLowerCase()).not.toMatch(/wms|wmts|service=/);
    expect(result.bounds).toEqual({
      minEastingM: Number(url.searchParams.get("xmin")),
      maxEastingM: Number(url.searchParams.get("xmax")),
      minNorthingM: Number(url.searchParams.get("ymin")),
      maxNorthingM: Number(url.searchParams.get("ymax")),
    });
  });

  it("uses the requested viewport aspect ratio for the only extent calculation", () => {
    const target = {
      latitude: 59.91137749505985,
      longitude: 10.749403964838672,
    };
    const wide = norgeIBilderInteractiveExtent({
      target,
      viewport: { width: 1920, height: 1080 },
    });
    const square = norgeIBilderInteractiveExtent({
      target,
      viewport: { width: 1080, height: 1080 },
    });

    expect(wide.maxEastingM - wide.minEastingM).toBeCloseTo(96, 3);
    expect(wide.maxNorthingM - wide.minNorthingM).toBeCloseTo(54, 3);
    expect(
      (wide.maxEastingM - wide.minEastingM) /
        (wide.maxNorthingM - wide.minNorthingM),
    ).toBeCloseTo(1920 / 1080, 3);
    expect(square.maxEastingM - square.minEastingM).toBeCloseTo(54, 3);
  });
});
