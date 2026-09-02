import sharp from "sharp";
import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  etrs89ToUtm33,
  type KartverketHeightSurfaceV1,
} from "@/lib/providers/kartverket-hoydedata-provider";
import type { SimpleRoofPlaneSegmentationV1 } from "./simple-roof-plane-segmentation-v1";

export const HEIGHT_SURFACE_VISUALIZATION_SCHEMA_VERSION =
  "height-surface-visualization.v1" as const;

export type HeightSurfaceVisualizationV1 = {
  schemaVersion: typeof HEIGHT_SURFACE_VISUALIZATION_SCHEMA_VERSION;
  mimeType: "image/png";
  dataUrl: string;
  width: number;
  height: number;
  overlayPoints: string;
  planes: Array<{
    planeId: string;
    overlayPoints: string;
    pitchDegrees: number;
    azimuthDegrees: number | null;
    horizontalAreaSquareMeters: number;
    surfaceAreaSquareMeters: number;
  }> | null;
  ridge: {
    overlayPoints: string;
    lengthMeters: number;
  } | null;
  minHeightAboveTerrainM: number;
  maxHeightAboveTerrainM: number;
  attribution: "Kartverket · NLOD 2.0 + OpenStreetMap contributors · ODbL 1.0";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function valid(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function projectPoint(
  surface: KartverketHeightSurfaceV1,
  width: number,
  height: number,
  point: { eastingM: number; northingM: number },
) {
  const spanEastingM = Math.max(
    surface.bbox.maxEastingM - surface.bbox.minEastingM,
    surface.grid.cellWidthM,
  );
  const spanNorthingM = Math.max(
    surface.bbox.maxNorthingM - surface.bbox.minNorthingM,
    surface.grid.cellHeightM,
  );
  return {
    x: ((point.eastingM - surface.bbox.minEastingM) / spanEastingM) * width,
    y: ((surface.bbox.maxNorthingM - point.northingM) / spanNorthingM) * height,
  };
}

function toOverlayPoints(
  points: Array<{ eastingM: number; northingM: number }>,
  surface: KartverketHeightSurfaceV1,
  width: number,
  height: number,
) {
  return points
    .map((point) => projectPoint(surface, width, height, point))
    .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
    .join(" ");
}

function sample(
  values: Array<number | null>,
  width: number,
  height: number,
  row: number,
  column: number,
  fallback: number,
) {
  const boundedRow = clamp(row, 0, height - 1);
  const boundedColumn = clamp(column, 0, width - 1);
  const value = values[boundedRow * width + boundedColumn];
  return valid(value) ? value : fallback;
}

export async function buildHeightSurfaceVisualizationV1(input: {
  surface: KartverketHeightSurfaceV1;
  candidate: BuildingFootprintCandidate;
  segmentation?: SimpleRoofPlaneSegmentationV1;
}): Promise<HeightSurfaceVisualizationV1> {
  const { surface, candidate, segmentation } = input;
  const { width, height, cellWidthM, cellHeightM } = surface.grid;
  const total = width * height;
  if (
    width < 1 ||
    height < 1 ||
    width > 256 ||
    height > 256 ||
    surface.values.domElevationM.length !== total ||
    surface.values.heightAboveTerrainM.length !== total
  ) {
    throw new TypeError("Invalid Høydedata visualization grid");
  }
  const usableHeights = surface.values.heightAboveTerrainM.filter(valid);
  if (!usableHeights.length) {
    throw new TypeError("Høydedata visualization has no usable heights");
  }
  const minHeightAboveTerrainM = Math.min(...usableHeights);
  const maxHeightAboveTerrainM = Math.max(...usableHeights);
  const pixels = Buffer.alloc(total * 4);
  const light = { x: -0.5, y: 0.5, z: Math.SQRT1_2 };

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      const dom = surface.values.domElevationM[index];
      const relativeHeight = surface.values.heightAboveTerrainM[index];
      const offset = index * 4;
      if (!valid(dom) || !valid(relativeHeight)) {
        pixels[offset] = 8;
        pixels[offset + 1] = 13;
        pixels[offset + 2] = 18;
        pixels[offset + 3] = 255;
        continue;
      }
      const west = sample(
        surface.values.domElevationM,
        width,
        height,
        row,
        column - 1,
        dom,
      );
      const east = sample(
        surface.values.domElevationM,
        width,
        height,
        row,
        column + 1,
        dom,
      );
      const north = sample(
        surface.values.domElevationM,
        width,
        height,
        row - 1,
        column,
        dom,
      );
      const south = sample(
        surface.values.domElevationM,
        width,
        height,
        row + 1,
        column,
        dom,
      );
      const dzdx = (east - west) / Math.max(2 * cellWidthM, 0.001);
      const dzdy = (north - south) / Math.max(2 * cellHeightM, 0.001);
      const normalLength = Math.hypot(dzdx, dzdy, 1);
      const illumination = Math.max(
        0,
        (-dzdx * light.x + -dzdy * light.y + light.z) / normalLength,
      );
      const shade = 0.38 + illumination * 0.8;
      const roofFactor = clamp((relativeHeight - 1.5) / 8, 0, 1);
      const red = 18 + roofFactor * 112;
      const green = 31 + roofFactor * 78;
      const blue = 43 + roofFactor * 30;
      pixels[offset] = Math.round(clamp(red * shade, 0, 255));
      pixels[offset + 1] = Math.round(clamp(green * shade, 0, 255));
      pixels[offset + 2] = Math.round(clamp(blue * shade, 0, 255));
      pixels[offset + 3] = 255;
    }
  }

  const outputWidth = Math.max(480, width * 8);
  const image = await sharp(pixels, {
    raw: { width, height, channels: 4 },
  })
    .resize({ width: outputWidth, kernel: "cubic" })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  const overlayPoints = toOverlayPoints(
    candidate.polygon.map(etrs89ToUtm33),
    surface,
    width,
    height,
  );
  const planes =
    segmentation?.planes.map((plane) => ({
      planeId: plane.planeId,
      overlayPoints: toOverlayPoints(
        plane.polygon.map((point) => ({
          eastingM: point.xM,
          northingM: point.yM,
        })),
        surface,
        width,
        height,
      ),
      pitchDegrees: plane.pitchDegrees,
      azimuthDegrees: plane.azimuthDegrees,
      horizontalAreaSquareMeters: plane.horizontalAreaSquareMeters,
      surfaceAreaSquareMeters: plane.surfaceAreaSquareMeters,
    })) ?? null;
  const ridge = segmentation?.ridge
    ? {
        overlayPoints: toOverlayPoints(
          [
            {
              eastingM: segmentation.ridge.from.xM,
              northingM: segmentation.ridge.from.yM,
            },
            {
              eastingM: segmentation.ridge.to.xM,
              northingM: segmentation.ridge.to.yM,
            },
          ],
          surface,
          width,
          height,
        ),
        lengthMeters: segmentation.ridge.lengthMeters,
      }
    : null;

  return {
    schemaVersion: HEIGHT_SURFACE_VISUALIZATION_SCHEMA_VERSION,
    mimeType: "image/png",
    dataUrl: `data:image/png;base64,${image.toString("base64")}`,
    width,
    height,
    overlayPoints,
    planes,
    ridge,
    minHeightAboveTerrainM,
    maxHeightAboveTerrainM,
    attribution:
      "Kartverket · NLOD 2.0 + OpenStreetMap contributors · ODbL 1.0",
  };
}
