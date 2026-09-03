import { expect, it } from "vitest";
import type { GeoPoint } from "@/lib/measurements/types";
import {
  projectWgs84ToOrthoPixels,
  type GeoReference,
} from "./norgeibilder-projection";

it("projects a known WGS84 point into the EPSG:25833 image bounds", () => {
  const ref: GeoReference = {
    crs: "EPSG:25833",
    extentTrust: "actual-visible-extent",
    bounds: {
      minEastingM: 261386.294,
      minNorthingM: 6648173.086,
      maxEastingM: 263386.294,
      maxNorthingM: 6650173.086,
    },
    imageWidth: 1000,
    imageHeight: 1000,
  };
  const points: GeoPoint[] = [
    { latitude: 59.91137749505985, longitude: 10.749403964838672 },
    { latitude: 59.91138, longitude: 10.74941 },
    { latitude: 59.91137, longitude: 10.74942 },
  ];
  const [x, y] = projectWgs84ToOrthoPixels(points, ref)!
    .split(" ")[0]
    .split(",")
    .map(Number);
  expect(x).toBeCloseTo(500, 2);
  expect(y).toBeCloseTo(500, 2);
});

it("fails closed when a footprint falls outside the trusted capture extent", () => {
  const ref: GeoReference = {
    crs: "EPSG:25833",
    extentTrust: "actual-visible-extent",
    bounds: {
      minEastingM: 261386.294,
      minNorthingM: 6648173.086,
      maxEastingM: 263386.294,
      maxNorthingM: 6650173.086,
    },
    imageWidth: 1000,
    imageHeight: 1000,
  };
  expect(
    projectWgs84ToOrthoPixels(
      [
        { latitude: 60.1, longitude: 11 },
        { latitude: 60.1001, longitude: 11 },
        { latitude: 60.1, longitude: 11.0001 },
      ],
      ref,
    ),
  ).toBeNull();
});

it("refuses planned URL bounds even when their coordinates would project", () => {
  const ref = {
    crs: "EPSG:25833",
    extentTrust: "planned-url-unverified",
    bounds: {
      minEastingM: 261386.294,
      minNorthingM: 6648173.086,
      maxEastingM: 263386.294,
      maxNorthingM: 6650173.086,
    },
    imageWidth: 1000,
    imageHeight: 1000,
  };
  expect(
    projectWgs84ToOrthoPixels(
      [
        { latitude: 59.91137749505985, longitude: 10.749403964838672 },
        { latitude: 59.91138, longitude: 10.74941 },
        { latitude: 59.91137, longitude: 10.74942 },
      ],
      ref as unknown as GeoReference,
    ),
  ).toBeNull();
});
