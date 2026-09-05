import { z } from "zod";
import {
  canonicalSha256V1,
  canonicalizeJsonValueV1,
} from "./canonicalization-v1";
import {
  approvedRoofRendererPayloadV1,
  parseRoofSnapshotV1,
  type RoofMeasurementValueV1,
  type RoofSnapshotV1,
} from "./roof-snapshot-v1";

export const ROOF_FUSION_OFFER_BRIDGE_REQUEST_VERSION =
  "roof-fusion-offer-bridge-request.v1" as const;
export const ROOF_FUSION_OFFER_BRIDGE_RESULT_VERSION =
  "roof-fusion-offer-bridge-result.v1" as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);

export const roofFusionOfferBridgeRequestV1Schema = z
  .object({
    schemaVersion: z.literal(ROOF_FUSION_OFFER_BRIDGE_REQUEST_VERSION),
    caseId: identifier,
    expectedCaseRevision: z.number().int().positive(),
    expectedAddressRevision: z.number().int().positive(),
    snapshot: z
      .object({
        snapshotId: identifier,
        revision: z.number().int().positive(),
        snapshotHash: sha256,
        inputHash: sha256,
        renderHash: sha256,
      })
      .strict(),
    idempotencyKey: z.string().trim().min(8).max(300),
    exceptionReason: z.string().trim().min(10).max(1_000).optional(),
  })
  .strict();

export type RoofFusionOfferBridgeRequestV1 = z.infer<
  typeof roofFusionOfferBridgeRequestV1Schema
>;

export const roofFusionOfferBridgeResultV1Schema = z
  .object({
    schemaVersion: z.literal(ROOF_FUSION_OFFER_BRIDGE_RESULT_VERSION),
    status: z.enum(["applied", "replayed"]),
    caseId: identifier,
    snapshot: z
      .object({
        snapshotId: identifier,
        revision: z.number().int().positive(),
        snapshotHash: sha256,
        inputHash: sha256,
        renderHash: sha256,
      })
      .strict(),
    measurement: z
      .object({
        id: z.number().int().positive(),
        version: z.number().int().positive(),
        inputHash: sha256,
      })
      .strict(),
    quote: z
      .object({ id: z.number().int().positive(), version: z.number().int().positive() })
      .strict(),
    contractId: z.number().int().positive(),
    customerSideEffects: z.literal("none"),
    offerHref: z.string().startsWith("/"),
  })
  .strict();

export type RoofFusionOfferBridgeResultV1 = z.infer<
  typeof roofFusionOfferBridgeResultV1Schema
>;

export type RoofFusionOfferBridgeErrorCodeV1 =
  | "PREVIEW_REQUIRED"
  | "MUTATION_DISABLED"
  | "INVALID_REQUEST"
  | "CASE_MISMATCH"
  | "CASE_REVISION_CONFLICT"
  | "ADDRESS_REVISION_CONFLICT"
  | "SNAPSHOT_NOT_FOUND"
  | "STALE_SNAPSHOT"
  | "STALE_SNAPSHOT_HASH"
  | "INPUT_HASH_MISMATCH"
  | "RENDER_HASH_MISMATCH"
  | "SOURCE_NOT_AUTHORIZED"
  | "QUALITY_BLOCKED"
  | "REVIEW_REASON_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "PACKAGE_CONFLICT"
  | "REPOSITORY_INTEGRITY";

const httpStatusByCode: Record<RoofFusionOfferBridgeErrorCodeV1, number> = {
  PREVIEW_REQUIRED: 404,
  MUTATION_DISABLED: 404,
  INVALID_REQUEST: 400,
  CASE_MISMATCH: 403,
  CASE_REVISION_CONFLICT: 409,
  ADDRESS_REVISION_CONFLICT: 409,
  SNAPSHOT_NOT_FOUND: 404,
  STALE_SNAPSHOT: 409,
  STALE_SNAPSHOT_HASH: 409,
  INPUT_HASH_MISMATCH: 409,
  RENDER_HASH_MISMATCH: 409,
  SOURCE_NOT_AUTHORIZED: 422,
  QUALITY_BLOCKED: 422,
  REVIEW_REASON_REQUIRED: 422,
  IDEMPOTENCY_CONFLICT: 409,
  PACKAGE_CONFLICT: 409,
  REPOSITORY_INTEGRITY: 500,
};

export class RoofFusionOfferBridgeErrorV1 extends Error {
  readonly schemaVersion = "roof-fusion-offer-bridge-error.v1" as const;
  readonly suggestedHttpStatus: number;

  constructor(
    readonly code: RoofFusionOfferBridgeErrorCodeV1,
    message: string,
    readonly entityRefs: readonly string[] = [],
  ) {
    super(message);
    this.name = "RoofFusionOfferBridgeErrorV1";
    this.suggestedHttpStatus = httpStatusByCode[code];
  }
}

