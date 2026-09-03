import { describe, expect, it } from "vitest";
import { mapRoofFusionHeightActionFailureV1 } from "@/lib/roof-fusion/preview-height-action-failure-v1";
import { OpenStreetMapBuildingProvider } from "./osm-building-provider";

const center = { latitude: 59.9, longitude: 10.7 };

function response(elements: unknown[]) {
  return new Response(JSON.stringify({ elements }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function mapResponse(id = 654) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
    <osm version="0.6">
      <node id="1" lat="59.89995" lon="10.6999" />
      <node id="2" lat="59.89995" lon="10.7001" />
      <node id="3" lat="59.90005" lon="10.7001" />
      <node id="4" lat="59.90005" lon="10.6999" />
      <way id="${id}">
        <nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
        <tag k="building" v="house"/>
      </way>
    </osm>`,
    { status: 200, headers: { "Content-Type": "application/xml" } },
  );
}

describe("OpenStreetMap building provider", () => {
  it("fails closed for non-finite and non-Norwegian address points", async () => {
    const fetcher = async () => response([]);
    const provider = new OpenStreetMapBuildingProvider(fetcher as typeof fetch);
    await expect(
      provider.findBuildings({
        latitude: Number.NaN,
        longitude: center.longitude,
      }),
    ).rejects.toThrow("finite coordinates");
    await expect(
      provider.findBuildings({ latitude: 40, longitude: center.longitude }),
    ).rejects.toThrow("inside Norway");
  });

  it("selects and ranks a building that contains the address point", async () => {
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain("building");
      return response([
        {
          type: "way",
          id: 123,
          tags: {
            building: "house",
            "addr:housenumber": "28A",
            "addr:street": "Lyngveien",
            name: "Testbolig",
          },
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

    const result = await new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
    ).findBuildings(center);
    expect(result[0]).toMatchObject({
      id: "way/123",
      containsAddress: true,
      confidence: "high",
      credits: "© OpenStreetMap contributors",
      license: "Open Database License (ODbL) 1.0",
      addressHouseNumber: "28A",
      addressStreet: "Lyngveien",
      buildingName: "Testbolig",
    });
    expect(result[0].polygon).toHaveLength(4);
    expect(result[0].horizontalAreaSquareMeters).toBeGreaterThan(50);
  });

  it("marks only-nearby buildings as requiring review", async () => {
    const fetcher = async () =>
      response([
        {
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
        },
      ]);

    const result = await new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
    ).findBuildings(center);
    expect(result[0].containsAddress).toBe(false);
    expect(result[0].confidence).toBe("medium");
  });

  it("rejects malformed public geometry instead of creating a price basis", async () => {
    const fetcher = async () =>
      response([
        {
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
        },
      ]);
    await expect(
      new OpenStreetMapBuildingProvider(fetcher as typeof fetch).findBuildings(
        center,
      ),
    ).resolves.toEqual([]);
  });

  it("automatically retries a fallback Overpass endpoint", async () => {
    const endpoints: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      endpoints.push(String(input));
      if (endpoints.length === 1) throw new Error("primary timeout");
      return response([
        {
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
        },
      ]);
    };
    const provider = new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
      "https://primary.test",
      "https://fallback.test",
    );
    await expect(provider.findBuildings(center)).resolves.toHaveLength(1);
    expect(endpoints).toEqual([
      "https://primary.test",
      "https://fallback.test",
    ]);
  });

  it("reserves bounded time for the map fallback within the total budget", async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      calls.push(String(input));
      await new Promise((resolve) => setTimeout(resolve, 200));
      return response([]);
    };
    const provider = new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
      "https://primary.test",
      "https://fallback.test",
      "https://map.test",
      100,
    );
    const started = Date.now();
    await expect(provider.findBuildings(center)).rejects.toThrow(
      "temporarily unavailable",
    );
    expect(Date.now() - started).toBeLessThan(200);
    expect(calls).toEqual([
      "https://primary.test",
      expect.stringMatching(/^https:\/\/map\.test\?bbox=/),
    ]);
  });

  it("uses the official map fallback after the primary Overpass deadline", async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === "https://primary.test") {
        return await new Promise<Response>(() => undefined);
      }
      return mapResponse(651);
    };
    const provider = new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
      "https://primary.test",
      "",
      "https://api.openstreetmap.org/api/0.6/map",
      60,
    );

    await expect(provider.findBuildings(center)).resolves.toMatchObject([
      { id: "way/651" },
    ]);
    expect(calls).toHaveLength(2);
  });

  it("uses the official map fallback after an Overpass 504", async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return url === "https://primary.test"
        ? new Response("busy", { status: 504 })
        : mapResponse(652);
    };
    const provider = new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
      "https://primary.test",
      "",
      "https://api.openstreetmap.org/api/0.6/map",
    );

    await expect(provider.findBuildings(center)).resolves.toMatchObject([
      { id: "way/652" },
    ]);
    expect(calls).toHaveLength(2);
  });

  it("classifies a primary and map failure as source validation", async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("unavailable", { status: 504 });
    };
    const provider = new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
      "https://primary.test",
      "",
      "https://api.openstreetmap.org/api/0.6/map",
    );
    let failure: unknown;
    try {
      await provider.findBuildings(center);
    } catch (error) {
      failure = error;
    }

    expect(calls).toHaveLength(2);
    expect(failure).toBeInstanceOf(Error);
    expect(
      mapRoofFusionHeightActionFailureV1(
        "building_revalidation",
        failure,
        "correlation-123",
      ).state,
    ).toMatchObject({ kind: "error", code: "SOURCE_VALIDATION_UNAVAILABLE" });
  });

  it("returns an explicit empty result for an empty XML map fallback", async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      if (String(input).includes("overpass")) throw new Error("overpass down");
      return new Response('<osm version="0.6"></osm>', {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    };
    const provider = new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
      "https://overpass.test",
      "",
      "https://map.test",
    );
    await expect(provider.findBuildings(center)).resolves.toEqual([]);
  });

  it("simplifies detailed rings without dropping their defining corners", async () => {
    const edge = Array.from({ length: 11 }, (_, index) => index / 10);
    const geometry = [
      ...edge.map((x) => ({ lat: 59.9, lon: 10.7 + x * 0.001 })),
      ...edge.slice(1).map((y) => ({ lat: 59.9 + y * 0.001, lon: 10.701 })),
      ...edge
        .slice(1)
        .reverse()
        .map((x) => ({ lat: 59.901, lon: 10.7 + x * 0.001 })),
      ...edge
        .slice(1)
        .reverse()
        .map((y) => ({ lat: 59.9 + y * 0.001, lon: 10.7 })),
      { lat: 59.9, lon: 10.7 },
    ];
    const fetcher = async () =>
      response([
        { type: "way", id: 777, tags: { building: "house" }, geometry },
      ]);
    const [candidate] = await new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
    ).findBuildings(center);
    expect(candidate.polygon).toHaveLength(30);
    const rounded = candidate.polygon.map((point) => ({
      latitude: Number(point.latitude.toFixed(4)),
      longitude: Number(point.longitude.toFixed(4)),
    }));
    expect(rounded).toEqual(
      expect.arrayContaining([
        { latitude: 59.9, longitude: 10.7 },
        { latitude: 59.9, longitude: 10.701 },
        { latitude: 59.901, longitude: 10.701 },
        { latitude: 59.901, longitude: 10.7 },
      ]),
    );
  });

  it("falls back to the core OpenStreetMap bbox endpoint when Overpass is unavailable", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("overpass"))
        throw new Error("overpass timeout");
      const url = new URL(String(input));
      const bbox = url.searchParams.get("bbox")?.split(",").map(Number) ?? [];
      expect(url.origin + url.pathname).toBe(
        "https://api.openstreetmap.test/map",
      );
      expect(bbox).toHaveLength(4);
      expect(bbox[2] - bbox[0]).toBeLessThan(0.003);
      expect(bbox[3] - bbox[1]).toBeLessThan(0.002);
      expect(init?.headers).toMatchObject({
        Accept: "application/xml",
        "User-Agent": expect.stringContaining("post@takfornyelse.as"),
      });
      return mapResponse();
    };
    const provider = new OpenStreetMapBuildingProvider(
      fetcher as typeof fetch,
      "https://overpass.test",
      "",
      "https://api.openstreetmap.test/map",
    );
    await expect(provider.findBuildings(center)).resolves.toMatchObject([
      { id: "way/654" },
    ]);
  });
});
