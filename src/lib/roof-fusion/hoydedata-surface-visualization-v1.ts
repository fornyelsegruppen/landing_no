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

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
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

function sampleBilinear(
  values: Array<number | null>,
  width: number,
  height: number,
  row: number,
  column: number,
  fallback: number,
) {
  const boundedRow = clamp(row, 0, height - 1);
  const boundedColumn = clamp(column, 0, width - 1);

  const north = Math.floor(boundedRow);
  const west = Math.floor(boundedColumn);
  const south = Math.min(north + 1, height - 1);
  const east = Math.min(west + 1, width - 1);

  const rowT = boundedRow - north;
  const columnT = boundedColumn - west;

  const northwest = sample(
    values,
    width,
    height,
    north,
    west,
    fallback,
  );
  const northeast = sample(
    values,
    width,
    height,
    north,
    east,
    fallback,
  );
  const southwest = sample(
    values,
    width,
    height,
    south,
    west,
    fallback,
  );
  const southeast = sample(
    values,
    width,
    height,
    south,
    east,
    fallback,
  );

  const northEdge = lerp(northwest, northeast, columnT);
  const southEdge = lerp(southwest, southeast, columnT);
  return lerp(northEdge, southEdge, rowT);
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
  const heightRange = maxHeightAboveTerrainM - minHeightAboveTerrainM;

  const renderScale = Math.min(
    32,
    Math.max(4, Math.ceil(1024 / Math.max(width, height))),
  );
  const outputWidth = width * renderScale;
  const outputHeight = height * renderScale;
  const renderedPixels = Buffer.alloc(outputWidth * outputHeight * 4);

  const sampleSpacingX = Math.max(cellWidthM / renderScale, 0.001);
  const sampleSpacingY = Math.max(cellHeightM / renderScale, 0.001);
  const scaleX = 1 / (2 * sampleSpacingX);
  const scaleY = 1 / (2 * sampleSpacingY);
  const light = { x: -0.45, y: 0.62, z: Math.SQRT1_2 };

  for (let row = 0; row < outputHeight; row += 1) {
    for (let column = 0; column < outputWidth; column += 1) {
      const sourceRow = row / renderScale - 0.5;
      const sourceColumn = column / renderScale - 0.5;

      const nearestRow = clamp(Math.round(sourceRow), 0, height - 1);
      const nearestColumn = clamp(Math.round(sourceColumn), 0, width - 1);
      const nearestIndex = nearestRow * width + nearestColumn;
      const nearestDom = surface.values.domElevationM[nearestIndex];
      const nearestRelativeHeight =
        surface.values.heightAboveTerrainM[nearestIndex];
      const outputOffset = (row * outputWidth + column) * 4;
      if (!valid(nearestDom) || !valid(nearestRelativeHeight)) {
        renderedPixels[outputOffset] = 7;
        renderedPixels[outputOffset + 1] = 11;
        renderedPixels[outputOffset + 2] = 16;
        renderedPixels[outputOffset + 3] = 255;
        continue;
      }

      const dom = sampleBilinear(
        surface.values.domElevationM,
        width,
        height,
        sourceRow,
        sourceColumn,
        nearestDom,
      );
      const relativeHeight = sampleBilinear(
        surface.values.heightAboveTerrainM,
        width,
        height,
        sourceRow,
        sourceColumn,
        nearestRelativeHeight,
      );

      const west = sampleBilinear(
        surface.values.domElevationM,
        width,
        height,
        sourceRow,
        sourceColumn - 1 / renderScale,
        dom,
      );
      const east = sampleBilinear(
        surface.values.domElevationM,
        width,
        height,
        sourceRow,
        sourceColumn + 1 / renderScale,
        dom,
      );
      const north = sampleBilinear(
        surface.values.domElevationM,
        width,
        height,
        sourceRow - 1 / renderScale,
        sourceColumn,
        dom,
      );
      const south = sampleBilinear(
        surface.values.domElevationM,
        width,
        height,
        sourceRow + 1 / renderScale,
        sourceColumn,
        dom,
      );

      const slopeX = (east - west) * scaleX;
      const slopeY = (north - south) * scaleY;
      const localSmoothing = clamp(Math.hypot(slopeX, slopeY) * 0.25, 0, 0.22);
      const illumination = Math.max(
        0,
        (-slopeX * light.x + -slopeY * light.y + light.z) /
          Math.hypot(slopeX, slopeY, 1),
      );
      const shade = clamp(0.28 + illumination * 0.9 + localSmoothing, 0, 1.22);

      const relief = clamp(
        (relativeHeight - minHeightAboveTerrainM) / (heightRange || 1),
        0,
        1,
      );
      const baseRed = 22 + relief * 112 + localSmoothing * 70;
      const baseGreen = 34 + relief * 126 + localSmoothing * 82;
      const baseBlue = 48 + relief * 138 + localSmoothing * 94;

      renderedPixels[outputOffset] = Math.round(
        clamp(baseRed * shade, 0, 255),
      );
      renderedPixels[outputOffset + 1] = Math.round(
        clamp(baseGreen * shade, 0, 255),
      );
      renderedPixels[outputOffset + 2] = Math.round(
        clamp(baseBlue * shade, 0, 255),
      );
      renderedPixels[outputOffset + 3] = 255;
    }
  }

  const image = await sharp(renderedPixels, {
    raw: { width: outputWidth, height: outputHeight, channels: 4 },
  })
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