export function assertRoofFusionOfferBridgePreviewEnabledV1(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  // Production is rejected first and can never be opened by a feature flag.
  if (environment.VERCEL_ENV !== "preview") {
    throw new RoofFusionOfferBridgeErrorV1(
      "PREVIEW_REQUIRED",
      "The Roof Fusion offer bridge is restricted to Preview",
    );
  }
  if (
    environment.ADMIN_NEXT_MODE?.trim().toLowerCase() !== "preview" ||
    environment.FEATURE_ROOF_FUSION_V1 !== "true" ||
    environment.FEATURE_ADMIN_NEXT_RF_OFFER_BRIDGE !== "true"
  ) {
    throw new RoofFusionOfferBridgeErrorV1(
      "MUTATION_DISABLED",
      "The Preview Roof Fusion offer bridge is disabled",
    );
  }
}

export function parseRoofFusionOfferBridgeRequestV1(input: unknown) {
  try {
    return roofFusionOfferBridgeRequestV1Schema.parse(
      canonicalizeJsonValueV1(input),
    );
  } catch (error) {
    throw new RoofFusionOfferBridgeErrorV1(
      "INVALID_REQUEST",
      error instanceof Error ? error.message : "Invalid offer bridge request",
    );
  }
}

export function roofFusionOfferBridgeCommandHashV1(
  request: RoofFusionOfferBridgeRequestV1,
) {
  return canonicalSha256V1(
    canonicalizeJsonValueV1(request),
    "takfornyelse:roof-fusion-offer-bridge-request:v1",
  );
}

export function roofFusionOfferBridgeBindingHashV1(
  request: RoofFusionOfferBridgeRequestV1,
) {
  const {
    exceptionReason: _exceptionReason,
    idempotencyKey: _idempotencyKey,
    ...binding
  } = request;
  void _exceptionReason;
  void _idempotencyKey;
  return canonicalSha256V1(
    canonicalizeJsonValueV1(binding),
    "takfornyelse:roof-fusion-offer-bridge-binding:v1",
  );
}

function areaTenths(value: RoofMeasurementValueV1, boundary: "min" | "max") {
  const amount = boundary === "min" ? value.min : value.max;
  if (amount === null || !Number.isFinite(amount)) {
    throw new RoofFusionOfferBridgeErrorV1(
      "QUALITY_BLOCKED",
      "The approved Roof Fusion snapshot does not contain a usable area",
    );
  }
  return Math.round(amount * 10);
}

export function assertRoofFusionOfferBridgeBindingV1(input: {
  request: RoofFusionOfferBridgeRequestV1;
  snapshot: RoofSnapshotV1;
  latestSnapshot: RoofSnapshotV1;
  caseRevision: number;
  addressRevision: number;
}) {
  const request = parseRoofFusionOfferBridgeRequestV1(input.request);
  const snapshot = parseRoofSnapshotV1(input.snapshot);
  const latest = parseRoofSnapshotV1(input.latestSnapshot);
  if (snapshot.subject.caseId !== request.caseId) {
    throw new RoofFusionOfferBridgeErrorV1(
      "CASE_MISMATCH",
      "The reviewed snapshot belongs to another case",
      [snapshot.subject.caseId, request.caseId],
    );
  }
  if (input.caseRevision !== request.expectedCaseRevision) {
    throw new RoofFusionOfferBridgeErrorV1(
      "CASE_REVISION_CONFLICT",
      "The case changed after the Roof Fusion result was reviewed",
      [request.caseId],
    );
  }
  if (input.addressRevision !== request.expectedAddressRevision) {
    throw new RoofFusionOfferBridgeErrorV1(
      "ADDRESS_REVISION_CONFLICT",
      "The case address changed after the Roof Fusion result was reviewed",
      [request.caseId],
    );
  }
  if (
    latest.snapshotId !== snapshot.snapshotId ||
    latest.revision !== snapshot.revision
  ) {
    throw new RoofFusionOfferBridgeErrorV1(
      "STALE_SNAPSHOT",
      "A newer Roof Fusion snapshot exists for this case",
      [snapshot.snapshotId, latest.snapshotId],
    );
  }
  if (
    request.snapshot.snapshotId !== snapshot.snapshotId ||
    request.snapshot.revision !== snapshot.revision ||
    request.snapshot.snapshotHash !== snapshot.snapshotHash
  ) {
    throw new RoofFusionOfferBridgeErrorV1(
      "STALE_SNAPSHOT_HASH",
      "The Roof Fusion snapshot identity or hash changed after review",
      [request.snapshot.snapshotId, snapshot.snapshotId],
    );
  }
  if (request.snapshot.inputHash !== snapshot.inputHash) {
    throw new RoofFusionOfferBridgeErrorV1(
      "INPUT_HASH_MISMATCH",
      "The Roof Fusion input hash changed after review",
      [snapshot.snapshotId],
    );
  }
  if (request.snapshot.renderHash !== snapshot.rendererPayload.renderHash) {
    throw new RoofFusionOfferBridgeErrorV1(
      "RENDER_HASH_MISMATCH",
      "The Roof Fusion renderer hash changed after review",
      [snapshot.snapshotId],
    );
  }
  if (snapshot.processing.status !== "complete" || snapshot.quality.status === "fail") {
    throw new RoofFusionOfferBridgeErrorV1(
      "QUALITY_BLOCKED",
      "Blocked or incomplete Roof Fusion results cannot reach an offer",
      [snapshot.snapshotId],
    );
  }
  const unauthorized = snapshot.provenance.sources.filter(
    (source) => source.license.status !== "authorized",
  );
  if (unauthorized.length) {
    throw new RoofFusionOfferBridgeErrorV1(
      "SOURCE_NOT_AUTHORIZED",
      "Every Roof Fusion source must be authorized before offer use",
      unauthorized.map((source) => source.sourceId),
    );
  }
  if (
    (snapshot.quality.status === "review_required" ||
      ["low", "unknown"].includes(snapshot.measurement.confidence.level) ||
      snapshot.manualCorrections.length > 0) &&
    !request.exceptionReason &&
    !snapshot.approval.reviewReason
  ) {
    throw new RoofFusionOfferBridgeErrorV1(
      "REVIEW_REASON_REQUIRED",
      "A review reason is required for a low-confidence or corrected result",
      [snapshot.snapshotId],
    );
  }
  return { request, snapshot, latest } as const;
}

