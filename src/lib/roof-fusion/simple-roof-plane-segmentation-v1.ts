import type { BuildingFootprintCandidate } from "@/lib/providers/osm-building-provider";
import {
  etrs89ToUtm33,
  type KartverketHeightSurfaceV1,
} from "@/lib/providers/kartverket-hoydedata-provider";

export const SIMPLE_ROOF_PLANE_SEGMENTATION_SCHEMA_VERSION =
  "simple-roof-plane-segmentation.v1" as const;

export type SimpleRoofTypeV1 = "flat" | "mono" | "gable";

export type SimpleRoofPlaneV1 = {
  planeId: string;
  polygon: Array<{ xM: number; yM: number; zM: number }>;
  pitchDegrees: number;
  azimuthDegrees: number | null;
  horizontalAreaSquareMeters: number;
  surfaceAreaSquareMeters: number;
  fitRmseM: number;
};

export type SimpleRoofPlaneSegmentationV1 = {
  schemaVersion: typeof SIMPLE_ROOF_PLANE_SEGMENTATION_SCHEMA_VERSION;
  roofType: SimpleRoofTypeV1;
  planes: SimpleRoofPlaneV1[];
  ridge: {
    from: { xM: number; yM: number; zM: number };
    to: { xM: number; yM: number; zM: number };
    lengthMeters: number;
  } | null;
  sampleCount: number;
  footprintSampleCount: number;
  roofCoverageRatio: number;
  fitRmseM: number;
  confidenceScore: number;
  assumptions: string[];
};

/** Coordinates in the rendered height-surface frame: x runs west-to-east and
 * y runs north-to-south. They are deliberately not projected coordinates. */
export type NormalizedRoofRidgePointV1 = { x: number; y: number };

export class SimpleRoofPlaneSegmentationError extends Error {
  constructor(
    readonly code:
      | "INVALID_INPUT"
      | "UNSUPPORTED_FOOTPRINT"
      | "INSUFFICIENT_ROOF_SAMPLES"
      | "MODEL_NOT_RELIABLE",
    message: string,
  ) {
    super(message);
    this.name = "SimpleRoofPlaneSegmentationError";
  }
}

type Point2 = { x: number; y: number };
type Sample = Point2 & { z: number };
type PlaneFit = {
  coefficients: number[];
  rmse: number;
  retainedSamples: number;
};
type GableFit = PlaneFit & {
  angleRadians: number;
  ridgeOffset: number;
};

const ROOF_MIN_HEIGHT_M = 2.5;
const ROOF_MAX_HEIGHT_M = 80;
const MIN_ROOF_SAMPLES = 18;
const MAX_MODEL_SAMPLES = 600;
const MIN_ROOF_COVERAGE_RATIO = 0.75;
const MIN_RETAINED_SAMPLE_RATIO = 0.75;
const MAX_ACCEPTED_RMSE_M = 0.8;
const MAX_FLAT_OR_MONO_RMSE_M = 0.55;
const MIN_PITCH_DEGREES = 3;
const MAX_PITCH_DEGREES = 65;

function round(value: number, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function samePoint(left: Point2, right: Point2) {
  return Math.hypot(left.x - right.x, left.y - right.y) <= 1e-5;
}

function cleanPolygon(points: Point2[]) {
  const cleaned: Point2[] = [];
  for (const point of points) {
    if (!cleaned.length || !samePoint(cleaned[cleaned.length - 1], point)) {
      cleaned.push(point);
    }
  }
  if (
    cleaned.length > 1 &&
    samePoint(cleaned[0], cleaned[cleaned.length - 1])
  ) {
    cleaned.pop();
  }
  return cleaned;
}

function projectedCandidatePolygon(candidate: BuildingFootprintCandidate) {
  return cleanPolygon(
    candidate.polygon.map((point) => {
      const projected = etrs89ToUtm33(point);
      return { x: projected.eastingM, y: projected.northingM };
    }),
  );
}

function cross(first: Point2, second: Point2, third: Point2) {
  return (
    (second.x - first.x) * (third.y - second.y) -
    (second.y - first.y) * (third.x - second.x)
  );
}

function isConvex(polygon: Point2[]) {
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const value = cross(
      polygon[index],
      polygon[(index + 1) % polygon.length],
      polygon[(index + 2) % polygon.length],
    );
    if (Math.abs(value) <= 1e-7) continue;
    const nextSign = Math.sign(value);
    if (sign && sign !== nextSign) return false;
    sign = nextSign;
  }
  return sign !== 0;
}

