import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import {
  assertAssistedManualRoofGeometryV1,
  canonicalAssistedManualRoofGeometryV1,
  validateAssistedManualRoofGeometryV1,
  type AssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";
import {
  canonicalSha256V1,
  compareCanonicalStringsV1,
} from "./canonicalization-v1";

export const ASSISTED_MANUAL_SURFACE_SUBDIVISION_VERSION =
  "assisted-manual-surface-subdivision.v1" as const;

type Point2 = { xM: number; yM: number };
type Point3 = Point2 & { zM: number };
type Plane = {
  a: number;
  b: number;
  c: number;
  rmseM: number;
  sampleCount: number;
};

export type AssistedManualSubdivisionIssueCodeV1 =
  | "GEOMETRY_INVALID"
  | "HEIGHT_SURFACE_INVALID"
  | "ROOF_MASSES_OVERLAP"
  | "DUPLICATE_VERTEX_POSITION"
  | "SKELETON_EDGE_OVERLAP"
  | "SKELETON_EDGE_CROSSES_EDGE"
  | "SKELETON_EDGE_OUTSIDE_MASS"
  | "EAVE_NOT_ON_BOUNDARY"
  | "SKELETON_DANGLING_ENDPOINT"
  | "SKELETON_DOES_NOT_SUBDIVIDE"
  | "MISSING_OR_AMBIGUOUS_SKELETON"
  | "FACE_TOPOLOGY_INVALID"
  | "MASS_COVERAGE_INVALID"
  | "SURFACE_OVERLAP"
  | "TOO_FEW_HEIGHT_SAMPLES"
  | "UNSTABLE_HEIGHT_PLANE"
  | "SHARED_EDGE_HEIGHT_CONFLICT"
  | "OPENING_NOT_CONTAINED_IN_ONE_SURFACE";

export type AssistedManualSubdivisionIssueV1 = {
  code: AssistedManualSubdivisionIssueCodeV1;
  entityRefs: string[];
  message: string;
};

export type AssistedManualSubdivisionEdgeV1 = {
  edgeId: string;
  fromVertexId: string;
  toVertexId: string;
  kind: "eave" | "ridge" | "valley" | "hip";
  surfaceIds: string[];
  sourceSkeletonEdgeIds: string[];
};

export type AssistedManualSubdivisionSurfaceV1 = {
  surfaceId: string;
  roofMassId: string;
  vertexIds: string[];
  edgeIds: string[];
  horizontalAreaM2: number;
  plane: Plane;
  vertices: Array<{ vertexId: string; xM: number; yM: number; zM: number }>;
  openingIds: string[];
};

export type AssistedManualSurfaceSubdivisionResultV1 = {
  schemaVersion: typeof ASSISTED_MANUAL_SURFACE_SUBDIVISION_VERSION;
  status: "ready" | "review_required" | "blocked";
  inputHash: string;
  surfaces: AssistedManualSubdivisionSurfaceV1[];
  edges: AssistedManualSubdivisionEdgeV1[];
  issues: AssistedManualSubdivisionIssueV1[];
};

type GraphEdge = {
  a: string;
  b: string;
  kind: AssistedManualSubdivisionEdgeV1["kind"];
  sourceIds: string[];
};

const EPS = 1e-7;
const AREA_TOLERANCE_M2 = 1e-5;
const MAX_PLANE_RMSE_M = 1.2;
const MAX_SHARED_EDGE_Z_DELTA_M = 0.75;
const MIN_HEIGHT_ABOVE_TERRAIN_M = 1.5;
const MIN_SAMPLES = 6;

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function issue(
  code: AssistedManualSubdivisionIssueCodeV1,
  message: string,
  ...entityRefs: string[]
): AssistedManualSubdivisionIssueV1 {
  return {
    code,
    entityRefs: [...new Set(entityRefs)].sort(compareCanonicalStringsV1),
    message,
  };
}

function cross(a: Point2, b: Point2, c: Point2) {
  return (b.xM - a.xM) * (c.yM - a.yM) - (b.yM - a.yM) * (c.xM - a.xM);
}

function onSegment(point: Point2, a: Point2, b: Point2, includeEnds = true) {
  if (Math.abs(cross(a, b, point)) > EPS) return false;
  const within =
    point.xM >= Math.min(a.xM, b.xM) - EPS &&
    point.xM <= Math.max(a.xM, b.xM) + EPS &&
    point.yM >= Math.min(a.yM, b.yM) - EPS &&
    point.yM <= Math.max(a.yM, b.yM) + EPS;
  if (!within || includeEnds) return within;
  return distance(point, a) > EPS && distance(point, b) > EPS;
}

function distance(a: Point2, b: Point2) {
  return Math.hypot(a.xM - b.xM, a.yM - b.yM);
}

function signedArea(points: Point2[]) {
  const origin = points[0];
  if (!origin) return 0;
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      const x = point.xM - origin.xM;
      const y = point.yM - origin.yM;
      const nextX = next.xM - origin.xM;
      const nextY = next.yM - origin.yM;
      return sum + x * nextY - nextX * y;
    }, 0) / 2
  );
}

