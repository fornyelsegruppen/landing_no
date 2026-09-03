import { z } from "zod";
import { polygonAreaSquareMeters } from "../measurements/geometry";
import type { GeoPoint, MeasurementConfidence } from "../measurements/types";
import type { ProviderHealth } from "./contracts";

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";
const DEFAULT_MAP_ENDPOINT = "https://api.openstreetmap.org/api/0.6/map";
const SEARCH_RADIUS_METERS = 60;
const MAX_MAP_BBOX_SPAN_DEGREES = 0.01;
const MAX_POLYGON_POINTS = 30;
const LOOKUP_DEADLINE_MS = 8_000;
const OVERPASS_BUDGET_RATIO = 0.4;
const MAX_OVERPASS_BUDGET_MS = 3_000;
const MAX_MAP_FALLBACK_BUDGET_MS = 4_500;
const USER_AGENT =
  "Takfornyelse-roof-footprint/1.0 (+https://takfornyelse.no; contact: post@takfornyelse.as)";

const geometryPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const elementSchema = z.object({
  type: z.enum(["way", "relation"]),
  id: z.number().int(),
  tags: z.record(z.string(), z.string()).optional().default({}),
  geometry: z.array(geometryPointSchema).optional(),
  members: z
    .array(
      z.object({
        type: z.string(),
        ref: z.number().int(),
        role: z.string().optional().default(""),
        geometry: z.array(geometryPointSchema).optional(),
      }),
    )
    .optional(),
});

const overpassResponseSchema = z.object({
  elements: z.array(elementSchema).default([]),
});

function assertNorwegianAddressPoint(point: GeoPoint) {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < 57 ||
    point.latitude > 72 ||
    point.longitude < 4 ||
    point.longitude > 32
  ) {
    throw new TypeError(
      "OpenStreetMap building lookup requires finite coordinates inside Norway",
    );
  }
}

export type BuildingFootprintCandidate = {
  id: string;
  label: string;
  addressHouseNumber?: string;
  addressStreet?: string;
  buildingName?: string;
  polygon: GeoPoint[];
  horizontalAreaSquareMeters: number;
  distanceToAddressMeters: number;
  containsAddress: boolean;
  confidence: MeasurementConfidence;
  confidenceReasoning: string;
  source: "OpenStreetMap building footprint via Overpass API";
  sourceUrl: string;
  license: "Open Database License (ODbL) 1.0";
  credits: "© OpenStreetMap contributors";
};

type RawPolygon = {
  id: string;
  tags: Record<string, string>;
  geometry: z.infer<typeof geometryPointSchema>[];
};

function decodeXmlAttribute(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function xmlAttributes(value: string) {
  return Object.fromEntries(
    Array.from(value.matchAll(/([\w:.-]+)="([^"]*)"/g)).map((match) => [
      match[1],
      decodeXmlAttribute(match[2]),
    ]),
  );
}

function parseOsmMapXml(xml: string): z.infer<typeof overpassResponseSchema> {
  const nodes = new Map<string, z.infer<typeof geometryPointSchema>>();
  for (const match of xml.matchAll(/<node\b([^>]*)>/g)) {
    const attributes = xmlAttributes(match[1]);
    const lat = Number(attributes.lat);
    const lon = Number(attributes.lon);
    if (attributes.id && Number.isFinite(lat) && Number.isFinite(lon)) {
      nodes.set(attributes.id, { lat, lon });
    }
  }

  const elements: z.infer<typeof elementSchema>[] = [];
  for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
    const wayAttributes = xmlAttributes(match[1]);
    const body = match[2];
    const tags = Object.fromEntries(
      Array.from(body.matchAll(/<tag\b([^>]*)\/?\s*>/g))
        .map((tagMatch) => xmlAttributes(tagMatch[1]))
        .filter((tag) => tag.k && tag.v)
        .map((tag) => [tag.k, tag.v]),
    );
    if (!tags.building || !wayAttributes.id) continue;

    const geometry = Array.from(body.matchAll(/<nd\b([^>]*)\/?\s*>/g))
      .map((nodeMatch) => xmlAttributes(nodeMatch[1]).ref)
      .map((nodeId) => nodes.get(nodeId))
      .filter((point): point is z.infer<typeof geometryPointSchema> =>
        Boolean(point),
      );
    if (geometry.length >= 4) {
      elements.push({
        type: "way",
        id: Number(wayAttributes.id),
        tags,
        geometry,
      });
    }
  }

  return { elements };
}