export function projectApprovedRoofFusionMeasurementV1(input: {
  snapshot: RoofSnapshotV1;
  leadId: number;
  version: number;
  supersedes?: number;
  normalizedAddress: string;
  caseRevision: number;
  addressRevision: number;
  approvedBy: number;
}) {
  const snapshot = parseRoofSnapshotV1(input.snapshot);
  const envelope = approvedRoofRendererPayloadV1(
    snapshot,
    snapshot.snapshotHash,
  );
  const horizontalAreaTenths = areaTenths(
    snapshot.totals.grossHorizontalArea,
    "max",
  );
  const actualAreaMinTenths = areaTenths(
    snapshot.totals.netSurfaceArea,
    "min",
  );
  const actualAreaMaxTenths = areaTenths(
    snapshot.totals.netSurfaceArea,
    "max",
  );
  const sourceAttribution = [
    ...new Set(
      snapshot.provenance.sources.map((source) => source.license.attribution),
    ),
  ].join(" · ");
  const sourceNames = [
    ...new Set(snapshot.provenance.sources.map((source) => source.provider)),
  ].join(" + ");
  const inputHash = canonicalSha256V1(
    canonicalizeJsonValueV1({
      addressRevision: input.addressRevision,
      caseId: snapshot.subject.caseId,
      caseRevision: input.caseRevision,
      rendererHash: envelope.payload.renderHash,
      snapshotHash: snapshot.snapshotHash,
      sourceInputHash: snapshot.inputHash,
    }),
    "takfornyelse:roof-fusion-measurement-projection:v1",
  );
  const approvedAt = snapshot.approval.approvedAt!;

  return {
    reference: `RF-${input.leadId}-V${input.version}`,
    lead: input.leadId,
    version: input.version,
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    measurementMode: "schematic_with_context" as const,
    normalizedAddress: input.normalizedAddress,
    addressSourceId:
      snapshot.provenance.sources.find((source) => source.kind === "address_anchor")
        ?.sourceId ?? `case-address:${input.leadId}:r${input.addressRevision}`,
    latitude: snapshot.coordinateSystem.origin?.latitude,
    longitude: snapshot.coordinateSystem.origin?.longitude,
    buildingIdentifier: snapshot.subject.propertyId,
    source: sourceNames || "Roof Fusion",
    license: "Per-source licenses retained in the immutable Roof Fusion snapshot",
    credits: sourceAttribution || "Roof Fusion source attribution",
    imageryLicensed: true,
    capturedAt: snapshot.generatedAt,
    roofPlanes: envelope.payload.surfaces,
    horizontalAreaTenths,
    actualAreaMinTenths,
    actualAreaMaxTenths,
    calculationSnapshot: {
      schemaVersion: "roof-fusion-measurement-projection.v1",
      snapshotId: snapshot.snapshotId,
      snapshotRevision: snapshot.revision,
      snapshotHash: snapshot.snapshotHash,
      sourceInputHash: snapshot.inputHash,
      rendererHash: envelope.payload.renderHash,
      totals: envelope.payload.totals,
    },
    inputHash,
    confidence:
      snapshot.measurement.confidence.level === "unknown"
        ? ("low" as const)
        : snapshot.measurement.confidence.level,
    confidenceReasoning: snapshot.measurement.confidence.rationale,
    status: "approved" as const,
    blockingReasons: [],
    approvedBy: input.approvedBy,
    approvedAt,
    selectionConfirmedBy: input.approvedBy,
    selectionConfirmedAt: approvedAt,
    caseRevision: input.caseRevision,
    addressRevision: input.addressRevision,
    rfSnapshotId: snapshot.snapshotId,
    rfSnapshotRevision: snapshot.revision,
    rfSnapshotHash: snapshot.snapshotHash,
    rfInputHash: snapshot.inputHash,
    rfRendererHash: envelope.payload.renderHash,
    sourceKind: "roof_fusion" as const,
  };
}
