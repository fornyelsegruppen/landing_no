import { createHash } from "node:crypto";
import { z } from "zod";
import {
  buildRoofSnapshotV1,
  canonicalRoofGeometryV1,
  roofSnapshotV1SeedSchema,
  type RoofSnapshotSeedV1,
  type RoofSnapshotV1,
} from "./roof-snapshot-v1";

export const ROOF_SOURCE_REQUEST_SCHEMA_VERSION =
  "roof-source-request.v1" as const;
export const ROOF_SOURCE_RESULT_SCHEMA_VERSION =
  "roof-source-result.v1" as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const timestamp = z.string().datetime({ offset: true });

type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.null(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const sourceIssueSchema = z
  .object({
    code: z.string().trim().min(1).max(120),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().trim().min(1).max(1_000),
    retryable: z.boolean(),
    sourceRef: identifier.optional(),
  })
  .strict();

const roofSourceRequestCoreSchema = z
  .object({
    schemaVersion: z.literal(ROOF_SOURCE_REQUEST_SCHEMA_VERSION),
    requestId: identifier,
    caseId: identifier,
    targetSnapshotId: identifier,
    expectedInputVersion: z.string().trim().min(1).max(120),
    adapterId: identifier,
    idempotencyKey: z.string().trim().min(8).max(300),
    requestedAt: timestamp,
    input: jsonValueSchema,
  })
  .strict();

export const roofSourceRequestV1Schema = roofSourceRequestCoreSchema
  .extend({
    inputHash: sha256,
  })
  .strict();

const normalizedSourceContentSchema = roofSnapshotV1SeedSchema.pick({
  coordinateSystem: true,
  geometry: true,
  provenance: true,
  measurement: true,
});

const sourceRecordsSchema =
  roofSnapshotV1SeedSchema.shape.provenance.shape.sources;

export const roofSourceResultV1Schema = z
  .object({
    schemaVersion: z.literal(ROOF_SOURCE_RESULT_SCHEMA_VERSION),
    status: z.enum([
      "complete",
      "partial",
      "empty",
      "failed",
      "unknown_version",
    ]),
    adapterId: identifier,
    adapterVersion: z.string().trim().min(1).max(120),
    provider: z.string().trim().min(1).max(160),
    providerInputVersion: z.string().trim().min(1).max(120),
    providerRequestId: z.string().trim().min(1).max(500).optional(),
    requestInputHash: sha256,
    idempotencyKey: z.string().trim().min(8).max(300),
    receivedAt: timestamp,
    rawContentHash: sha256,
    sourceRecords: sourceRecordsSchema,
    issues: z.array(sourceIssueSchema).max(500),
    normalized: normalizedSourceContentSchema.optional(),
    normalizedContentHash: sha256.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (["complete", "partial"].includes(value.status) && !value.normalized) {
      context.addIssue({
        code: "custom",
        message: `${value.status} source result requires normalized content`,
        path: ["normalized"],
      });
    }
    if (value.normalized && !value.normalizedContentHash) {
      context.addIssue({
        code: "custom",
        message: "Normalized source content requires a content hash",
        path: ["normalizedContentHash"],
      });
    }
    if (!value.normalized && value.normalizedContentHash) {
      context.addIssue({
        code: "custom",
        message:
          "A normalized content hash cannot exist without normalized content",
        path: ["normalizedContentHash"],
      });
    }
  });

export type RoofSourceRequestV1 = z.infer<typeof roofSourceRequestV1Schema>;
export type RoofSourceResultV1 = z.infer<typeof roofSourceResultV1Schema>;

export interface RoofSourceAdapterV1 {
  readonly adapterId: string;
  readonly adapterVersion: string;
  ingest(request: RoofSourceRequestV1): Promise<unknown>;
}

export class UnsupportedRoofSourceResultVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`Unsupported roof source result version: ${String(version)}`);
    this.name = "UnsupportedRoofSourceResultVersionError";
  }
}

export class RoofSourceIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoofSourceIntegrityError";
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(domain: string, value: unknown) {
  return createHash("sha256")
    .update(`${domain}:${canonicalJson(value)}`)
    .digest("hex");
}

export function roofSourceInputHashV1(
  request: Omit<RoofSourceRequestV1, "inputHash">,
) {
  return digest("takfornyelse:roof-source-request:v1", {
    schemaVersion: request.schemaVersion,
    caseId: request.caseId,
    targetSnapshotId: request.targetSnapshotId,
    expectedInputVersion: request.expectedInputVersion,
    adapterId: request.adapterId,
    input: request.input,
  });
}

