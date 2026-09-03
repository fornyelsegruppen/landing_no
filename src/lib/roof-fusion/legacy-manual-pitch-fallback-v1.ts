import { z } from "zod";
import {
  canonicalSha256V1,
  compareCanonicalStringsV1,
} from "./canonicalization-v1";

export const LEGACY_MANUAL_PITCH_FALLBACK_VERSION =
  "legacy-manual-pitch-fallback.v1" as const;
export const LEGACY_MANUAL_PITCH_MIN_HORIZONTAL_AREA_M2 = 10;
export const LEGACY_MANUAL_PITCH_MAX_HORIZONTAL_AREA_M2 = 5_000;
export const LEGACY_MANUAL_PITCH_MIN_DEGREES = 0;
/** Legacy UI presets stop at 45 degrees; the existing domain safety ceiling is 60. */
export const LEGACY_MANUAL_PITCH_MAX_DEGREES = 60;
export const LEGACY_MANUAL_PITCH_SOURCES = [
  "customer",
  "drawing",
  "admin_estimate",
  "onsite",
  "legacy_measurement",
] as const;

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u);

const explanation = z.string().trim().max(500);

const roofFusionContextSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("no_higher_accuracy_result") }).strict(),
  z
    .object({
      state: z.literal("protected_result"),
      resultId: identifier,
      method: z.enum([
        "automatic_height_geometry",
        "assisted_manual_height_geometry",
      ]),
    })
    .strict(),
]);

const legacyManualPitchFallbackInputV1Schema = z
  .object({
    schemaVersion: z.literal(LEGACY_MANUAL_PITCH_FALLBACK_VERSION),
    horizontalAreaM2: z
      .number()
      .finite()
      .min(LEGACY_MANUAL_PITCH_MIN_HORIZONTAL_AREA_M2)
      .max(LEGACY_MANUAL_PITCH_MAX_HORIZONTAL_AREA_M2),
    pitchDegrees: z
      .number()
      .finite()
      .min(LEGACY_MANUAL_PITCH_MIN_DEGREES)
      .max(LEGACY_MANUAL_PITCH_MAX_DEGREES),
    useIntent: z.enum(["preview_only", "propose_for_storage"]),
    roofFusionContext: roofFusionContextSchema,
    evidence: z
      .object({
        source: z.enum(LEGACY_MANUAL_PITCH_SOURCES),
        justification: explanation,
        reference: z.string().trim().min(1).max(300).optional(),
      })
      .strict()
      .optional(),
    higherAccuracyOverride: z
      .object({
        confirmed: z.boolean(),
        justification: explanation,
      })
      .strict()
      .optional(),
  })
  .strict();

export type LegacyManualPitchFallbackInputV1 = z.infer<
  typeof legacyManualPitchFallbackInputV1Schema
>;

export type LegacyManualPitchFallbackIssueCodeV1 =
  | "INPUT_INVALID"
  | "HORIZONTAL_AREA_OUT_OF_RANGE"
  | "PITCH_OUT_OF_RANGE"
  | "STORAGE_EVIDENCE_REQUIRED"
  | "HIGHER_ACCURACY_OVERRIDE_REQUIRED";

export type LegacyManualPitchFallbackIssueV1 = {
  code: LegacyManualPitchFallbackIssueCodeV1;
  field: string;
  message: string;
};

type LegacyManualPitchFallbackBaseResultV1 = {
  schemaVersion: typeof LEGACY_MANUAL_PITCH_FALLBACK_VERSION;
  pricingReady: false;
  measurementClass: "preliminary";
};

export type LegacyManualPitchFallbackResultV1 =
  | (LegacyManualPitchFallbackBaseResultV1 & {
      status: "blocked";
      calculation: null;
      calculationHash: null;
      issues: LegacyManualPitchFallbackIssueV1[];
    })
  | (LegacyManualPitchFallbackBaseResultV1 & {
      status: "review_required";
      calculation: {
        method: "legacy_manual_pitch";
        horizontalAreaM2: number;
        pitchDegrees: number;
        slopeFactor: number;
        surfaceAreaM2: number;
      };
      calculationHash: string;
      useIntent: "preview_only" | "propose_for_storage";
      evidence: LegacyManualPitchFallbackInputV1["evidence"] | null;
      roofFusionContext: LegacyManualPitchFallbackInputV1["roofFusionContext"];
      higherAccuracyOverrideConfirmed: boolean;
      reviewReasons: Array<
        "LEGACY_MANUAL_PITCH_ASSUMPTION" | "HIGHER_ACCURACY_OPERATOR_OVERRIDE"
      >;
      issues: [];
    });

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  const result = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

