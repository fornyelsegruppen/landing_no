import { describe, expect, it } from "vitest";
import { measureRoofPlanes, measurementSnapshotHash, polygonAreaSquareMeters } from "./geometry";

const METERS_PER_DEGREE = 111_319.49079327358;
function rectangle(id: string, width: number, height: number, angle: number) {
  const latitude = 60;
  const dy = height / METERS_PER_DEGREE;
  const dx = width / (METERS_PER_DEGREE * Math.cos(latitude * Math.PI / 180));
  return {
    id,
    angleMinDegrees: angle,
    angleMaxDegrees: angle,
    polygon: [
      { latitude, longitude: 10 },
      { latitude, longitude: 10 + dx },
      { latitude: latitude + dy, longitude: 10 + dx },
      { latitude: latitude + dy, longitude: 10 },
    ],
  };
}

describe("roof geometry", () => {
  it("calculates georeferenced polygon area", () => {
    expect(polygonAreaSquareMeters(rectangle("a", 10, 10, 0).polygon)).toBeCloseTo(100, 1);
  });

  it("calculates separate roof planes and rounds only final tenths", () => {
    const result = measureRoofPlanes([rectangle("a", 10, 10, 22), rectangle("b", 10, 5, 45)]);
    expect(result.horizontalAreaTenths).toBeCloseTo(1500, -1);
    expect(result.actualAreaMinTenths).toBeCloseTo(1786, -1);
    expect(result.planes).toHaveLength(2);
  });

  it("produces the same hash for the same locked input regardless of object key order", () => {
    expect(measurementSnapshotHash({ b: 2, a: 1 })).toBe(measurementSnapshotHash({ a: 1, b: 2 }));
  });

  it("rejects a self-intersecting polygon", () => {
    expect(() => polygonAreaSquareMeters([
      { latitude: 60, longitude: 10 },
      { latitude: 60.001, longitude: 10.001 },
      { latitude: 60, longitude: 10.001 },
      { latitude: 60.001, longitude: 10 },
    ])).toThrow(/intersect/);
  });
});