function samePoint(left: GeoPoint, right: GeoPoint) {
  return left.latitude === right.latitude && left.longitude === right.longitude;
}

function normalizePolygon(
  geometry: z.infer<typeof geometryPointSchema>[],
): GeoPoint[] {
  const points = geometry.map((point) => ({
    latitude: point.lat,
    longitude: point.lon,
  }));
  if (points.length > 1 && samePoint(points[0], points[points.length - 1]))
    points.pop();
  if (points.length <= MAX_POLYGON_POINTS) return points;

  // Remove the least significant vertex at each step. Unlike uniform sampling,
  // this keeps corners and other shape-defining facade details deterministic.
  const simplified = [...points];
  while (simplified.length > MAX_POLYGON_POINTS) {
    let removeIndex = 0;
    let smallestTriangle = Number.POSITIVE_INFINITY;
    for (let index = 0; index < simplified.length; index += 1) {
      const previous =
        simplified[(index + simplified.length - 1) % simplified.length];
      const current = simplified[index];
      const next = simplified[(index + 1) % simplified.length];
      const triangle = Math.abs(
        (current.longitude - previous.longitude) *
          (next.latitude - previous.latitude) -
          (current.latitude - previous.latitude) *
            (next.longitude - previous.longitude),
      );
      if (triangle < smallestTriangle) {
        smallestTriangle = triangle;
        removeIndex = index;
      }
    }
    simplified.splice(removeIndex, 1);
  }
  return simplified;
}

async function runWithDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  deadline: number,
  phase: "Overpass" | "map fallback",
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0)
    throw new Error(`OpenStreetMap ${phase} deadline exceeded`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadlinePromise = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(
        () => reject(new Error(`OpenStreetMap ${phase} deadline exceeded`)),
        remaining,
      );
    });
    return await Promise.race([operation(controller.signal), deadlinePromise]);
  } finally {
    clearTimeout(timer);
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
}

function rawPolygons(element: z.infer<typeof elementSchema>): RawPolygon[] {
  if (element.geometry?.length) {
    return [
      {
        id: `${element.type}/${element.id}`,
        tags: element.tags,
        geometry: element.geometry,
      },
    ];
  }

  return (element.members ?? [])
    .filter(
      (member) =>
        member.role === "outer" && (member.geometry?.length ?? 0) >= 4,
    )
    .map((member, index) => ({
      id: `relation/${element.id}/outer/${member.ref}-${index + 1}`,
      tags: element.tags,
      geometry: member.geometry ?? [],
    }));
}