function pointLocation(
  point: Point2,
  polygon: Point2[],
): "inside" | "boundary" | "outside" {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    if (onSegment(point, polygon[j], polygon[i])) return "boundary";
    if (
      polygon[i].yM > point.yM !== polygon[j].yM > point.yM &&
      point.xM <
        ((polygon[j].xM - polygon[i].xM) * (point.yM - polygon[i].yM)) /
          (polygon[j].yM - polygon[i].yM) +
          polygon[i].xM
    ) {
      inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}

function properIntersection(a: Point2, b: Point2, c: Point2, d: Point2) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD < -EPS && cdA * cdB < -EPS;
}

function collinearOverlap(a: Point2, b: Point2, c: Point2, d: Point2) {
  if (Math.abs(cross(a, b, c)) > EPS || Math.abs(cross(a, b, d)) > EPS)
    return false;
  const useX = Math.abs(a.xM - b.xM) >= Math.abs(a.yM - b.yM);
  const values = useX ? [a.xM, b.xM, c.xM, d.xM] : [a.yM, b.yM, c.yM, d.yM];
  const firstMin = Math.min(values[0], values[1]);
  const firstMax = Math.max(values[0], values[1]);
  const secondMin = Math.min(values[2], values[3]);
  const secondMax = Math.max(values[2], values[3]);
  return Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin) > EPS;
}

function polygonsOverlapArea(left: Point2[], right: Point2[]) {
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      if (
        properIntersection(
          left[i],
          left[(i + 1) % left.length],
          right[j],
          right[(j + 1) % right.length],
        )
      )
        return true;
    }
  }
  if (
    left.some((point) => pointLocation(point, right) === "inside") ||
    right.some((point) => pointLocation(point, left) === "inside")
  )
    return true;
  const inwardProbeInside = (polygon: Point2[], target: Point2[]) => {
    const orientation = Math.sign(signedArea(polygon));
    return polygon.some((from, index) => {
      const to = polygon[(index + 1) % polygon.length];
      const length = distance(from, to);
      if (length <= EPS) return false;
      const inwardScale = 1e-5 * orientation;
      const probe = {
        xM: (from.xM + to.xM) / 2 - ((to.yM - from.yM) / length) * inwardScale,
        yM: (from.yM + to.yM) / 2 + ((to.xM - from.xM) / length) * inwardScale,
      };
      return pointLocation(probe, target) === "inside";
    });
  };
  return inwardProbeInside(left, right) || inwardProbeInside(right, left);
}

function fitPlane(points: Point3[]): Plane | null {
  if (points.length < 3) return null;
  const mean = points.reduce(
    (sum, point) => ({
      xM: sum.xM + point.xM / points.length,
      yM: sum.yM + point.yM / points.length,
      zM: sum.zM + point.zM / points.length,
    }),
    { xM: 0, yM: 0, zM: 0 },
  );
  let sxx = 0,
    syy = 0,
    sxy = 0,
    sxz = 0,
    syz = 0;
  for (const point of points) {
    const x = point.xM - mean.xM;
    const y = point.yM - mean.yM;
    const z = point.zM - mean.zM;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxz += x * z;
    syz += y * z;
  }
  const determinant = sxx * syy - sxy * sxy;
  if (Math.abs(determinant) < 1e-9) return null;
  const a = (sxz * syy - syz * sxy) / determinant;
  const b = (syz * sxx - sxz * sxy) / determinant;
  const c = mean.zM - a * mean.xM - b * mean.yM;
  const rmseM = Math.sqrt(
    points.reduce(
      (sum, p) => sum + (p.zM - (a * p.xM + b * p.yM + c)) ** 2,
      0,
    ) / points.length,
  );
  return {
    a: round(a, 9),
    b: round(b, 9),
    c: round(c, 9),
    rmseM: round(rmseM),
    sampleCount: points.length,
  };
}