export function buildRoofSourceRequestV1(
  request: Omit<RoofSourceRequestV1, "inputHash">,
): RoofSourceRequestV1 {
  const parsed = roofSourceRequestCoreSchema.parse(request);
  return roofSourceRequestV1Schema.parse({
    ...parsed,
    inputHash: roofSourceInputHashV1(parsed),
  });
}

export function roofSourceNormalizedHashV1(
  normalized: NonNullable<RoofSourceResultV1["normalized"]>,
) {
  return digest(
    "takfornyelse:roof-source-normalized:v1",
    canonicalNormalizedContent(normalized),
  );
}

function canonicalNormalizedContent(
  normalized: NonNullable<RoofSourceResultV1["normalized"]>,
) {
  const value = JSON.parse(JSON.stringify(normalized)) as typeof normalized;
  value.geometry = canonicalRoofGeometryV1(value.geometry);
  value.provenance.sources.sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId),
  );
  value.provenance.observations.sort((left, right) =>
    left.observationId.localeCompare(right.observationId),
  );
  const uniqueSorted = (items: string[]) => [...new Set(items)].sort();
  value.provenance.fusionDecision.acceptedObservationIds = uniqueSorted(
    value.provenance.fusionDecision.acceptedObservationIds,
  );
  value.provenance.fusionDecision.rejectedObservationIds = uniqueSorted(
    value.provenance.fusionDecision.rejectedObservationIds,
  );
  value.provenance.fusionDecision.conflictedObservationIds = uniqueSorted(
    value.provenance.fusionDecision.conflictedObservationIds,
  );
  return value;
}

export function buildRoofSourceResultV1(
  result: Omit<RoofSourceResultV1, "normalizedContentHash"> & {
    normalizedContentHash?: string;
  },
): RoofSourceResultV1 {
  const normalized = result.normalized
    ? canonicalNormalizedContent(result.normalized)
    : undefined;
  return roofSourceResultV1Schema.parse({
    ...result,
    normalized,
    normalizedContentHash: normalized
      ? roofSourceNormalizedHashV1(normalized)
      : undefined,
  });
}

