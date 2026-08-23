import { createHash } from "node:crypto";
import type { GeoPoint, MeasurementResult, RoofPlaneInput } from "./types";
import { slopeFactor } from "./slope";

const EARTH_RADIUS_METERS = 6_378_137;

function assertCoordinate(point: GeoPoint) {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    throw new TypeError("Roof polygon contains an invalid coordinate");
  }
}

export function polygonAreaSquareMeters(points: GeoPoint[]): number {
  if (points.length < 3 || points.length > 30) {
    throw new TypeError("Roof polygon must contain between 3 and 30 points");
  }
  points.forEach(assertCoordinate);

  const latitudeOrigin =
    points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const longitudeOrigin =
    points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  const cosLatitude = Math.cos((latitudeOrigin * Math.PI) / 180);
  const projected = points.map((point) => ({
    x: EARTH_RADIUS_METERS * ((point.longitude - longitudeOrigin) * Math.PI / 180) * cosLatitude,
    y: EARTH_RADIUS_METERS * ((point.latitude - latitudeOrigin) * Math.PI / 180),
  }));

  const orientation = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let first = 0; first < projected.length; first += 1) {
    const firstNext = (first + 1) % projected.length;
    for (let second = first + 1; second < projected.length; second += 1) {
      const secondNext = (second + 1) % projected.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      const a = projected[first]; const b = projected[firstNext];
      const c = projected[second]; const d = projected[secondNext];
      if (orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0) {
        throw new TypeError("Roof polygon cannot intersect itself");
      }
    }
  }

  let twiceArea = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const current = projected[index];
    const next = projected[(index + 1) % projected.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }

  const area = Math.abs(twiceArea) / 2;
  if (!Number.isFinite(area) || area < 1 || area > 20_000) {
    throw new TypeError("Roof polygon area is outside the supported range");
  }
  return area;
}

export function measureRoofPlanes(planes: RoofPlaneInput[]): MeasurementResult {
  if (planes.length === 0) throw new TypeError("At least one roof plane is required");

  const calculated = planes.map((plane) => {
    const horizontal = polygonAreaSquareMeters(plane.polygon);
    const factorMin = slopeFactor(plane.angleMinDegrees);
    const factorMax = slopeFactor(plane.angleMaxDegrees);
    return { rawHorizontal: horizontal, rawMin: horizontal * factorMin, rawMax: horizontal * factorMax, measured: {
      id: plane.id,
      horizontalAreaTenths: Math.round(horizontal * 10),
      angleMinDegrees: plane.angleMinDegrees,
      angleMaxDegrees: plane.angleMaxDegrees,
      factorMin,
      factorMax,
      actualAreaMinTenths: Math.round(horizontal * factorMin * 10),
      actualAreaMaxTenths: Math.round(horizontal * factorMax * 10),
    } };
  });
  const measured = calculated.map((item) => item.measured);

  return {
    planes: measured,
    horizontalAreaTenths: Math.round(calculated.reduce((sum, plane) => sum + plane.rawHorizontal, 0) * 10),
    actualAreaMinTenths: Math.round(calculated.reduce((sum, plane) => sum + plane.rawMin, 0) * 10),
    actualAreaMaxTenths: Math.round(calculated.reduce((sum, plane) => sum + plane.rawMax, 0) * 10),
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function measurementSnapshotHash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}