function pointOnSegment(point: Point2, from: Point2, to: Point2) {
  const area =
    (point.y - from.y) * (to.x - from.x) - (point.x - from.x) * (to.y - from.y);
  return (
    Math.abs(area) <= 1e-6 &&
    point.x >= Math.min(from.x, to.x) - 1e-6 &&
    point.x <= Math.max(from.x, to.x) + 1e-6 &&
    point.y >= Math.min(from.y, to.y) - 1e-6 &&
    point.y <= Math.max(from.y, to.y) + 1e-6
  );
}

function pointInPolygon(point: Point2, polygon: Point2[]) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonArea(polygon: Point2[]) {
  return (
    Math.abs(
      polygon.reduce((sum, point, index) => {
        const next = polygon[(index + 1) % polygon.length];
        return sum + point.x * next.y - next.x * point.y;
      }, 0),
    ) / 2
  );
}

export function manualRidgeCorrectionStatusV1(
  candidate: BuildingFootprintCandidate,
): "available" | "unsupported_footprint" {
  const polygon = projectedCandidatePolygon(candidate);
  return polygon.length >= 3 &&
    polygon.length <= 8 &&
    polygonArea(polygon) >= 25 &&
    isConvex(polygon)
    ? "available"
    : "unsupported_footprint";
}

function quantile(sorted: number[], fraction: number) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return (
    sorted[lower] * (upper - position) + sorted[upper] * (position - lower)
  );
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])
      ) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot][column]) < 1e-9) return null;
    [augmented[column], augmented[pivot]] = [
      augmented[pivot],
      augmented[column],
    ];
    const divisor = augmented[column][column];
    for (let cell = column; cell <= size; cell += 1) {
      augmented[column][cell] /= divisor;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let cell = column; cell <= size; cell += 1) {
        augmented[row][cell] -= factor * augmented[column][cell];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

function leastSquares(
  samples: Sample[],
  features: (sample: Sample) => number[],
) {
  const first = features(samples[0]);
  const matrix = Array.from(
    { length: first.length },
    () => Array(first.length).fill(0) as number[],
  );
  const values = Array(first.length).fill(0) as number[];
  for (const sample of samples) {
    const row = features(sample);
    for (let left = 0; left < row.length; left += 1) {
      values[left] += row[left] * sample.z;
      for (let right = 0; right < row.length; right += 1) {
        matrix[left][right] += row[left] * row[right];
      }
    }
  }
  return solveLinearSystem(matrix, values);
}

function robustFit(samples: Sample[], features: (sample: Sample) => number[]) {
  const initial = leastSquares(samples, features);
  if (!initial) return null;
  const residuals = samples
    .map((sample) => {
      const predicted = features(sample).reduce(
        (sum, value, index) => sum + value * initial[index],
        0,
      );
      return Math.abs(sample.z - predicted);
    })
    .sort((left, right) => left - right);
  const medianResidual = quantile(residuals, 0.5);
  const threshold = Math.max(0.35, medianResidual * 3.5);
  const retained = samples.filter((sample) => {
    const predicted = features(sample).reduce(
      (sum, value, index) => sum + value * initial[index],
      0,
    );
    return Math.abs(sample.z - predicted) <= threshold;
  });
  if (retained.length < Math.max(MIN_ROOF_SAMPLES, samples.length * 0.65)) {
    return null;
  }
  const coefficients = leastSquares(retained, features);
  if (!coefficients) return null;
  const squaredError = retained.reduce((sum, sample) => {
    const predicted = features(sample).reduce(
      (total, value, index) => total + value * coefficients[index],
      0,
    );
    return sum + (sample.z - predicted) ** 2;
  }, 0);
  return {
    coefficients,
    rmse: Math.sqrt(squaredError / retained.length),
    retainedSamples: retained.length,
  } satisfies PlaneFit;
}

function projectedCoordinate(
  point: Point2,
  center: Point2,
  angleRadians: number,
) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    u: Math.cos(angleRadians) * dx + Math.sin(angleRadians) * dy,
    v: -Math.sin(angleRadians) * dx + Math.cos(angleRadians) * dy,
  };
}

function fitMono(samples: Sample[], center: Point2) {
  return robustFit(samples, (sample) => [
    1,
    sample.x - center.x,
    sample.y - center.y,
  ]);
}

