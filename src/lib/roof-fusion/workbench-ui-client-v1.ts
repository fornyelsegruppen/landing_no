import type { NorgeIBilderGeoReference } from "@/lib/providers/norge-i-bilder-capture-provider";
import type { AssistedManualRoofGeometryV1 } from "./assisted-manual-roof-geometry-v1";
import type {
  RoofFusionWorkbenchDraftReferenceV1,
  RoofFusionWorkbenchDraftV1,
} from "./workbench-draft-contract-v1";

export type NormalizedWorkbenchPointV1 = { x: number; y: number };
export type NormalizedWorkbenchLineV1 = {
  id: string;
  kind: "ridge" | "valley";
  start: NormalizedWorkbenchPointV1;
  end: NormalizedWorkbenchPointV1;
};

const WORKBENCH_POINT_EPSILON = 1e-10;
export const WORKBENCH_ENDPOINT_SNAP_TOLERANCE_PX = 14;
export const WORKBENCH_BUILDER_ENDPOINT_SNAP_TOLERANCE = 0.005;
export const WORKBENCH_MIN_SKELETON_LENGTH = 0.002;

export type WorkbenchEndpointConstraintMetricV1 = Readonly<{
  xPixelsPerImageUnit: number;
  yPixelsPerImageUnit: number;
  maxDistancePixels: number;
}>;

export class WorkbenchSkeletonEndpointErrorV1 extends Error {
  readonly code = "SKELETON_ENDPOINT_OUTSIDE_MASS";

  constructor() {
    super(
      "SKELETON_ENDPOINT_OUTSIDE_MASS: Kraigo arba sąlajos taškas yra už patvirtinto kontūro. Patikslinkite kontūrą arba pasirinkite tašką jo viduje.",
    );
    this.name = "WorkbenchSkeletonEndpointErrorV1";
  }
}

export class WorkbenchSkeletonZeroLengthErrorV1 extends Error {
  readonly code = "SKELETON_ZERO_LENGTH";

  constructor() {
    super(
      "SKELETON_ZERO_LENGTH: Antras kraigo arba sąlajos taškas turi skirtis nuo pirmojo.",
    );
    this.name = "WorkbenchSkeletonZeroLengthErrorV1";
  }
}

export function assertWorkbenchSkeletonLineLengthV1(
  start: NormalizedWorkbenchPointV1,
  end: NormalizedWorkbenchPointV1,
) {
  if (
    Math.hypot(start.x - end.x, start.y - end.y) <=
    WORKBENCH_MIN_SKELETON_LENGTH
  ) {
    throw new WorkbenchSkeletonZeroLengthErrorV1();
  }
}

function pointOnNormalizedSegmentV1(
  point: NormalizedWorkbenchPointV1,
  from: NormalizedWorkbenchPointV1,
  to: NormalizedWorkbenchPointV1,
) {
  const cross =
    (point.x - from.x) * (to.y - from.y) - (point.y - from.y) * (to.x - from.x);
  if (Math.abs(cross) > WORKBENCH_POINT_EPSILON) return false;
  return (
    point.x >= Math.min(from.x, to.x) - WORKBENCH_POINT_EPSILON &&
    point.x <= Math.max(from.x, to.x) + WORKBENCH_POINT_EPSILON &&
    point.y >= Math.min(from.y, to.y) - WORKBENCH_POINT_EPSILON &&
    point.y <= Math.max(from.y, to.y) + WORKBENCH_POINT_EPSILON
  );
}