export async function ingestRoofSourceV1(
  adapter: RoofSourceAdapterV1,
  requestInput: RoofSourceRequestV1,
): Promise<RoofSourceResultV1> {
  const request = roofSourceRequestV1Schema.parse(requestInput);
  if (roofSourceInputHashV1(request) !== request.inputHash) {
    throw new RoofSourceIntegrityError(
      "Roof source request input hash mismatch",
    );
  }
  if (request.adapterId !== adapter.adapterId) {
    throw new RoofSourceIntegrityError(
      "Roof source request targets a different adapter",
    );
  }
  const raw = await adapter.ingest(request);
  const version =
    raw && typeof raw === "object"
      ? (raw as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (version !== ROOF_SOURCE_RESULT_SCHEMA_VERSION) {
    throw new UnsupportedRoofSourceResultVersionError(version);
  }
  const result = roofSourceResultV1Schema.parse(raw);
  if (
    result.adapterId !== adapter.adapterId ||
    result.adapterVersion !== adapter.adapterVersion
  ) {
    throw new RoofSourceIntegrityError("Roof source adapter identity mismatch");
  }
  if (
    result.requestInputHash !== request.inputHash ||
    result.idempotencyKey !== request.idempotencyKey
  ) {
    throw new RoofSourceIntegrityError(
      "Roof source result does not belong to the requested idempotent input",
    );
  }
  if (
    result.normalized &&
    roofSourceNormalizedHashV1(result.normalized) !==
      result.normalizedContentHash
  ) {
    throw new RoofSourceIntegrityError(
      "Normalized roof source content hash mismatch",
    );
  }
  const normalizedSourceIds = new Set(
    result.normalized?.provenance.sources.map((source) => source.sourceId) ??
      [],
  );
  if (
    result.normalized &&
    result.sourceRecords.some(
      (source) => !normalizedSourceIds.has(source.sourceId),
    )
  ) {
    throw new RoofSourceIntegrityError(
      "Normalized roof source omitted declared provenance",
    );
  }
  return result;
}

export class FakeRoofSourceAdapterV1 implements RoofSourceAdapterV1 {
  readonly calls: RoofSourceRequestV1[] = [];

  constructor(
    readonly adapterId: string,
    readonly adapterVersion: string,
    private readonly result:
      | RoofSourceResultV1
      | ((request: RoofSourceRequestV1) => RoofSourceResultV1),
  ) {}

  async ingest(request: RoofSourceRequestV1) {
    this.calls.push(request);
    const result =
      typeof this.result === "function" ? this.result(request) : this.result;
    return JSON.parse(JSON.stringify(result)) as RoofSourceResultV1;
  }
}

export type RoofSourceSnapshotMetadataV1 = {
  snapshotId: string;
  revision: number;
  supersedesSnapshotId?: string;
  caseId: string;
  propertyId?: string;
  legacyMeasurementId?: string | number;
  inputVersion: string;
  engineVersion: string;
  rendererVersion: string;
  generatedAt: string;
  normalizedBy: RoofSnapshotV1["auditTrail"][number]["actor"];
};

function fallbackNormalizedContent(
  result: RoofSourceResultV1,
  metadata: RoofSourceSnapshotMetadataV1,
): NonNullable<RoofSourceResultV1["normalized"]> {
  return {
    coordinateSystem: {
      kind: "local_cartesian",
      reference: "unresolved-local-frame",
      axisOrder: "x_east_y_north_z_up",
    },
    geometry: {
      vertices: [],
      contours: [],
      surfaces: [],
      edges: [],
      openings: [],
      obstacles: [],
    },
    provenance: {
      sources: result.sourceRecords,
      observations: [],
      fusionDecision: {
        decisionId: `fusion-${metadata.snapshotId}`,
        policyVersion: "roof-fusion-policy.v1",
        acceptedObservationIds: [],
        rejectedObservationIds: [],
        conflictedObservationIds: [],
        decidedAt: metadata.generatedAt,
        decidedBy: metadata.normalizedBy,
        rationale:
          "No normalized geometry was available from the provider result",
      },
    },
    measurement: {
      method: "unknown",
      class: "preliminary",
      confidence: {
        level: "unknown",
        score: null,
        basis: "unknown",
        rationale: "Provider did not return supported geometry",
      },
    },
  };
}

function processingStatus(
  status: RoofSourceResultV1["status"],
): RoofSnapshotSeedV1["processing"]["status"] {
  if (status === "complete") return "complete";
  if (status === "partial" || status === "empty") return "partial";
  if (status === "failed") return "error";
  return "unknown";
}

export function roofSourceResultToSnapshotV1(
  requestInput: RoofSourceRequestV1,
  resultInput: RoofSourceResultV1,
  metadata: RoofSourceSnapshotMetadataV1,
) {
  const request = roofSourceRequestV1Schema.parse(requestInput);
  const result = roofSourceResultV1Schema.parse(resultInput);
  if (
    result.requestInputHash !== request.inputHash ||
    result.idempotencyKey !== request.idempotencyKey
  ) {
    throw new RoofSourceIntegrityError(
      "Cannot normalize a roof source result for a different request",
    );
  }
  const normalized =
    result.normalized ?? fallbackNormalizedContent(result, metadata);
  const processing = processingStatus(result.status);
  const state: RoofSnapshotSeedV1["state"] =
    processing === "error" || processing === "unknown"
      ? "blocked"
      : "review_required";
  return buildRoofSnapshotV1({
    schemaVersion: "roof-snapshot.v1",
    snapshotId: metadata.snapshotId,
    revision: metadata.revision,
    supersedesSnapshotId: metadata.supersedesSnapshotId,
    subject: {
      caseId: metadata.caseId,
      propertyId: metadata.propertyId,
      legacyMeasurementId: metadata.legacyMeasurementId,
    },
    inputVersion: metadata.inputVersion,
    engineVersion: metadata.engineVersion,
    rendererVersion: metadata.rendererVersion,
    inputHash: request.inputHash,
    generatedAt: metadata.generatedAt,
    state,
    processing: {
      status: processing,
      issues: result.issues,
    },
    units: {
      length: "m",
      area: "m2",
      angle: "deg",
      coordinates: "m",
      precision: {
        lengthDecimals: 3,
        areaDecimals: 3,
        angleDecimals: 2,
      },
    },
    coordinateSystem: normalized.coordinateSystem,
    geometry: normalized.geometry,
    provenance: normalized.provenance,
    measurement: normalized.measurement,
    manualCorrections: [],
    approval: { status: "pending" },
    auditTrail: [
      {
        sequence: 1,
        eventType: "source_ingested",
        occurredAt: result.receivedAt,
        actor: metadata.normalizedBy,
        idempotencyKey: request.idempotencyKey,
        details: {
          adapterId: result.adapterId,
          adapterVersion: result.adapterVersion,
          provider: result.provider,
          providerInputVersion: result.providerInputVersion,
          sourceStatus: result.status,
        },
      },
      {
        sequence: 2,
        eventType: "source_normalized",
        occurredAt: metadata.generatedAt,
        actor: metadata.normalizedBy,
        details: {
          normalizedContentHash:
            result.normalizedContentHash ?? result.rawContentHash,
        },
      },
      {
        sequence: 3,
        eventType: "quality_evaluated",
        occurredAt: metadata.generatedAt,
        actor: metadata.normalizedBy,
        details: { processingStatus: processing },
      },
    ],
  });
}