function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses =
      a.latitude > point.latitude !== b.latitude > point.latitude &&
      point.longitude <
        ((b.longitude - a.longitude) * (point.latitude - a.latitude)) /
          (b.latitude - a.latitude || Number.EPSILON) +
          a.longitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceMeters(left: GeoPoint, right: GeoPoint): number {
  const earthRadius = 6_378_137;
  const lat1 = (left.latitude * Math.PI) / 180;
  const lat2 = (right.latitude * Math.PI) / 180;
  const deltaLat = ((right.latitude - left.latitude) * Math.PI) / 180;
  const deltaLon = ((right.longitude - left.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function centroid(polygon: GeoPoint[]): GeoPoint {
  return {
    latitude:
      polygon.reduce((sum, point) => sum + point.latitude, 0) / polygon.length,
    longitude:
      polygon.reduce((sum, point) => sum + point.longitude, 0) / polygon.length,
  };
}

function buildingLabel(tags: Record<string, string>, area: number) {
  const kind =
    tags.building && tags.building !== "yes" ? tags.building : "building";
  const name = tags.name || tags["addr:housename"];
  return `${name ? `${name} · ` : ""}${kind} · ${Math.round(area)} m²`;
}

function confidenceFor(input: {
  containsAddress: boolean;
  distance: number;
  area: number;
}) {
  if (input.containsAddress && input.area >= 25 && input.area <= 1_500) {
    return {
      confidence: "high" as const,
      reasoning:
        "Adressepunktet ligger inne i OSM-byggets kontur. Kontur og valgt takvinkel må likevel kontrolleres av administrator.",
    };
  }
  if (input.containsAddress || input.distance <= 25) {
    return {
      confidence: "medium" as const,
      reasoning:
        "Bygget ligger nær adressepunktet, men koblingen eller bygningsformen må kontrolleres av administrator.",
    };
  }
  return {
    confidence: "low" as const,
    reasoning:
      "Bygget er bare et nærliggende OSM-treff. Velg riktig bygg manuelt eller bruk en annen målemetode.",
  };
}

export class OpenStreetMapBuildingProvider {
  private readonly endpoints: string[];

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    endpoint = process.env.OSM_OVERPASS_ENDPOINT?.trim() || DEFAULT_ENDPOINT,
    fallbackEndpoint = process.env.OSM_OVERPASS_FALLBACK_ENDPOINT?.trim() || "",
    private readonly mapEndpoint = process.env.OSM_MAP_ENDPOINT?.trim() ||
      DEFAULT_MAP_ENDPOINT,
    private readonly lookupDeadlineMs = LOOKUP_DEADLINE_MS,
  ) {
    this.endpoints = Array.from(
      new Set([endpoint, fallbackEndpoint].filter(Boolean)),
    );
  }

  health(): ProviderHealth {
    return {
      status: "ready",
      provider: "openstreetmap-overpass",
      detail:
        "OpenStreetMap building footprints under ODbL; low-volume lookup with administrator review.",
    };
  }

  async findBuildings(
    addressPoint: GeoPoint,
  ): Promise<BuildingFootprintCandidate[]> {
    assertNorwegianAddressPoint(addressPoint);
    const startedAtMs = Date.now();
    const actionDeadlineAtMs = startedAtMs + this.lookupDeadlineMs;
    const overpassDeadlineAtMs = Math.min(
      actionDeadlineAtMs,
      startedAtMs +
        Math.max(
          1,
          Math.min(
            MAX_OVERPASS_BUDGET_MS,
            Math.floor(this.lookupDeadlineMs * OVERPASS_BUDGET_RATIO),
          ),
        ),
    );
    const query = `[out:json][timeout:3];(way["building"](around:${SEARCH_RADIUS_METERS},${addressPoint.latitude},${addressPoint.longitude});relation["building"](around:${SEARCH_RADIUS_METERS},${addressPoint.latitude},${addressPoint.longitude}););out tags geom;`;
    let parsed: z.infer<typeof overpassResponseSchema> | null = null;
    let lastError: unknown;
    for (const endpoint of this.endpoints) {
      try {
        parsed = await runWithDeadline(
          async (signal) => {
            const response = await this.fetcher(endpoint, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type":
                  "application/x-www-form-urlencoded;charset=UTF-8",
                "User-Agent": USER_AGENT,
              },
              body: new URLSearchParams({ data: query }),
              signal,
            });
            if (!response.ok)
              throw new Error(
                `OpenStreetMap building lookup failed (${response.status})`,
              );
            return overpassResponseSchema.parse(await response.json());
          },
          overpassDeadlineAtMs,
          "Overpass",
        );
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!parsed) {
      try {
        const latitudeDelta = SEARCH_RADIUS_METERS / 111_320;
        const longitudeDelta =
          SEARCH_RADIUS_METERS /
          (111_320 *
            Math.max(Math.cos((addressPoint.latitude * Math.PI) / 180), 0.1));
        const bboxCoordinates = [
          addressPoint.longitude - longitudeDelta,
          addressPoint.latitude - latitudeDelta,
          addressPoint.longitude + longitudeDelta,
          addressPoint.latitude + latitudeDelta,
        ];
        if (
          bboxCoordinates[2] - bboxCoordinates[0] > MAX_MAP_BBOX_SPAN_DEGREES ||
          bboxCoordinates[3] - bboxCoordinates[1] > MAX_MAP_BBOX_SPAN_DEGREES
        ) {
          throw new Error("OpenStreetMap map fallback bbox is too large");
        }
        const bbox = bboxCoordinates.join(",");
        const mapResult = await runWithDeadline(
          async (signal) => {
            const response = await this.fetcher(
              `${this.mapEndpoint}?bbox=${bbox}`,
              {
                headers: {
                  Accept: "application/xml",
                  "User-Agent": USER_AGENT,
                },
                signal,
              },
            );
            if (!response.ok)
              throw new Error(
                `OpenStreetMap map lookup failed (${response.status})`,
              );
            return parseOsmMapXml(await response.text());
          },
          Math.min(actionDeadlineAtMs, Date.now() + MAX_MAP_FALLBACK_BUDGET_MS),
          "map fallback",
        );
        parsed = overpassResponseSchema.parse(mapResult);
        if (parsed.elements.length === 0) return [];
      } catch (error) {
        lastError = error;
      }
    }
    if (!parsed) {
      throw new Error(
        `OpenStreetMap building services are temporarily unavailable${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
      );
    }

    const candidates: BuildingFootprintCandidate[] = [];
    for (const element of parsed.elements) {
      for (const raw of rawPolygons(element)) {
        const polygon = normalizePolygon(raw.geometry);
        if (polygon.length < 3) continue;
        try {
          const area = polygonAreaSquareMeters(polygon);
          const containsAddress = pointInPolygon(addressPoint, polygon);
          const distance = containsAddress
            ? 0
            : distanceMeters(addressPoint, centroid(polygon));
          const confidence = confidenceFor({ containsAddress, distance, area });
          candidates.push({
            id: raw.id,
            label: buildingLabel(raw.tags, area),
            addressHouseNumber:
              raw.tags["addr:housenumber"]?.trim() || undefined,
            addressStreet: raw.tags["addr:street"]?.trim() || undefined,
            buildingName:
              (raw.tags.name || raw.tags["addr:housename"])?.trim() ||
              undefined,
            polygon,
            horizontalAreaSquareMeters: Math.round(area * 10) / 10,
            distanceToAddressMeters: Math.round(distance * 10) / 10,
            containsAddress,
            confidence: confidence.confidence,
            confidenceReasoning: confidence.reasoning,
            source: "OpenStreetMap building footprint via Overpass API",
            sourceUrl: `https://www.openstreetmap.org/${raw.id.split("/outer/")[0]}`,
            license: "Open Database License (ODbL) 1.0",
            credits: "© OpenStreetMap contributors",
          });
        } catch {
          // Invalid, self-intersecting or implausible public geometry is never
          // allowed into a price basis.
        }
      }
    }

    const rank = { high: 0, medium: 1, low: 2 } as const;
    return candidates
      .sort(
        (left, right) =>
          rank[left.confidence] - rank[right.confidence] ||
          Number(right.containsAddress) - Number(left.containsAddress) ||
          left.distanceToAddressMeters - right.distanceToAddressMeters ||
          Math.abs(left.horizontalAreaSquareMeters - 160) -
            Math.abs(right.horizontalAreaSquareMeters - 160),
      )
      .slice(0, 8);
  }
}