export function workbenchPointInOrOnOutlineV1(
  point: NormalizedWorkbenchPointV1,
  outline: readonly NormalizedWorkbenchPointV1[],
) {
  if (outline.length < 3) return false;
  let inside = false;
  for (
    let index = 0, previous = outline.length - 1;
    index < outline.length;
    previous = index++
  ) {
    const currentPoint = outline[index];
    const previousPoint = outline[previous];
    if (pointOnNormalizedSegmentV1(point, previousPoint, currentPoint)) {
      return true;
    }
    if (
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Keeps a manually selected skeleton endpoint valid for its approved roof mass. */
export function constrainWorkbenchPointToOutlineV1(
  point: NormalizedWorkbenchPointV1,
  outline: readonly NormalizedWorkbenchPointV1[],
  // Interactive callers pass a CSS-pixel metric. Omission is reserved for
  // the serializer's tight normalized-coordinate defense before server parse.
  metric: WorkbenchEndpointConstraintMetricV1 = {
    xPixelsPerImageUnit: 1,
    yPixelsPerImageUnit: 1,
    maxDistancePixels: WORKBENCH_BUILDER_ENDPOINT_SNAP_TOLERANCE,
  },
): NormalizedWorkbenchPointV1 {
  if (outline.length < 3) throw new WorkbenchSkeletonEndpointErrorV1();
  const inside = workbenchPointInOrOnOutlineV1(point, outline);
  const xScale =
    Number.isFinite(metric.xPixelsPerImageUnit) &&
    metric.xPixelsPerImageUnit > 0
      ? metric.xPixelsPerImageUnit
      : 1;
  const yScale =
    Number.isFinite(metric.yPixelsPerImageUnit) &&
    metric.yPixelsPerImageUnit > 0
      ? metric.yPixelsPerImageUnit
      : 1;
  const maxDistance =
    Number.isFinite(metric.maxDistancePixels) && metric.maxDistancePixels >= 0
      ? metric.maxDistancePixels
      : 0;
  let closest = outline[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  outline.forEach((from, index) => {
    const to = outline[(index + 1) % outline.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const squaredLength = dx * dx * xScale ** 2 + dy * dy * yScale ** 2;
    const projection =
      squaredLength > 0
        ? Math.max(
            0,
            Math.min(
              1,
              ((point.x - from.x) * dx * xScale ** 2 +
                (point.y - from.y) * dy * yScale ** 2) /
                squaredLength,
            ),
          )
        : 0;
    const candidate = {
      x: from.x + projection * dx,
      y: from.y + projection * dy,
    };
    const distance = Math.hypot(
      (point.x - candidate.x) * xScale,
      (point.y - candidate.y) * yScale,
    );
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  });
  if (closestDistance <= maxDistance) return closest;
  if (inside) return point;
  throw new WorkbenchSkeletonEndpointErrorV1();
}

export function workbenchCalculationBlockersV1(input: {
  trustedOrthophoto: boolean;
  completeHeightSurface: boolean;
  storedDraftHashConfirmed: boolean;
}) {
  return [
    ...(!input.trustedOrthophoto
      ? ["TRUSTED_ORTHOPHOTO_REQUIRED" as const]
      : []),
    ...(!input.completeHeightSurface
      ? ["COMPLETE_HEIGHT_SURFACE_REQUIRED" as const]
      : []),
    ...(!input.storedDraftHashConfirmed
      ? ["STORED_DRAFT_HASH_REQUIRED" as const]
      : []),
  ];
}

type DraftEvidenceV1 = {
  sourceId: string;
  sourceContentHash: string;
  attribution: string;
  imageId?: string | number;
  georeference: NorgeIBilderGeoReference;
};

function projectPoint(
  point: NormalizedWorkbenchPointV1,
  reference: NorgeIBilderGeoReference,
) {
  const width = reference.bounds.maxEastingM - reference.bounds.minEastingM;
  const height = reference.bounds.maxNorthingM - reference.bounds.minNorthingM;
  return {
    xM: reference.bounds.minEastingM + point.x * width,
    // Image Y grows south while EPSG:25833 northing grows north.
    yM: reference.bounds.maxNorthingM - point.y * height,
  };
}

export function normalizeProjectedWorkbenchPointV1(
  point: { xM: number; yM: number },
  reference: NorgeIBilderGeoReference,
): NormalizedWorkbenchPointV1 {
  return {
    x:
      (point.xM - reference.bounds.minEastingM) /
      (reference.bounds.maxEastingM - reference.bounds.minEastingM),
    y:
      (reference.bounds.maxNorthingM - point.yM) /
      (reference.bounds.maxNorthingM - reference.bounds.minNorthingM),
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(
    typeof value === "string"
      ? value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").normalize("NFC")
      : value,
  );
  if (serialized === undefined) throw new TypeError("Cannot hash undefined");
  return serialized;
}

async function canonicalSha256(value: unknown, domain: string) {
  const bytes = new TextEncoder().encode(`${domain}:${canonicalJson(value)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalRing<T>(values: T[], serialize: (value: T) => string) {
  const rotations = (items: T[]) =>
    items.map((_, index) => [...items.slice(index), ...items.slice(0, index)]);
  return [...rotations(values), ...rotations([...values].reverse())].sort(
    (left, right) => {
      const a = left.map(serialize).join("\u0001");
      const b = right.map(serialize).join("\u0001");
      return a < b ? -1 : a > b ? 1 : 0;
    },
  )[0];
}

function canonicalGeometry(geometry: AssistedManualRoofGeometryV1) {
  const result = structuredClone(geometry);
  result.vertices.sort((a, b) => a.vertexId.localeCompare(b.vertexId, "en"));
  result.sourceFootprint.points = canonicalRing(
    result.sourceFootprint.points,
    (point) => `${point.xM}\u0000${point.yM}`,
  );
  result.roofMasses = result.roofMasses.map((mass) => ({
    ...mass,
    vertexIds: canonicalRing(mass.vertexIds, String),
  }));
  result.skeletonEdges = result.skeletonEdges
    .map((edge) => {
      const [fromVertexId, toVertexId] = [
        edge.fromVertexId,
        edge.toVertexId,
      ].sort();
      return { ...edge, fromVertexId, toVertexId };
    })
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId, "en"));
  return result;
}

export async function buildWorkbenchDraftFromUiV1(input: {
  caseId: string;
  actorId: string;
  revision: number;
  supersedes?: RoofFusionWorkbenchDraftReferenceV1 | null;
  draftId: string;
  idempotencyKey: string;
  createdAt: string;
  sourceOutline: readonly NormalizedWorkbenchPointV1[];
  /** Stable provider identity for the footprint (for example OSM way/123). */
  sourceFootprintId?: string;
  approvedOutline: readonly NormalizedWorkbenchPointV1[];
  lines: readonly NormalizedWorkbenchLineV1[];
  evidence: DraftEvidenceV1;
}): Promise<RoofFusionWorkbenchDraftV1> {
  const sourceFootprintPoints = canonicalRing(
    input.sourceOutline.map((point) =>
      projectPoint(point, input.evidence.georeference),
    ),
    (point) => `${point.xM}\u0000${point.yM}`,
  );
  const sourceFootprintContentHash = await canonicalSha256(
    sourceFootprintPoints,
    "takfornyelse:workbench-source-footprint:v1",
  );
  const sourceFootprintId =
    input.sourceFootprintId ??
    `workbench-footprint:${sourceFootprintContentHash.slice(0, 32)}`;
  const outlineVertices = input.approvedOutline.map((point, index) => ({
    vertexId: `outline-v${index + 1}`,
    ...projectPoint(point, input.evidence.georeference),
  }));
  const vertices = [...outlineVertices];
  const endpointId = (
    point: NormalizedWorkbenchPointV1,
    lineIndex: number,
    side: string,
  ) => {
    const projected = projectPoint(point, input.evidence.georeference);
    const existing = vertices.find(
      (vertex) =>
        Math.abs(vertex.xM - projected.xM) < 1e-7 &&
        Math.abs(vertex.yM - projected.yM) < 1e-7,
    );
    if (existing) return existing.vertexId;
    const vertexId = `line${lineIndex + 1}-${side}`;
    vertices.push({ vertexId, ...projected });
    return vertexId;
  };
  const constrainedLines = input.lines.map((line) => ({
    ...line,
    start: constrainWorkbenchPointToOutlineV1(
      line.start,
      input.approvedOutline,
    ),
    end: constrainWorkbenchPointToOutlineV1(line.end, input.approvedOutline),
  }));
  constrainedLines.forEach((line) =>
    assertWorkbenchSkeletonLineLengthV1(line.start, line.end),
  );
  const skeletonEdges = constrainedLines.map((line, index) => ({
    edgeId: `manual-${line.kind}-${index + 1}`,
    roofMassId: "roof-mass-1",
    fromVertexId: endpointId(line.start, index, "from"),
    toVertexId: endpointId(line.end, index, "to"),
    type: line.kind,
    provenance: "manual" as const,
  }));
  const geometry = canonicalGeometry({
    schemaVersion: "assisted-manual-roof-geometry.v1",
    coordinateSystem: {
      kind: "projected_crs",
      reference: "EPSG:25833",
      axisOrder: "easting_northing",
    },
    vertices,
    sourceFootprint: {
      footprintId: "source-footprint-1",
      sourceId: sourceFootprintId,
      sourceContentHash: sourceFootprintContentHash,
      points: sourceFootprintPoints,
    },
    roofMasses: [
      {
        massId: "roof-mass-1",
        outlineId: "approved-outline-1",
        approvedByActorId: input.actorId,
        approvedAt: input.createdAt,
        vertexIds: outlineVertices.map((vertex) => vertex.vertexId),
      },
    ],
    skeletonEdges,
    // The current UAT canvas has no safe polygon ownership editor for these.
    // Empty is honest; future UI must add explicit mass ownership before use.
    openings: [],
    obstacles: [],
  });
  const geometryHash = await canonicalSha256(
    geometry,
    "takfornyelse:assisted-manual-roof-geometry:v1",
  );
  const withoutDraftHash = {
    schemaVersion: "roof-fusion-workbench-draft.v1" as const,
    draftId: input.draftId,
    caseId: input.caseId,
    revision: input.revision,
    ...(input.supersedes
      ? { supersedesDraftId: input.supersedes.draftId }
      : {}),
    idempotencyKey: input.idempotencyKey,
    geometryHash,
    state: "review_required" as const,
    actor: { actorId: input.actorId, actorType: "administrator" as const },
    createdAt: input.createdAt,
    source: {
      sourceId: input.evidence.sourceId,
      sourceContentHash: input.evidence.sourceContentHash,
      attribution: input.evidence.attribution,
      ...(input.evidence.imageId !== undefined
        ? { imageId: input.evidence.imageId }
        : {}),
      georeference: input.evidence.georeference,
    },
    geometry,
    blockers: skeletonEdges.length
      ? [
          "Sudėtingas skaidymas ir plokštumų / kliūčių priklausomybė turi būti peržiūrėta; sistema jos nespėja.",
        ]
      : [],
  };
  const draftHash = await canonicalSha256(
    withoutDraftHash,
    "takfornyelse:roof-fusion-workbench-draft:v1",
  );
  return { ...withoutDraftHash, draftHash };
}

export class WorkbenchUiApiErrorV1 extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WorkbenchUiApiErrorV1";
  }
}

async function responseJson(response: Response) {
  return (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
}

type WorkbenchTransportOperationV1 = "load" | "save";

function transportFailure(
  operation: WorkbenchTransportOperationV1,
  error: unknown,
) {
  if (error instanceof WorkbenchUiApiErrorV1) return error;
  const errorName =
    error instanceof Error
      ? error.name
      : typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";
  const timedOut = errorName === "AbortError" || errorName === "TimeoutError";
  const code = `${operation.toUpperCase()}_${timedOut ? "TIMEOUT" : "CONNECTION_FAILED"}`;
  const message =
    operation === "save"
      ? timedOut
        ? "Revizijos išsaugojimas užtruko per ilgai. Išsaugojimas nepatvirtintas; patikrinkite ryšį ir dar kartą spauskite „Išsaugoti ir patvirtinti reviziją“."
        : "Nepavyko prisijungti prie serverio išsaugant reviziją. Išsaugojimas nepatvirtintas; patikrinkite ryšį ir dar kartą spauskite „Išsaugoti ir patvirtinti reviziją“."
      : timedOut
        ? "Revizijos įkėlimas užtruko per ilgai. Patikrinkite ryšį ir spauskite „Perkrauti“."
        : "Nepavyko prisijungti prie serverio įkeliant reviziją. Patikrinkite interneto ryšį ir spauskite „Perkrauti“.";
  return new WorkbenchUiApiErrorV1(code, 0, message);
}

async function fetchWorkbenchV1(
  fetcher: typeof fetch,
  operation: WorkbenchTransportOperationV1,
  input: string,
  init?: RequestInit,
) {
  try {
    return await fetcher(input, init);
  } catch (error) {
    throw transportFailure(operation, error);
  }
}

export async function loadWorkbenchDraftV1(
  caseId: string,
  fetcher: typeof fetch = fetch,
  draftId?: string,
): Promise<RoofFusionWorkbenchDraftV1 | null> {
  const query = new URLSearchParams({ caseId });
  if (draftId) query.set("draftId", draftId);
  const response = await fetchWorkbenchV1(
    fetcher,
    "load",
    `/api/admin/roof-fusion/workbench-draft?${query}`,
  );
  const body = await responseJson(response);
  if (response.status === 404 && body?.code === "DRAFT_NOT_FOUND") return null;
  if (!response.ok) {
    throw new WorkbenchUiApiErrorV1(
      String(body?.code ?? "LOAD_FAILED"),
      response.status,
      String(body?.error ?? "Juodraščio nepavyko įkelti"),
    );
  }
  return body?.draft as RoofFusionWorkbenchDraftV1;
}

export async function persistAndReloadWorkbenchDraftV1(
  draft: RoofFusionWorkbenchDraftV1,
  expectedLatest: RoofFusionWorkbenchDraftReferenceV1 | null,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetchWorkbenchV1(
    fetcher,
    "save",
    "/api/admin/roof-fusion/workbench-draft",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft, expectedLatest }),
    },
  );
  const body = await responseJson(response);
  if (!response.ok) {
    throw new WorkbenchUiApiErrorV1(
      String(body?.code ?? "SAVE_FAILED"),
      response.status,
      String(body?.error ?? "Juodraščio nepavyko išsaugoti"),
    );
  }
  const reloaded = await loadWorkbenchDraftV1(
    draft.caseId,
    fetcher,
    draft.draftId,
  );
  if (!reloaded || reloaded.draftHash !== draft.draftHash) {
    throw new WorkbenchUiApiErrorV1(
      "RELOAD_MISMATCH",
      409,
      "Išsaugoto juodraščio kontrolinis hash nebuvo patvirtintas pakartotiniu įkėlimu",
    );
  }
  return {
    status: body?.status as "applied" | "replayed",
    confirmation: body?.confirmation,
    draft: reloaded,
  };
}