function samplePolygon(
  polygon: Point2[],
  height: KartverketHeightSurfaceV1,
  holes: Point2[][] = [],
) {
  const result: Point3[] = [];
  for (let row = 0; row < height.grid.height; row += 1) {
    const yM = height.bbox.maxNorthingM - (row + 0.5) * height.grid.cellHeightM;
    for (let column = 0; column < height.grid.width; column += 1) {
      const xM =
        height.bbox.minEastingM + (column + 0.5) * height.grid.cellWidthM;
      if (pointLocation({ xM, yM }, polygon) === "outside") continue;
      if (holes.some((hole) => pointLocation({ xM, yM }, hole) !== "outside"))
        continue;
      const index = row * height.grid.width + column;
      const zM = height.values.domElevationM[index];
      const heightM = height.values.heightAboveTerrainM[index];
      if (
        zM === null ||
        heightM === null ||
        !Number.isFinite(zM) ||
        !Number.isFinite(heightM) ||
        heightM < MIN_HEIGHT_ABOVE_TERRAIN_M
      )
        continue;
      result.push({ xM, yM, zM });
    }
  }
  return result;
}

function polygonStrictlyContained(inner: Point2[], outer: Point2[]) {
  if (!inner.every((point) => pointLocation(point, outer) === "inside"))
    return false;
  for (let i = 0; i < inner.length; i += 1) {
    for (let j = 0; j < outer.length; j += 1) {
      if (
        properIntersection(
          inner[i],
          inner[(i + 1) % inner.length],
          outer[j],
          outer[(j + 1) % outer.length],
        )
      )
        return false;
    }
  }
  return true;
}

function edgeKey(a: string, b: string) {
  return [a, b].sort(compareCanonicalStringsV1).join("\u0000");
}

function roofEdgeId(a: string, b: string) {
  return `edge-${canonicalSha256V1(edgeKey(a, b), "takfornyelse:roof-edge:v1").slice(0, 16)}`;
}

function canonicalCycle(ids: string[]) {
  const rotations = ids.map((_, index) => [
    ...ids.slice(index),
    ...ids.slice(0, index),
  ]);
  return rotations.sort((a, b) =>
    compareCanonicalStringsV1(a.join("\u0000"), b.join("\u0000")),
  )[0];
}

function splitEdge(
  edge: GraphEdge,
  points: Map<string, Point2>,
  candidates: string[],
) {
  const a = points.get(edge.a)!;
  const b = points.get(edge.b)!;
  const ids = candidates
    .filter((id) => onSegment(points.get(id)!, a, b))
    .sort(
      (left, right) =>
        distance(a, points.get(left)!) - distance(a, points.get(right)!) ||
        compareCanonicalStringsV1(left, right),
    );
  return ids
    .slice(0, -1)
    .map((id, index) => ({ ...edge, a: id, b: ids[index + 1] }))
    .filter((item) => item.a !== item.b);
}

