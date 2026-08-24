import { describe, expect, it } from "vitest";
import { OpenStreetMapBuildingProvider } from "./osm-building-provider";

const center = { latitude: 59.9, longitude: 10.7 };

function response(elements: unknown[]) {
  return new Response(JSON.stringify({ elements }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenStreetMap building provider", () => {
  it("selects and ranks a building that contains the address point", async () => {
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain("building");
      return response([
        {
          type: "way",
          id: 123,
          tags: { building: "house" },
          geometry: [
            { lat: 59.89995, lon: 10.6999 },
            { lat: 59.89995, lon: 10.7001 },
            { lat: 59.90005, lon: 10.7001 },
            { lat: 59.90005, lon: 10.6999 },
            { lat: 59.89995, lon: 10.6999 },
          ],
        },
        {
          type: "way",
          id: 456,
          tags: { building: "garage" },
          geometry: [
            { lat: 59.9002, lon: 10.7002 },
            { lat: 59.9002, lon: 10.7003 },
            { lat: 59.90025, lon: 10.7003 },
            { lat: 59.90025, lon: 10.7002 },
            { lat: 59.9002, lon: 10.7002 },
          ],
        },
      ]);
    };

    const result = await new OpenStreetMapBuildingProvider(fetcher as typeof fetch).findBuildings(center);
    expect(result[0]).toMatchObject({
      id: "way/123",
      containsAddress: true,
      confidence: "high",
      credits: "© OpenStreetMap contributors",
      license: "Open Database License (ODbL) 1.0",
    });
    expect(result[0].polygon).toHaveLength(4);
    expect(result[0].horizontalAreaSquareMeters).toBeGreaterThan(50);
  });

  it("marks only-nearby buildings as requiring review", async () => {
    const fetcher = async () => response([{
      type: "way",
      id: 789,
      tags: { building: "yes" },
      geometry: [
        { lat: 59.90008, lon: 10.70008 },
        { lat: 59.90008, lon: 10.7002 },
        { lat: 59.90016, lon: 10.7002 },
        { lat: 59.90016, lon: 10.70008 },
        { lat: 59.90008, lon: 10.70008 },
      ],
    }]);

    const result = await new OpenStreetMapBuildingProvider(fetcher as typeof fetch).findBuildings(center);
    expect(result[0].containsAddress).toBe(false);
    expect(result[0].confidence).toBe("medium");
  });

  it("rejects malformed public geometry instead of creating a price basis", async () => {
    const fetcher = async () => response([{
      type: "way",
      id: 999,
      tags: { building: "house" },
      geometry: [
        { lat: 59.9, lon: 10.7 },
        { lat: 59.901, lon: 10.701 },
        { lat: 59.9, lon: 10.701 },
        { lat: 59.901, lon: 10.7 },
        { lat: 59.9, lon: 10.7 },
      ],
    }]);
    await expect(new OpenStreetMapBuildingProvider(fetcher as typeof fetch).findBuildings(center)).resolves.toEqual([]);
  });

  it("automatically retries a fallback Overpass endpoint", async () => {
    const endpoints: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      endpoints.push(String(input));
      if (endpoints.length === 1) throw new Error("primary timeout");
      return response([{
        type: "way",
        id: 321,
        tags: { building: "house" },
        geometry: [
          { lat: 59.89995, lon: 10.6999 },
          { lat: 59.89995, lon: 10.7001 },
          { lat: 59.90005, lon: 10.7001 },
          { lat: 59.90005, lon: 10.6999 },
          { lat: 59.89995, lon: 10.6999 },
        ],
      }]);
    };
    const provider = new OpenStreetMapBuildingProvider(fetcher as typeof fetch, "https://primary.test", "https://fallback.test");
    await expect(provider.findBuildings(center)).resolves.toHaveLength(1);
    expect(endpoints).toEqual(["https://primary.test", "https://fallback.test"]);
  });
});