function fitGable(samples: Sample[], polygon: Point2[], center: Point2) {
  let best: GableFit | null = null;
  for (let degrees = 0; degrees < 180; degrees += 2) {
    const angleRadians = (degrees * Math.PI) / 180;
    const polygonU = polygon
      .map((point) => projectedCoordinate(point, center, angleRadians).u)
      .sort((left, right) => left - right);
    const minimum = polygonU[0];
    const maximum = polygonU[polygonU.length - 1];
    const width = maximum - minimum;
    if (width < 3) continue;
    for (let step = 5; step <= 15; step += 1) {
      const ridgeOffset = minimum + (width * step) / 20;
      const features = (sample: Sample) => {
        const { u, v } = projectedCoordinate(sample, center, angleRadians);
        return [
          1,
          v,
          Math.max(0, ridgeOffset - u),
          Math.max(0, u - ridgeOffset),
        ];
      };
      const fit = robustFit(samples, features);
      if (!fit) continue;
      const leftSlope = fit.coefficients[2];
      const rightSlope = fit.coefficients[3];
      if (leftSlope >= -0.03 || rightSlope >= -0.03) continue;
      if (!best || fit.rmse < best.rmse) {
        best = { ...fit, angleRadians, ridgeOffset };
      }
    }
  }
  return best;
}

function clipByRidge(input: {
  polygon: Point2[];
  center: Point2;
  angleRadians: number;
  ridgeOffset: number;
  keepLower: boolean;
}) {
  const result: Point2[] = [];
  const signedDistance = (point: Point2) =>
    projectedCoordinate(point, input.center, input.angleRadians).u -
    input.ridgeOffset;
  const inside = (distance: number) =>
    input.keepLower ? distance <= 1e-7 : distance >= -1e-7;
  for (let index = 0; index < input.polygon.length; index += 1) {
    const current = input.polygon[index];
    const previous =
      input.polygon[(index + input.polygon.length - 1) % input.polygon.length];
    const currentDistance = signedDistance(current);
    const previousDistance = signedDistance(previous);
    const currentInside = inside(currentDistance);
    const previousInside = inside(previousDistance);
    if (currentInside !== previousInside) {
      const ratio = previousDistance / (previousDistance - currentDistance);
      result.push({
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      });
    }
    if (currentInside) result.push(current);
  }
  return cleanPolygon(result);
}

function ridgeEndpoints(input: {
  polygon: Point2[];
  center: Point2;
  angleRadians: number;
  ridgeOffset: number;
}) {
  const intersections: Point2[] = [];
  const signedDistance = (point: Point2) =>
    projectedCoordinate(point, input.center, input.angleRadians).u -
    input.ridgeOffset;
  for (let index = 0; index < input.polygon.length; index += 1) {
    const from = input.polygon[index];
    const to = input.polygon[(index + 1) % input.polygon.length];
    const fromDistance = signedDistance(from);
    const toDistance = signedDistance(to);
    if (Math.abs(fromDistance) <= 1e-7) intersections.push(from);
    if (fromDistance * toDistance < -1e-10) {
      const ratio = fromDistance / (fromDistance - toDistance);
      intersections.push({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      });
    }
  }
  const unique = intersections.filter(
    (point, index) =>
      intersections.findIndex((candidate) => samePoint(point, candidate)) ===
      index,
  );
  let best: [Point2, Point2] | null = null;
  let maximumDistance = 0;
  for (let left = 0; left < unique.length; left += 1) {
    for (let right = left + 1; right < unique.length; right += 1) {
      const distance = Math.hypot(
        unique[left].x - unique[right].x,
        unique[left].y - unique[right].y,
      );
      if (distance > maximumDistance) {
        maximumDistance = distance;
        best = [unique[left], unique[right]];
      }
    }
  }
  return best && maximumDistance >= 2
    ? { from: best[0], to: best[1], lengthMeters: maximumDistance }
    : null;
}

function azimuthDegrees(gradientX: number, gradientY: number) {
  const pitch = (Math.atan(Math.hypot(gradientX, gradientY)) * 180) / Math.PI;
  if (pitch < 1e-6) return null;
  const azimuth =
    ((Math.atan2(-gradientX, -gradientY) * 180) / Math.PI + 360) % 360;
  return azimuth >= 359.999999 ? 0 : azimuth;
}

function planeFromPolygon(input: {
  planeId: string;
  polygon: Point2[];
  gradientX: number;
  gradientY: number;
  elevation: (point: Point2) => number;
  rmse: number;
}): SimpleRoofPlaneV1 {
  const horizontalAreaSquareMeters = polygonArea(input.polygon);
  const areaMultiplier = Math.sqrt(
    1 + input.gradientX ** 2 + input.gradientY ** 2,
  );
  const aspect = azimuthDegrees(input.gradientX, input.gradientY);
  return {
    planeId: input.planeId,
    polygon: input.polygon.map((point) => ({
      xM: round(point.x, 6),
      yM: round(point.y, 6),
      zM: round(input.elevation(point), 6),
    })),
    pitchDegrees: round(
      (Math.atan(Math.hypot(input.gradientX, input.gradientY)) * 180) / Math.PI,
      2,
    ),
    azimuthDegrees: aspect === null ? null : round(aspect, 2),
    horizontalAreaSquareMeters: round(horizontalAreaSquareMeters),
    surfaceAreaSquareMeters: round(horizontalAreaSquareMeters * areaMultiplier),
    fitRmseM: round(input.rmse),
  };
}