function extractFaces(edges: GraphEdge[], points: Map<string, Point2>) {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.a, [...(adjacency.get(edge.a) ?? []), edge.b]);
    adjacency.set(edge.b, [...(adjacency.get(edge.b) ?? []), edge.a]);
  }
  for (const [id, neighbours] of adjacency) {
    const origin = points.get(id)!;
    adjacency.set(
      id,
      [...new Set(neighbours)].sort((left, right) => {
        const l = points.get(left)!;
        const r = points.get(right)!;
        return (
          Math.atan2(l.yM - origin.yM, l.xM - origin.xM) -
            Math.atan2(r.yM - origin.yM, r.xM - origin.xM) ||
          compareCanonicalStringsV1(left, right)
        );
      }),
    );
  }
  const visited = new Set<string>();
  const faces: string[][] = [];
  for (const edge of edges) {
    for (const [startA, startB] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ]) {
      const directedKey = `${startA}\u0000${startB}`;
      if (visited.has(directedKey)) continue;
      const cycle: string[] = [];
      let a = startA;
      let b = startB;
      for (let guard = 0; guard <= edges.length * 2 + 2; guard += 1) {
        const key = `${a}\u0000${b}`;
        if (visited.has(key) && key !== directedKey) {
          cycle.length = 0;
          break;
        }
        visited.add(key);
        cycle.push(a);
        const neighbours = adjacency.get(b)!;
        const reverseIndex = neighbours.indexOf(a);
        const next =
          neighbours[
            (reverseIndex - 1 + neighbours.length) % neighbours.length
          ];
        a = b;
        b = next;
        if (a === startA && b === startB) break;
      }
      if (cycle.length >= 3) {
        const polygon = cycle.map((id) => points.get(id)!);
        if (signedArea(polygon) > AREA_TOLERANCE_M2)
          faces.push(canonicalCycle(cycle));
      }
    }
  }
  const unique = new Map(faces.map((face) => [face.join("\u0000"), face]));
  return [...unique.values()].sort((a, b) =>
    compareCanonicalStringsV1(a.join("\u0000"), b.join("\u0000")),
  );
}

/**
 * Deterministically turns approved mass boundaries plus an explicit planar skeleton into
 * closed shared-edge roof faces, then fits each face only from supplied Høydedata.
 * It never invents missing skeleton edges: incomplete/ambiguous topology returns no surfaces.
 */