function blocked(
  issues: LegacyManualPitchFallbackIssueV1[],
): LegacyManualPitchFallbackResultV1 {
  return {
    schemaVersion: LEGACY_MANUAL_PITCH_FALLBACK_VERSION,
    status: "blocked",
    pricingReady: false,
    measurementClass: "preliminary",
    calculation: null,
    calculationHash: null,
    issues,
  };
}

function validationIssues(error: z.ZodError) {
  const issues = error.issues.map((item) => {
    const field = item.path.join(".") || "input";
    const code: LegacyManualPitchFallbackIssueCodeV1 =
      item.path[0] === "horizontalAreaM2"
        ? "HORIZONTAL_AREA_OUT_OF_RANGE"
        : item.path[0] === "pitchDegrees"
          ? "PITCH_OUT_OF_RANGE"
          : item.path[0] === "evidence"
            ? "STORAGE_EVIDENCE_REQUIRED"
            : item.path[0] === "higherAccuracyOverride"
              ? "HIGHER_ACCURACY_OVERRIDE_REQUIRED"
              : "INPUT_INVALID";
    return { code, field, message: item.message };
  });
  return issues.sort(
    (left, right) =>
      compareCanonicalStringsV1(left.field, right.field) ||
      compareCanonicalStringsV1(left.code, right.code) ||
      compareCanonicalStringsV1(left.message, right.message),
  );
}

/**
 * Computes the deliberately low-accuracy manual-pitch fallback. It is pure:
 * callers may preview or propose the result for storage, but this function
 * never persists, approves, prices, or replaces another Roof Fusion result.
 */
export function calculateLegacyManualPitchFallbackV1(
  inputValue: unknown,
): LegacyManualPitchFallbackResultV1 {
  const parsed = legacyManualPitchFallbackInputV1Schema.safeParse(inputValue);
  if (!parsed.success) return blocked(validationIssues(parsed.error));
  const input = parsed.data;
  const issues: LegacyManualPitchFallbackIssueV1[] = [];
  if (
    input.useIntent === "propose_for_storage" &&
    (!input.evidence || input.evidence.justification.length < 5)
  )
    issues.push({
      code: "STORAGE_EVIDENCE_REQUIRED",
      field: "evidence",
      message:
        "A stored manual-pitch proposal requires a source and a justification of at least 5 characters.",
    });
  if (
    input.useIntent === "propose_for_storage" &&
    input.roofFusionContext.state === "protected_result" &&
    (!input.higherAccuracyOverride?.confirmed ||
      input.higherAccuracyOverride.justification.length < 5)
  )
    issues.push({
      code: "HIGHER_ACCURACY_OVERRIDE_REQUIRED",
      field: "higherAccuracyOverride",
      message:
        "Replacing a higher-accuracy Roof Fusion result requires an explicit operator confirmation and justification of at least 5 characters.",
    });
  if (issues.length) return blocked(issues);

  const horizontalAreaM2 = round(input.horizontalAreaM2, 3);
  const pitchDegrees = round(input.pitchDegrees, 3);
  const slopeFactor = 1 / Math.cos((pitchDegrees * Math.PI) / 180);
  const calculation = {
    method: "legacy_manual_pitch" as const,
    horizontalAreaM2,
    pitchDegrees,
    slopeFactor: round(slopeFactor, 6),
    surfaceAreaM2: round(horizontalAreaM2 * slopeFactor, 3),
  };
  const higherAccuracyOverrideConfirmed = Boolean(
    input.useIntent === "propose_for_storage" &&
    input.roofFusionContext.state === "protected_result" &&
    input.higherAccuracyOverride?.confirmed,
  );
  const evidence = input.evidence ?? null;
  return {
    schemaVersion: LEGACY_MANUAL_PITCH_FALLBACK_VERSION,
    status: "review_required",
    pricingReady: false,
    measurementClass: "preliminary",
    calculation,
    calculationHash: canonicalSha256V1(
      {
        calculation,
        useIntent: input.useIntent,
        evidence,
        roofFusionContext: input.roofFusionContext,
        higherAccuracyOverrideConfirmed,
        overrideJustification:
          input.higherAccuracyOverride?.justification ?? null,
      },
      "takfornyelse:legacy-manual-pitch-fallback:v1",
    ),
    useIntent: input.useIntent,
    evidence,
    roofFusionContext: input.roofFusionContext,
    higherAccuracyOverrideConfirmed,
    reviewReasons: [
      "LEGACY_MANUAL_PITCH_ASSUMPTION",
      ...(higherAccuracyOverrideConfirmed
        ? (["HIGHER_ACCURACY_OPERATOR_OVERRIDE"] as const)
        : []),
    ],
    issues: [],
  };
}