function confidenceScore(input: {
  fitRmseM: number;
  coverageRatio: number;
  retainedRatio: number;
}) {
  const fitScore = Math.max(0, 1 - input.fitRmseM / MAX_ACCEPTED_RMSE_M);
  return round(
    Math.min(
      0.92,
      0.45 +
        fitScore * 0.28 +
        input.coverageRatio * 0.12 +
        input.retainedRatio * 0.1,
    ),
    3,
  );
}

function deterministicallyDownsample(samples: Sample[]) {
  if (samples.length <= MAX_MODEL_SAMPLES) return samples;
  return Array.from(
    { length: MAX_MODEL_SAMPLES },
    (_, index) =>
      samples[Math.floor((index * samples.length) / MAX_MODEL_SAMPLES)],
  );
}

/**
 * Fits the narrow two-plane model around an administrator-selected ridge.
 * This is Preview-only input: callers must still resolve the address,
 * footprint, and height surface themselves rather than trusting client state.
 */
export function segmentSimpleRoofPlanesWithRidgeV1(input: {
  surface: KartverketHeightSurfaceV1;
  candidate: BuildingFootprintCandidate;
  ridge: readonly [NormalizedRoofRidgePointV1, NormalizedRoofRidgePointV1];
}): SimpleRoofPlaneSegmentationV1 {
  const { surface, candidate, ridge } = input;
  const expectedSamples = surface.grid.width * surface.grid.height;
  if (
    surface.schemaVersion !== "kartverket-height-surface.v1" ||
    surface.coordinateSystem !== "EPSG:25833" ||
    surface.quality.status !== "usable" ||
    !Number.isInteger(surface.grid.width) ||
    !Number.isInteger(surface.grid.height) ||
    surface.grid.width < 1 ||
    surface.grid.height < 1 ||
    !Number.isFinite(surface.grid.cellWidthM) ||
    !Number.isFinite(surface.grid.cellHeightM) ||
    surface.grid.cellWidthM <= 0 ||
    surface.grid.cellHeightM <= 0 ||
    !Number.isFinite(surface.bbox.minEastingM) ||
    !Number.isFinite(surface.bbox.minNorthingM) ||
    !Number.isFinite(surface.bbox.maxEastingM) ||
    !Number.isFinite(surface.bbox.maxNorthingM) ||
    surface.bbox.maxEastingM <= surface.bbox.minEastingM ||
    surface.bbox.maxNorthingM <= surface.bbox.minNorthingM ||
    surface.values.domElevationM.length !== expectedSamples ||
    surface.values.heightAboveTerrainM.length !== expectedSamples
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INVALID_INPUT",
      "Høydedata surface does not match the manual ridge segmentation contract",
    );
  }
  if (
    ridge.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1,
    )
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INVALID_INPUT",
      "Manual ridge points must be normalized coordinates between 0 and 1",
    );
  }
  const polygon = projectedCandidatePolygon(candidate);
  if (manualRidgeCorrectionStatusV1(candidate) !== "available") {
    throw new SimpleRoofPlaneSegmentationError(
      "UNSUPPORTED_FOOTPRINT",
      "Manual ridge fitting currently accepts simple, convex footprints",
    );
  }
  const spanX = surface.bbox.maxEastingM - surface.bbox.minEastingM;
  const spanY = surface.bbox.maxNorthingM - surface.bbox.minNorthingM;
  const selectedRidge = ridge.map((point) => ({
    x: surface.bbox.minEastingM + point.x * spanX,
    y: surface.bbox.maxNorthingM - point.y * spanY,
  })) as [Point2, Point2];
  if (
    !pointInPolygon(selectedRidge[0], polygon) ||
    !pointInPolygon(selectedRidge[1], polygon)
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INVALID_INPUT",
      "Both manual ridge points must be inside or on the selected footprint",
    );
  }
  const ridgeLength = Math.hypot(
    selectedRidge[1].x - selectedRidge[0].x,
    selectedRidge[1].y - selectedRidge[0].y,
  );
  if (ridgeLength < 2) {
    throw new SimpleRoofPlaneSegmentationError(
      "INVALID_INPUT",
      "The manual ridge must be at least 2 metres long",
    );
  }
  const center = {
    x: (selectedRidge[0].x + selectedRidge[1].x) / 2,
    y: (selectedRidge[0].y + selectedRidge[1].y) / 2,
  };
  // projectedCoordinate's v axis follows (-sin(angle), cos(angle)).
  const ridgeDirection = {
    x: (selectedRidge[1].x - selectedRidge[0].x) / ridgeLength,
    y: (selectedRidge[1].y - selectedRidge[0].y) / ridgeLength,
  };
  const angleRadians = Math.atan2(ridgeDirection.x, -ridgeDirection.y);
  const raw: Array<Sample & { roofHeight: number }> = [];
  let footprintSampleCount = 0;
  for (let row = 0; row < surface.grid.height; row += 1) {
    const y =
      surface.bbox.maxNorthingM - (row + 0.5) * surface.grid.cellHeightM;
    for (let column = 0; column < surface.grid.width; column += 1) {
      const x =
        surface.bbox.minEastingM + (column + 0.5) * surface.grid.cellWidthM;
      if (!pointInPolygon({ x, y }, polygon)) continue;
      footprintSampleCount += 1;
      const index = row * surface.grid.width + column;
      const z = surface.values.domElevationM[index];
      const roofHeight = surface.values.heightAboveTerrainM[index];
      if (
        !finite(z) ||
        !finite(roofHeight) ||
        roofHeight < ROOF_MIN_HEIGHT_M ||
        roofHeight > ROOF_MAX_HEIGHT_M
      ) {
        continue;
      }
      raw.push({ x, y, z, roofHeight });
    }
  }
  if (
    raw.length < MIN_ROOF_SAMPLES ||
    footprintSampleCount < MIN_ROOF_SAMPLES
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INSUFFICIENT_ROOF_SAMPLES",
      "Too few elevated Høydedata cells support manual ridge fitting",
    );
  }
  const heights = raw
    .map((sample) => sample.roofHeight)
    .sort((left, right) => left - right);
  const lowerQuartile = quantile(heights, 0.25);
  const upperQuartile = quantile(heights, 0.75);
  const upperFence =
    upperQuartile + Math.max(1.5, (upperQuartile - lowerQuartile) * 1.75);
  const filteredSamples = raw
    .filter((sample) => sample.roofHeight <= upperFence)
    .map(({ x, y, z }) => ({ x, y, z }));
  const roofCoverageRatio = filteredSamples.length / footprintSampleCount;
  if (
    filteredSamples.length < MIN_ROOF_SAMPLES ||
    roofCoverageRatio < MIN_ROOF_COVERAGE_RATIO
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INSUFFICIENT_ROOF_SAMPLES",
      "Roof coverage after outlier filtering is too sparse for manual ridge fitting",
    );
  }
  const samples = deterministicallyDownsample(filteredSamples);
  const fit = robustFit(samples, (sample) => {
    const { u, v } = projectedCoordinate(sample, center, angleRadians);
    return [1, v, Math.max(0, -u), Math.max(0, u)];
  });
  if (!fit || fit.rmse > MAX_ACCEPTED_RMSE_M) {
    throw new SimpleRoofPlaneSegmentationError(
      "MODEL_NOT_RELIABLE",
      "The selected ridge does not support a reliable two-plane fit",
    );
  }
  const retainedRatio = fit.retainedSamples / samples.length;
  const [intercept, alongSlope, leftSlope, rightSlope] = fit.coefficients;
  const leftPitch =
    (Math.atan(Math.hypot(alongSlope, leftSlope)) * 180) / Math.PI;
  const rightPitch =
    (Math.atan(Math.hypot(alongSlope, rightSlope)) * 180) / Math.PI;
  if (
    retainedRatio < MIN_RETAINED_SAMPLE_RATIO ||
    leftSlope >= -0.03 ||
    rightSlope >= -0.03 ||
    leftPitch < MIN_PITCH_DEGREES ||
    leftPitch > MAX_PITCH_DEGREES ||
    rightPitch < MIN_PITCH_DEGREES ||
    rightPitch > MAX_PITCH_DEGREES
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "MODEL_NOT_RELIABLE",
      "The selected ridge does not meet Preview retained-sample or pitch limits",
    );
  }
  const leftPolygon = clipByRidge({
    polygon,
    center,
    angleRadians,
    ridgeOffset: 0,
    keepLower: true,
  });
  const rightPolygon = clipByRidge({
    polygon,
    center,
    angleRadians,
    ridgeOffset: 0,
    keepLower: false,
  });
  const fullRidge = ridgeEndpoints({
    polygon,
    center,
    angleRadians,
    ridgeOffset: 0,
  });
  const footprintArea = polygonArea(polygon);
  if (
    !fullRidge ||
    leftPolygon.length < 3 ||
    rightPolygon.length < 3 ||
    polygonArea(leftPolygon) < footprintArea * 0.15 ||
    polygonArea(rightPolygon) < footprintArea * 0.15
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "MODEL_NOT_RELIABLE",
      "The selected ridge does not split the footprint into two usable planes",
    );
  }
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  const alongX = -sine;
  const alongY = cosine;
  const leftGradientX = alongSlope * alongX - leftSlope * cosine;
  const leftGradientY = alongSlope * alongY - leftSlope * sine;
  const rightGradientX = alongSlope * alongX + rightSlope * cosine;
  const rightGradientY = alongSlope * alongY + rightSlope * sine;
  const elevation = (point: Point2) => {
    const { u, v } = projectedCoordinate(point, center, angleRadians);
    return (
      intercept +
      alongSlope * v +
      leftSlope * Math.max(0, -u) +
      rightSlope * Math.max(0, u)
    );
  };
  return {
    schemaVersion: SIMPLE_ROOF_PLANE_SEGMENTATION_SCHEMA_VERSION,
    roofType: "gable",
    planes: [
      planeFromPolygon({
        planeId: "plane-1",
        polygon: leftPolygon,
        gradientX: leftGradientX,
        gradientY: leftGradientY,
        elevation,
        rmse: fit.rmse,
      }),
      planeFromPolygon({
        planeId: "plane-2",
        polygon: rightPolygon,
        gradientX: rightGradientX,
        gradientY: rightGradientY,
        elevation,
        rmse: fit.rmse,
      }),
    ],
    ridge: {
      from: {
        xM: round(fullRidge.from.x, 6),
        yM: round(fullRidge.from.y, 6),
        zM: round(elevation(fullRidge.from), 6),
      },
      to: {
        xM: round(fullRidge.to.x, 6),
        yM: round(fullRidge.to.y, 6),
        zM: round(elevation(fullRidge.to), 6),
      },
      lengthMeters: round(fullRidge.lengthMeters),
    },
    sampleCount: samples.length,
    footprintSampleCount,
    roofCoverageRatio: round(roofCoverageRatio, 4),
    fitRmseM: round(fit.rmse),
    confidenceScore: confidenceScore({
      fitRmseM: fit.rmse,
      coverageRatio: roofCoverageRatio,
      retainedRatio,
    }),
    assumptions: [
      "The selected OSM footprint is a simple convex building outline",
      "An administrator selected one straight ridge in the Preview height surface",
      "Two planar slopes are fitted on opposite sides of that fixed ridge",
      "DOM outliers are excluded with deterministic robust thresholds",
      "Model fitting uses at most 600 deterministically selected roof cells",
    ],
  };
}