export function subdivideAssistedManualRoofSurfacesV1(
  geometryValue: AssistedManualRoofGeometryV1,
  heightSurface: KartverketHeightSurfaceV1,
): AssistedManualSurfaceSubdivisionResultV1 {
  const geometryIssues = validateAssistedManualRoofGeometryV1(geometryValue);
  if (geometryIssues.length) {
    const inputHash = canonicalSha256V1(
      { geometry: geometryValue, heightSurface },
      "takfornyelse:assisted-manual-surface-subdivision:invalid:v1",
    );
    return finish(
      "blocked",
      inputHash,
      [],
      [],
      geometryIssues.map((item) =>
        issue(
          "GEOMETRY_INVALID",
          `Assisted manual geometry failed validation: ${item.code}.`,
          ...item.entityRefs,
        ),
      ),
    );
  }
  const geometry = canonicalAssistedManualRoofGeometryV1(
    assertAssistedManualRoofGeometryV1(geometryValue),
  );
  const inputHash = canonicalSha256V1(
    { geometry, heightSurface },
    "takfornyelse:assisted-manual-surface-subdivision:v1",
  );
  const issues: AssistedManualSubdivisionIssueV1[] = [];
  const points = new Map(
    geometry.vertices.map((vertex) => [
      vertex.vertexId,
      { xM: vertex.xM, yM: vertex.yM },
    ]),
  );
  if (
    heightSurface.schemaVersion !== "kartverket-height-surface.v1" ||
    heightSurface.coordinateSystem !== "EPSG:25833" ||
    heightSurface.grid.width <= 0 ||
    heightSurface.grid.height <= 0 ||
    heightSurface.grid.cellWidthM <= 0 ||
    heightSurface.grid.cellHeightM <= 0 ||
    Math.abs(
      heightSurface.bbox.maxEastingM -
        heightSurface.bbox.minEastingM -
        heightSurface.grid.width * heightSurface.grid.cellWidthM,
    ) > EPS ||
    Math.abs(
      heightSurface.bbox.maxNorthingM -
        heightSurface.bbox.minNorthingM -
        heightSurface.grid.height * heightSurface.grid.cellHeightM,
    ) > EPS ||
    heightSurface.values.domElevationM.length !==
      heightSurface.grid.width * heightSurface.grid.height ||
    heightSurface.values.dtmElevationM.length !==
      heightSurface.grid.width * heightSurface.grid.height ||
    heightSurface.values.heightAboveTerrainM.length !==
      heightSurface.grid.width * heightSurface.grid.height
  ) {
    issues.push(
      issue(
        "HEIGHT_SURFACE_INVALID",
        "Høydedata must be a complete EPSG:25833 height-surface.v1 grid.",
      ),
    );
  }
  const positionOwner = new Map<string, string>();
  for (const [id, point] of points) {
    const key = `${round(point.xM, 7)},${round(point.yM, 7)}`;
    const owner = positionOwner.get(key);
    if (owner)
      issues.push(
        issue(
          "DUPLICATE_VERTEX_POSITION",
          "Different vertex IDs occupy the same plan position; merge them before subdivision.",
          owner,
          id,
        ),
      );
    else positionOwner.set(key, id);
  }
  const massPolygons = geometry.roofMasses.map((mass) => ({
    mass,
    polygon: mass.vertexIds.map((id) => points.get(id)!),
  }));
  for (let i = 0; i < massPolygons.length; i += 1) {
    for (let j = i + 1; j < massPolygons.length; j += 1) {
      if (
        polygonsOverlapArea(massPolygons[i].polygon, massPolygons[j].polygon)
      ) {
        issues.push(
          issue(
            "ROOF_MASSES_OVERLAP",
            "Approved roof masses overlap by area; shared boundaries are allowed, overlapping interiors are not.",
            massPolygons[i].mass.massId,
            massPolygons[j].mass.massId,
          ),
        );
      }
    }
  }
  if (issues.length) return finish("blocked", inputHash, [], [], issues);

  const allSurfaces: AssistedManualSubdivisionSurfaceV1[] = [];
  const allGraphEdges: GraphEdge[] = [];
  for (const { mass, polygon: massPolygon } of massPolygons) {
    const skeleton = geometry.skeletonEdges.filter(
      (edge) => edge.roofMassId === mass.massId,
    );
    const internalSkeleton = skeleton.filter((edge) => edge.type !== "eave");
    const relevantIds = [
      ...new Set([
        ...mass.vertexIds,
        ...skeleton.flatMap((edge) => [edge.fromVertexId, edge.toVertexId]),
      ]),
    ];
    const rawBoundary: GraphEdge[] = mass.vertexIds.map((id, index) => ({
      a: id,
      b: mass.vertexIds[(index + 1) % mass.vertexIds.length],
      kind: "eave",
      sourceIds: [],
    }));
    const rawEaves: GraphEdge[] = skeleton
      .filter((edge) => edge.type === "eave")
      .map((edge) => ({
        a: edge.fromVertexId,
        b: edge.toVertexId,
        kind: "eave",
        sourceIds: [edge.edgeId],
      }));
    const rawInternal: GraphEdge[] = internalSkeleton.map((edge) => ({
      a: edge.fromVertexId,
      b: edge.toVertexId,
      kind: edge.type,
      sourceIds: [edge.edgeId],
    }));
    for (const edge of rawEaves) {
      const a = points.get(edge.a)!;
      const b = points.get(edge.b)!;
      const midpoint = { xM: (a.xM + b.xM) / 2, yM: (a.yM + b.yM) / 2 };
      if (pointLocation(midpoint, massPolygon) !== "boundary") {
        issues.push(
          issue(
            "EAVE_NOT_ON_BOUNDARY",
            "An eave hint leaves the approved mass boundary.",
            mass.massId,
            ...edge.sourceIds,
          ),
        );
      }
    }
    for (const edge of rawInternal) {
      const a = points.get(edge.a)!;
      const b = points.get(edge.b)!;
      const midpoint = { xM: (a.xM + b.xM) / 2, yM: (a.yM + b.yM) / 2 };
      if (
        pointLocation(midpoint, massPolygon) === "outside" ||
        rawBoundary.some((boundary) =>
          properIntersection(
            a,
            b,
            points.get(boundary.a)!,
            points.get(boundary.b)!,
          ),
        )
      ) {
        issues.push(
          issue(
            "SKELETON_EDGE_OUTSIDE_MASS",
            "An internal skeleton edge leaves or crosses the approved mass boundary.",
            mass.massId,
            ...edge.sourceIds,
          ),
        );
      }
    }
    const rawEdges = [...rawBoundary, ...rawEaves, ...rawInternal];
    for (let i = 0; i < rawInternal.length; i += 1) {
      for (let j = i + 1; j < rawInternal.length; j += 1) {
        const left = rawInternal[i];
        const right = rawInternal[j];
        const a = points.get(left.a)!;
        const b = points.get(left.b)!;
        const c = points.get(right.a)!;
        const d = points.get(right.b)!;
        if (collinearOverlap(a, b, c, d))
          issues.push(
            issue(
              "SKELETON_EDGE_OVERLAP",
              "Skeleton edges overlap instead of sharing one explicit edge.",
              ...left.sourceIds,
              ...right.sourceIds,
            ),
          );
        else if (properIntersection(a, b, c, d))
          issues.push(
            issue(
              "SKELETON_EDGE_CROSSES_EDGE",
              "Skeleton edges cross without an explicit shared vertex.",
              ...left.sourceIds,
              ...right.sourceIds,
            ),
          );
      }
    }
    const splitEdges = rawEdges.flatMap((edge) =>
      splitEdge(edge, points, relevantIds),
    );
    const edgeMap = new Map<string, GraphEdge>();
    for (const edge of splitEdges) {
      const key = edgeKey(edge.a, edge.b);
      const current = edgeMap.get(key);
      if (!current) edgeMap.set(key, edge);
      else if (current.kind !== edge.kind && edge.kind !== "eave")
        issues.push(
          issue(
            "SKELETON_EDGE_OVERLAP",
            "An internal skeleton edge overlaps another graph edge.",
            ...current.sourceIds,
            ...edge.sourceIds,
          ),
        );
      else
        current.sourceIds = [
          ...new Set([...current.sourceIds, ...edge.sourceIds]),
        ].sort(compareCanonicalStringsV1);
    }
    const graphEdges = [...edgeMap.values()];
    const degree = new Map<string, number>();
    for (const edge of graphEdges) {
      degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
      degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
    }
    for (const id of relevantIds) {
      if (
        pointLocation(points.get(id)!, massPolygon) === "inside" &&
        (degree.get(id) ?? 0) < 2
      ) {
        issues.push(
          issue(
            "SKELETON_DANGLING_ENDPOINT",
            "An internal skeleton endpoint is dangling; add the missing ridge/valley/hip edge explicitly.",
            mass.massId,
            id,
          ),
        );
      }
    }
    const faces = extractFaces(graphEdges, points);
    if (internalSkeleton.length > 0 && faces.length < 2)
      issues.push(
        issue(
          "SKELETON_DOES_NOT_SUBDIVIDE",
          "The supplied skeleton does not form two or more closed roof surfaces.",
          mass.massId,
          ...internalSkeleton.map((edge) => edge.edgeId),
        ),
      );
    if (!faces.length)
      issues.push(
        issue(
          "FACE_TOPOLOGY_INVALID",
          "No closed, non-self-intersecting interior face could be extracted.",
          mass.massId,
        ),
      );
    const massArea = Math.abs(signedArea(massPolygon));
    const faceArea = faces.reduce(
      (sum, face) =>
        sum + Math.abs(signedArea(face.map((id) => points.get(id)!))),
      0,
    );
    if (
      Math.abs(faceArea - massArea) >
      Math.max(AREA_TOLERANCE_M2, massArea * 1e-7)
    )
      issues.push(
        issue(
          "MASS_COVERAGE_INVALID",
          "Extracted surfaces do not cover the approved mass exactly within tolerance.",
          mass.massId,
        ),
      );
    for (let i = 0; i < faces.length; i += 1) {
      for (let j = i + 1; j < faces.length; j += 1) {
        if (
          polygonsOverlapArea(
            faces[i].map((id) => points.get(id)!),
            faces[j].map((id) => points.get(id)!),
          )
        )
          issues.push(
            issue(
              "SURFACE_OVERLAP",
              "Extracted surface interiors overlap.",
              mass.massId,
            ),
          );
      }
    }
    if (issues.length) continue;
    const openings = geometry.openings.filter(
      (item) => item.roofMassId === mass.massId,
    );
    const openingOwner = new Map<string, number>();
    for (const opening of openings) {
      const openingPolygon = opening.vertexIds.map((id) => points.get(id)!);
      const owners = faces
        .map((face) => face.map((id) => points.get(id)!))
        .map((face, index) =>
          polygonStrictlyContained(openingPolygon, face) ? index : -1,
        )
        .filter((index) => index >= 0);
      if (owners.length !== 1)
        issues.push(
          issue(
            "OPENING_NOT_CONTAINED_IN_ONE_SURFACE",
            "An opening must be strictly contained in exactly one subdivided surface and may not touch/cross a shared edge.",
            mass.massId,
            opening.openingId,
          ),
        );
      else openingOwner.set(opening.openingId, owners[0]);
    }
    if (issues.length) continue;
    const preliminary = faces.map((face, index) => {
      const polygon = face.map((id) => points.get(id)!);
      const ownedOpenings = openings.filter(
        (opening) => openingOwner.get(opening.openingId) === index,
      );
      const samples = samplePolygon(
        polygon,
        heightSurface,
        ownedOpenings.map((opening) =>
          opening.vertexIds.map((id) => points.get(id)!),
        ),
      );
      const plane = fitPlane(samples);
      const surfaceId = `surface-${mass.massId}-${index + 1}`;
      if (samples.length < MIN_SAMPLES)
        issues.push(
          issue(
            "TOO_FEW_HEIGHT_SAMPLES",
            "A face has too few valid roof-height samples for deterministic fitting.",
            mass.massId,
            surfaceId,
          ),
        );
      else if (!plane || plane.rmseM > MAX_PLANE_RMSE_M)
        issues.push(
          issue(
            internalSkeleton.length
              ? "UNSTABLE_HEIGHT_PLANE"
              : "MISSING_OR_AMBIGUOUS_SKELETON",
            internalSkeleton.length
              ? "A skeleton face does not fit a stable Høydedata plane."
              : "The mass is not a stable single plane and has no explicit internal skeleton; review must supply subdivision hints.",
            mass.massId,
            surfaceId,
          ),
        );
      return { face, polygon, plane, surfaceId };
    });
    if (issues.length) continue;
    for (const candidate of preliminary) {
      const faceIndex = preliminary.indexOf(candidate);
      const openingIds = openings
        .filter((opening) => openingOwner.get(opening.openingId) === faceIndex)
        .map((opening) => opening.openingId);
      allSurfaces.push({
        surfaceId: candidate.surfaceId,
        roofMassId: mass.massId,
        vertexIds: candidate.face,
        edgeIds: candidate.face.map((id, index) =>
          roofEdgeId(id, candidate.face[(index + 1) % candidate.face.length]),
        ),
        horizontalAreaM2: round(Math.abs(signedArea(candidate.polygon)), 6),
        plane: candidate.plane!,
        vertices: candidate.face.map((id) => {
          const point = points.get(id)!;
          return {
            vertexId: id,
            xM: point.xM,
            yM: point.yM,
            zM: round(
              candidate.plane!.a * point.xM +
                candidate.plane!.b * point.yM +
                candidate.plane!.c,
            ),
          };
        }),
        openingIds,
      });
    }
    allGraphEdges.push(...graphEdges);
  }

  if (issues.length)
    return finish(
      issues.some((item) => item.code === "MISSING_OR_AMBIGUOUS_SKELETON")
        ? "review_required"
        : "blocked",
      inputHash,
      [],
      [],
      issues,
    );
  const surfaceByEdge = new Map<string, string[]>();
  for (const surface of allSurfaces) {
    surface.vertexIds.forEach((id, index) => {
      const key = edgeKey(
        id,
        surface.vertexIds[(index + 1) % surface.vertexIds.length],
      );
      surfaceByEdge.set(key, [
        ...(surfaceByEdge.get(key) ?? []),
        surface.surfaceId,
      ]);
    });
  }
  const uniqueGraphEdges = new Map<string, GraphEdge>();
  for (const edge of allGraphEdges) {
    const key = edgeKey(edge.a, edge.b);
    const current = uniqueGraphEdges.get(key);
    if (!current) uniqueGraphEdges.set(key, { ...edge });
    else
      current.sourceIds = [
        ...new Set([...current.sourceIds, ...edge.sourceIds]),
      ].sort(compareCanonicalStringsV1);
  }
  const edges: AssistedManualSubdivisionEdgeV1[] = [
    ...uniqueGraphEdges.values(),
  ]
    .map((edge) => {
      const key = edgeKey(edge.a, edge.b);
      const owners = [...new Set(surfaceByEdge.get(key) ?? [])].sort(
        compareCanonicalStringsV1,
      );
      return {
        edgeId: roofEdgeId(edge.a, edge.b),
        fromVertexId: [edge.a, edge.b].sort(compareCanonicalStringsV1)[0],
        toVertexId: [edge.a, edge.b].sort(compareCanonicalStringsV1)[1],
        kind: edge.kind,
        surfaceIds: owners,
        sourceSkeletonEdgeIds: edge.sourceIds,
      };
    })
    .sort((a, b) => compareCanonicalStringsV1(a.edgeId, b.edgeId));
  for (const edge of edges) {
    if (edge.kind !== "eave" && edge.surfaceIds.length !== 2)
      issues.push(
        issue(
          "FACE_TOPOLOGY_INVALID",
          "Every internal skeleton edge must be shared by exactly two surfaces.",
          edge.edgeId,
          ...edge.sourceSkeletonEdgeIds,
        ),
      );
    if (edge.surfaceIds.length > 2)
      issues.push(
        issue(
          "FACE_TOPOLOGY_INVALID",
          "A shared edge may belong to at most two roof surfaces.",
          edge.edgeId,
          ...edge.surfaceIds,
        ),
      );
    if (edge.surfaceIds.length === 2) {
      const left = allSurfaces.find(
        (surface) => surface.surfaceId === edge.surfaceIds[0],
      )!;
      const right = allSurfaces.find(
        (surface) => surface.surfaceId === edge.surfaceIds[1],
      )!;
      for (const id of [edge.fromVertexId, edge.toVertexId]) {
        const lz = left.vertices.find((vertex) => vertex.vertexId === id)!.zM;
        const rz = right.vertices.find((vertex) => vertex.vertexId === id)!.zM;
        if (Math.abs(lz - rz) > MAX_SHARED_EDGE_Z_DELTA_M)
          issues.push(
            issue(
              "SHARED_EDGE_HEIGHT_CONFLICT",
              "Adjacent fitted planes disagree at a shared skeleton endpoint beyond tolerance.",
              edge.edgeId,
              id,
              ...edge.surfaceIds,
            ),
          );
      }
    }
  }
  if (!issues.length) {
    const elevationsByVertex = new Map<string, number[]>();
    for (const surface of allSurfaces) {
      for (const vertex of surface.vertices) {
        elevationsByVertex.set(vertex.vertexId, [
          ...(elevationsByVertex.get(vertex.vertexId) ?? []),
          vertex.zM,
        ]);
      }
    }
    const sharedElevation = new Map(
      [...elevationsByVertex].map(([vertexId, elevations]) => [
        vertexId,
        round(
          elevations.reduce((sum, elevation) => sum + elevation, 0) /
            elevations.length,
        ),
      ]),
    );
    for (const surface of allSurfaces) {
      surface.vertices = surface.vertices.map((vertex) => ({
        ...vertex,
        zM: sharedElevation.get(vertex.vertexId)!,
      }));
    }
  }
  return finish(
    issues.length ? "blocked" : "ready",
    inputHash,
    issues.length ? [] : allSurfaces,
    issues.length ? [] : edges,
    issues,
  );
}

function finish(
  status: AssistedManualSurfaceSubdivisionResultV1["status"],
  inputHash: string,
  surfaces: AssistedManualSubdivisionSurfaceV1[],
  edges: AssistedManualSubdivisionEdgeV1[],
  issues: AssistedManualSubdivisionIssueV1[],
): AssistedManualSurfaceSubdivisionResultV1 {
  return {
    schemaVersion: ASSISTED_MANUAL_SURFACE_SUBDIVISION_VERSION,
    status,
    inputHash,
    surfaces: [...surfaces].sort((a, b) =>
      compareCanonicalStringsV1(a.surfaceId, b.surfaceId),
    ),
    edges,
    issues: [...issues].sort(
      (a, b) =>
        compareCanonicalStringsV1(a.code, b.code) ||
        compareCanonicalStringsV1(
          a.entityRefs.join("\u0000"),
          b.entityRefs.join("\u0000"),
        ),
    ),
  };
}
