import { z } from "zod";
import {
  assertAssistedManualRoofGeometryV1,
  assistedManualRoofGeometryV1Schema,
  canonicalAssistedManualRoofGeometryV1,
} from "./assisted-manual-roof-geometry-v1";
import { canonicalSha256V1, canonicalizeJsonValueV1 } from "./canonicalization-v1";

export const ROOF_FUSION_WORKBENCH_DRAFT_SCHEMA_VERSION =
  "roof-fusion-workbench-draft.v1" as const;

const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);
const timestamp = z.string().datetime({ offset: true });
const actorSchema = z
  .object({
    actorId: identifier,
    actorType: z.literal("administrator"),
    displayName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();
const georeferenceSchema = z
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
    imageWidth: z.number().int().positive().max(8_000),
    imageHeight: z.number().int().positive().max(8_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.bounds.maxEastingM <= value.bounds.minEastingM) {
      context.addIssue({ code: "custom", message: "Georeference east bounds are invalid", path: ["bounds"] });
    }
    if (value.bounds.maxNorthingM <= value.bounds.minNorthingM) {
      context.addIssue({ code: "custom", message: "Georeference north bounds are invalid", path: ["bounds"] });
    }
  });

export const roofFusionWorkbenchDraftV1Schema = z
  .object({
    schemaVersion: z.literal(ROOF_FUSION_WORKBENCH_DRAFT_SCHEMA_VERSION),
    draftId: identifier,
    caseId: identifier,
    revision: z.number().int().positive(),
    supersedesDraftId: identifier.optional(),
    idempotencyKey: z.string().trim().min(8).max(300),
    draftHash: sha256,
    geometryHash: sha256,
    state: z.enum(["draft", "review_required", "blocked"]),
    actor: actorSchema,
    createdAt: timestamp,
    source: z
      .object({
        sourceId: identifier,
        sourceContentHash: sha256,
        attribution: z.string().trim().min(1).max(500),
        imageId: z.union([z.string().trim().min(1).max(160), z.number().int().positive()]).optional(),
        georeference: georeferenceSchema,
      })
      .strict(),
    geometry: assistedManualRoofGeometryV1Schema,
    blockers: z.array(z.string().trim().min(1).max(500)).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.source.sourceId !== value.geometry.sourceFootprint.sourceId) {
      context.addIssue({ code: "custom", message: "Draft source ID does not match source footprint", path: ["source", "sourceId"] });
    }
    if (value.source.sourceContentHash !== value.geometry.sourceFootprint.sourceContentHash) {
      context.addIssue({ code: "custom", message: "Draft source hash does not match source footprint", path: ["source", "sourceContentHash"] });
    }
    if (value.state === "blocked" && value.blockers.length === 0) {
      context.addIssue({ code: "custom", message: "Blocked draft must explain its blockers", path: ["blockers"] });
    }
    const expectedGeometryHash = canonicalSha256V1(
      canonicalAssistedManualRoofGeometryV1(value.geometry),
      "takfornyelse:assisted-manual-roof-geometry:v1",
    );
    if (value.geometryHash !== expectedGeometryHash) {
      context.addIssue({ code: "custom", message: "Draft geometry hash does not match geometry", path: ["geometryHash"] });
    }
    if (value.draftHash !== workbenchDraftHashV1(value)) {
      context.addIssue({ code: "custom", message: "Draft hash does not match draft contents", path: ["draftHash"] });
    }
  });

export type RoofFusionWorkbenchDraftV1 = z.infer<typeof roofFusionWorkbenchDraftV1Schema>;
export type RoofFusionWorkbenchDraftReferenceV1 = Pick<RoofFusionWorkbenchDraftV1, "draftId" | "revision" | "draftHash" | "state">;

export function workbenchDraftHashV1(value: Omit<RoofFusionWorkbenchDraftV1, "draftHash">) {
  const { draftHash: _ignored, ...content } = value as RoofFusionWorkbenchDraftV1;
  void _ignored;
  return canonicalSha256V1(
    canonicalizeJsonValueV1(content),
    "takfornyelse:roof-fusion-workbench-draft:v1",
  );
}

export function buildRoofFusionWorkbenchDraftV1(
  value: Omit<RoofFusionWorkbenchDraftV1, "draftHash" | "geometryHash">,
) {
  const geometry = assertAssistedManualRoofGeometryV1(value.geometry);
  const geometryHash = canonicalSha256V1(
    canonicalAssistedManualRoofGeometryV1(geometry),
    "takfornyelse:assisted-manual-roof-geometry:v1",
  );
  const draft = {
    ...value,
    geometry,
    geometryHash,
    draftHash: "0".repeat(64),
  } as Omit<RoofFusionWorkbenchDraftV1, "draftHash"> & { draftHash: string };
  draft.draftHash = workbenchDraftHashV1(draft);
  return roofFusionWorkbenchDraftV1Schema.parse(canonicalizeJsonValueV1(draft));
}

export function parseRoofFusionWorkbenchDraftV1(value: unknown) {
  return roofFusionWorkbenchDraftV1Schema.parse(canonicalizeJsonValueV1(value));
}
