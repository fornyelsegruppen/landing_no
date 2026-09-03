import { z } from "zod";
import type { KartverketHeightSurfaceV1 } from "@/lib/providers/kartverket-hoydedata-provider";
import type { NorgeIBilderGeoReference } from "@/lib/providers/norge-i-bilder-capture-provider";
import {
  adaptAssistedManualRoofGeometryToSnapshotV1,
  ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION,
} from "./assisted-manual-height-adapter-v1";
import {
  parseRoofFusionWorkbenchDraftV1,
  type RoofFusionWorkbenchDraftV1,
} from "./workbench-draft-contract-v1";
import { canonicalSha256V1 } from "./canonicalization-v1";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);

const heightSurfaceGateSchema = z
  .object({
    schemaVersion: z.literal("kartverket-height-surface.v1"),
    coordinateSystem: z.literal("EPSG:25833"),
    bbox: z
      .object({
        minEastingM: z.number().finite(),
        minNorthingM: z.number().finite(),
        maxEastingM: z.number().finite(),
        maxNorthingM: z.number().finite(),
      })
      .strict(),
    grid: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        cellWidthM: z.number().positive(),
        cellHeightM: z.number().positive(),
        rowOrder: z.literal("north_to_south"),
      })
      .strict(),
    values: z
      .object({
        domElevationM: z.array(z.number().finite().nullable()),
        dtmElevationM: z.array(z.number().finite().nullable()),
        heightAboveTerrainM: z.array(z.number().finite().nullable()),
      })
      .strict(),
    provenance: z
      .object({
        domContentSha256: sha256,
        dtmContentSha256: sha256,
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (
      value.bbox.maxEastingM <= value.bbox.minEastingM ||
      value.bbox.maxNorthingM <= value.bbox.minNorthingM
    ) {
      context.addIssue({
        code: "custom",
        message: "Height surface bounds are invalid",
      });
    }
    const expected = value.grid.width * value.grid.height;
    for (const key of [
      "domElevationM",
      "dtmElevationM",
      "heightAboveTerrainM",
    ] as const) {
      if (value.values[key].length !== expected) {
        context.addIssue({
          code: "custom",
          message: `Height surface ${key} does not match its grid`,
        });
      }
    }
  });

const orthophotoGateSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(160),
    rawContentHash: sha256,
    capturedAt: z.string().datetime({ offset: true }),
    attribution: z.string().trim().min(1).max(500),
    provider: z.string().trim().min(1).max(160).optional(),
    providerObjectId: z.string().trim().min(1).max(500).optional(),
    geoReference: z
      .object({
        crs: z.literal("EPSG:25833"),
        extentTrust: z.literal("actual-visible-extent"),
        bounds: z
          .object({
            minEastingM: z.number().finite(),
            minNorthingM: z.number().finite(),
            maxEastingM: z.number().finite(),
            maxNorthingM: z.number().finite(),
          })
          .strict(),
        imageWidth: z.number().int().positive(),
        imageHeight: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export class RoofFusionWorkbenchHeightAdapterErrorV1 extends Error {
  constructor(
    readonly code: "TRUSTED_INPUT_REQUIRED" | "DRAFT_SOURCE_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "RoofFusionWorkbenchHeightAdapterErrorV1";
  }
}

/**
 * Re-identifies only legacy drafts that used the orthophoto capture identity
 * for the independently sourced footprint. The persisted revision and hash
 * remain untouched; calculation provenance receives a deterministic identity
 * for the exact stored footprint coordinates.
 */
function calculationGeometryV1(draft: RoofFusionWorkbenchDraftV1) {
  const footprint = draft.geometry.sourceFootprint;
  if (
    footprint.sourceId !== draft.source.sourceId &&
    footprint.sourceContentHash !== draft.source.sourceContentHash
  ) {
    return draft.geometry;
  }
  const sourceContentHash = canonicalSha256V1(
    footprint.points,
    "takfornyelse:workbench-source-footprint:v1",
  );
  return {
    ...draft.geometry,
    sourceFootprint: {
      ...footprint,
      sourceId: `workbench-footprint:${sourceContentHash.slice(0, 32)}`,
      sourceContentHash,
    },
  };
}

/**
 * Server-side bridge from an immutable workbench revision to the existing
 * assisted-manual adapter. It has no pricing or approval branch: every
 * successful calculation remains review_required and invalid evidence is
 * rejected before a height plane can be fitted.
 */
export function invokeWorkbenchHeightAdapterV1(input: {
  draft: RoofFusionWorkbenchDraftV1;
  targetSnapshotId: string;
  previousSnapshotId?: string;
  idempotencyKey: string;
  requestedAt: string;
  generatedAt: string;
  heightSurface: unknown;
  orthophoto: unknown;
}) {
  const draft = parseRoofFusionWorkbenchDraftV1(input.draft);
  const heightGate = heightSurfaceGateSchema.safeParse(input.heightSurface);
  if (!heightGate.success) {
    throw new RoofFusionWorkbenchHeightAdapterErrorV1(
      "TRUSTED_INPUT_REQUIRED",
      "A complete EPSG:25833 Høydedata surface is required before calculation",
    );
  }
  const orthophotoGate = orthophotoGateSchema.safeParse(input.orthophoto);
  if (!orthophotoGate.success) {
    throw new RoofFusionWorkbenchHeightAdapterErrorV1(
      "TRUSTED_INPUT_REQUIRED",
      "A captured actual-visible-extent EPSG:25833 orthophoto is required before calculation",
    );
  }
  const orthophoto = orthophotoGate.data;
  if (
    orthophoto.sourceId !== draft.source.sourceId ||
    orthophoto.rawContentHash !== draft.source.sourceContentHash ||
    orthophoto.geoReference.crs !== draft.source.georeference.crs ||
    orthophoto.geoReference.extentTrust !==
      draft.source.georeference.extentTrust ||
    JSON.stringify(orthophoto.geoReference.bounds) !==
      JSON.stringify(draft.source.georeference.bounds) ||
    orthophoto.geoReference.imageWidth !==
      draft.source.georeference.imageWidth ||
    orthophoto.geoReference.imageHeight !==
      draft.source.georeference.imageHeight
  ) {
    throw new RoofFusionWorkbenchHeightAdapterErrorV1(
      "DRAFT_SOURCE_MISMATCH",
      "The height adapter may only use the exact trusted orthophoto bound to this draft",
    );
  }

  return adaptAssistedManualRoofGeometryToSnapshotV1({
    schemaVersion: ASSISTED_MANUAL_HEIGHT_ADAPTER_INPUT_SCHEMA_VERSION,
    requestId: `workbench-${draft.draftId}`,
    caseId: draft.caseId,
    targetSnapshotId: input.targetSnapshotId,
    ...(input.previousSnapshotId
      ? { previousSnapshotId: input.previousSnapshotId }
      : {}),
    idempotencyKey: input.idempotencyKey,
    requestedAt: input.requestedAt,
    generatedAt: input.generatedAt,
    geometry: calculationGeometryV1(draft),
    heightSurface: heightGate.data as KartverketHeightSurfaceV1,
    orthophoto: {
      ...orthophoto,
      provider: orthophoto.provider ?? "norgeibilder.no",
      geoReference: orthophoto.geoReference as NorgeIBilderGeoReference,
    },
    actor: draft.actor,
  });
}
