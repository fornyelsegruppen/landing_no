import { describe, expect, it } from "vitest";
import { createMapReviewLinks } from "./map-review-links";

describe("measurement map review links", () => {
  it("builds an address search and a satellite control view without embedding third-party imagery", () => {
    const links = createMapReviewLinks({
      address: "Lyngveien 28A, 1182 Oslo",
      latitude: 59.8964,
      longitude: 10.7901,
      sourceUrl: "https://www.openstreetmap.org/way/123",
    });

    expect(links.norgeskart).toContain("sok=Lyngveien+28A%2C+1182+Oslo");
    expect(links.googleMaps).toContain("center=59.8964%2C10.7901");
    expect(links.googleMaps).toContain("basemap=satellite");
    expect(links.source).toBe("https://www.openstreetmap.org/way/123");
  });

  it("falls back to an address search when coordinates are unavailable", () => {
    const links = createMapReviewLinks({ address: "Testveien 1" });
    expect(links.googleMaps).toContain("/maps/search/");
    expect(links.googleMaps).toContain("query=Testveien+1");
  });
});