export function segmentSimpleRoofPlanesV1(input: {
  surface: KartverketHeightSurfaceV1;
  candidate: BuildingFootprintCandidate;
}): SimpleRoofPlaneSegmentationV1 {
  const { surface, candidate } = input;
  const expectedSamples = surface.grid.width * surface.grid.height;
  if (
    surface.schemaVersion !== "kartverket-height-surface.v1" ||
    surface.coordinateSystem !== "EPSG:25833" ||
    surface.quality.status !== "usable" ||
    !Number.isInteger(surface.grid.width) ||
    !Number.isInteger(surface.grid.height) ||
    surface.grid.width < 1 ||
    surface.grid.height < 1 ||
    !Number.isFinite(surface.grid.cellWidthM) ||
    !Number.isFinite(surface.grid.cellHeightM) ||
    surface.grid.cellWidthM <= 0 ||
    surface.grid.cellHeightM <= 0 ||
    !Number.isFinite(surface.bbox.minEastingM) ||
    !Number.isFinite(surface.bbox.minNorthingM) ||
    !Number.isFinite(surface.bbox.maxEastingM) ||
    !Number.isFinite(surface.bbox.maxNorthingM) ||
    surface.bbox.maxEastingM <= surface.bbox.minEastingM ||
    surface.bbox.maxNorthingM <= surface.bbox.minNorthingM ||
    surface.values.domElevationM.length !== expectedSamples ||
    surface.values.heightAboveTerrainM.length !== expectedSamples
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INVALID_INPUT",
      "Høydedata surface does not match the simple-roof segmentation contract",
    );
  }
  const polygon = projectedCandidatePolygon(candidate);
  if (
    polygon.length < 3 ||
    polygon.length > 8 ||
    polygonArea(polygon) < 25 ||
    !isConvex(polygon)
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "UNSUPPORTED_FOOTPRINT",
      "Automatic H3 segmentation currently accepts simple, convex footprints",
    );
  }
  const center = {
    x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
    y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
  };
  const raw: Array<Sample & { roofHeight: number }> = [];
  let footprintSampleCount = 0;
  for (let row = 0; row < surface.grid.height; row += 1) {
    const y =
      surface.bbox.maxNorthingM - (row + 0.5) * surface.grid.cellHeightM;
    for (let column = 0; column < surface.grid.width; column += 1) {
      const x =
        surface.bbox.minEastingM + (column + 0.5) * surface.grid.cellWidthM;
      if (!pointInPolygon({ x, y }, polygon)) continue;
      footprintSampleCount += 1;
      const index = row * surface.grid.width + column;
      const z = surface.values.domElevationM[index];
      const roofHeight = surface.values.heightAboveTerrainM[index];
      if (
        !finite(z) ||
        !finite(roofHeight) ||
        roofHeight < ROOF_MIN_HEIGHT_M ||
        roofHeight > ROOF_MAX_HEIGHT_M
      ) {
        continue;
      }
      raw.push({ x, y, z, roofHeight });
    }
  }
  if (
    raw.length < MIN_ROOF_SAMPLES ||
    footprintSampleCount < MIN_ROOF_SAMPLES
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INSUFFICIENT_ROOF_SAMPLES",
      "Too few elevated Høydedata cells support plane segmentation",
    );
  }
  const sortedHeights = raw
    .map((sample) => sample.roofHeight)
    .sort((left, right) => left - right);
  const lowerQuartile = quantile(sortedHeights, 0.25);
  const upperQuartile = quantile(sortedHeights, 0.75);
  const upperFence =
    upperQuartile + Math.max(1.5, (upperQuartile - lowerQuartile) * 1.75);
  const filteredSamples = raw
    .filter((sample) => sample.roofHeight <= upperFence)
    .map(({ x, y, z }) => ({ x, y, z }));
  const roofCoverageRatio = filteredSamples.length / footprintSampleCount;
  if (
    filteredSamples.length < MIN_ROOF_SAMPLES ||
    roofCoverageRatio < MIN_ROOF_COVERAGE_RATIO
  ) {
    throw new SimpleRoofPlaneSegmentationError(
      "INSUFFICIENT_ROOF_SAMPLES",
      "Roof coverage after outlier filtering is too sparse for plane segmentation",
    );
  }
  const samples = deterministicallyDownsample(filteredSamples);

  const mono = fitMono(samples, center);
  const gable = fitGable(samples, polygon, center);
  if (!mono) {
    throw new SimpleRoofPlaneSegmentationError(
      "MODEL_NOT_RELIABLE",
      "A stable roof plane could not be fitted",
    );
  }
  const monoPitch =
    (Math.atan(Math.hypot(mono.coefficients[1], mono.coefficients[2])) * 180) /
    Math.PI;
  const monoAcceptable =
    mono.rmse <= MAX_FLAT_OR_MONO_RMSE_M &&
    monoPitch <= MAX_PITCH_DEGREES &&
    mono.retainedSamples / samples.length >= MIN_RETAINED_SAMPLE_RATIO;
  const gableImprovement = gable
    ? 1 - gable.rmse / Math.max(mono.rmse, 1e-6)
    : 0;

  if (
    gable &&
    gable.rmse <= MAX_ACCEPTED_RMSE_M &&
    gable.retainedSamples / samples.length >= MIN_RETAINED_SAMPLE_RATIO &&
    (gableImprovement >= 0.15 || mono.rmse - gable.rmse >= 0.12)
  ) {
    const [intercept, alongSlope, leftSlope, rightSlope] = gable.coefficients;
    const leftPitch =
      (Math.atan(Math.hypot(alongSlope, leftSlope)) * 180) / Math.PI;
    const rightPitch =
      (Math.atan(Math.hypot(alongSlope, rightSlope)) * 180) / Math.PI;
    const ridge = ridgeEndpoints({
      polygon,
      center,
      angleRadians: gable.angleRadians,
      ridgeOffset: gable.ridgeOffset,
    });
    const leftPolygon = clipByRidge({
      polygon,
      center,
      angleRadians: gable.angleRadians,
      ridgeOffset: gable.ridgeOffset,
      keepLower: true,
    });
    const rightPolygon = clipByRidge({
      polygon,
      center,
      angleRadians: gable.angleRadians,
      ridgeOffset: gable.ridgeOffset,
      keepLower: false,
    });
    const footprintArea = polygonArea(polygon);
    if (
      ridge &&
      leftPitch >= MIN_PITCH_DEGREES &&
      leftPitch <= MAX_PITCH_DEGREES &&
      rightPitch >= MIN_PITCH_DEGREES &&
      rightPitch <= MAX_PITCH_DEGREES &&
      leftPolygon.length >= 3 &&
      rightPolygon.length >= 3 &&
      polygonArea(leftPolygon) >= footprintArea * 0.15 &&
      polygonArea(rightPolygon) >= footprintArea * 0.15
    ) {
      const cosine = Math.cos(gable.angleRadians);
      const sine = Math.sin(gable.angleRadians);
      const alongX = -sine;
      const alongY = cosine;
      const leftGradientX = alongSlope * alongX - leftSlope * cosine;
      const leftGradientY = alongSlope * alongY - leftSlope * sine;
      const rightGradientX = alongSlope * alongX + rightSlope * cosine;
      const rightGradientY = alongSlope * alongY + rightSlope * sine;
      const elevation = (point: Point2) => {
        const { u, v } = projectedCoordinate(point, center, gable.angleRadians);
        return (
          intercept +
          alongSlope * v +
          leftSlope * Math.max(0, gable.ridgeOffset - u) +
          rightSlope * Math.max(0, u - gable.ridgeOffset)
        );
      };
      const ridgeFrom = { ...ridge.from, zM: round(elevation(ridge.from), 6) };
      const ridgeTo = { ...ridge.to, zM: round(elevation(ridge.to), 6) };
      return {
        schemaVersion: SIMPLE_ROOF_PLANE_SEGMENTATION_SCHEMA_VERSION,
        roofType: "gable",
        planes: [
          planeFromPolygon({
            planeId: "plane-1",
            polygon: leftPolygon,
            gradientX: leftGradientX,
            gradientY: leftGradientY,
            elevation,
            rmse: gable.rmse,
          }),
          planeFromPolygon({
            planeId: "plane-2",
            polygon: rightPolygon,
            gradientX: rightGradientX,
            gradientY: rightGradientY,
            elevation,
            rmse: gable.rmse,
          }),
        ],
        ridge: {
          from: {
            xM: round(ridgeFrom.x, 6),
            yM: round(ridgeFrom.y, 6),
            zM: ridgeFrom.zM,
          },
          to: {
            xM: round(ridgeTo.x, 6),
            yM: round(ridgeTo.y, 6),
            zM: ridgeTo.zM,
          },
          lengthMeters: round(ridge.lengthMeters),
        },
        sampleCount: samples.length,
        footprintSampleCount,
        roofCoverageRatio: round(roofCoverageRatio, 4),
        fitRmseM: round(gable.rmse),
        confidenceScore: confidenceScore({
          fitRmseM: gable.rmse,
          coverageRatio: roofCoverageRatio,
          retainedRatio: gable.retainedSamples / samples.length,
        }),
        assumptions: [
          "The selected OSM footprint is a simple convex building outline",
          "Two planar slopes meet at one straight ridge",
          "DOM outliers are excluded with deterministic robust thresholds",
          "Model fitting uses at most 600 deterministically selected roof cells",
        ],
      };
    }
  }

  if (!monoAcceptable) {
    throw new SimpleRoofPlaneSegmentationError(
      "MODEL_NOT_RELIABLE",
      "Neither a single plane nor a two-plane gable fits within Preview limits",
    );
  }
  const [intercept, gradientX, gradientY] = mono.coefficients;
  const elevation = (point: Point2) =>
    intercept +
    gradientX * (point.x - center.x) +
    gradientY * (point.y - center.y);
  const roofType: SimpleRoofTypeV1 =
    monoPitch < MIN_PITCH_DEGREES ? "flat" : "mono";
  return {
    schemaVersion: SIMPLE_ROOF_PLANE_SEGMENTATION_SCHEMA_VERSION,
    roofType,
    planes: [
      planeFromPolygon({
        planeId: "plane-1",
        polygon,
        gradientX,
        gradientY,
        elevation,
        rmse: mono.rmse,
      }),
    ],
    ridge: null,
    sampleCount: samples.length,
    footprintSampleCount,
    roofCoverageRatio: round(roofCoverageRatio, 4),
    fitRmseM: round(mono.rmse),
    confidenceScore: confidenceScore({
      fitRmseM: mono.rmse,
      coverageRatio: roofCoverageRatio,
      retainedRatio: mono.retainedSamples / samples.length,
    }),
    assumptions: [
      "The selected OSM footprint is a simple convex building outline",
      roofType === "flat"
        ? "One near-horizontal roof plane explains the usable DOM cells"
        : "One sloped roof plane explains the usable DOM cells",
      "DOM outliers are excluded with deterministic robust thresholds",
      "Model fitting uses at most 600 deterministically selected roof cells",
    ],
  };
}
