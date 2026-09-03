import { KartverketHeightDataError } from "@/lib/providers/kartverket-hoydedata-provider";
import { RoofFusionHeightSurfacePreviewError } from "./hoydedata-surface-preview-v1";
import { SimpleRoofPlaneSegmentationError } from "./simple-roof-plane-segmentation-v1";

export type RoofFusionHeightActionPhaseV1 =
  | "address_revalidation"
  | "building_revalidation"
  | "height_fetch"
  | "height_processing";

export type RoofFusionHeightActionErrorCodeV1 =
  | "SOURCE_VALIDATION_UNAVAILABLE"
  | "HEIGHT_DATA_UNAVAILABLE"
  | "ROOF_NOT_DETECTED"
  | "HEIGHT_PROCESSING_FAILED";

function safeErrorType(error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  return /^[A-Za-z][A-Za-z0-9]{0,79}$/u.test(name) ? name : "UnknownError";
}

/**
 * Produces log-safe diagnostics only: no address, coordinates, provider URL,
 * response body, query, geometry, or raw exception message is retained.
 */
export function mapRoofFusionHeightActionFailureV1(
  phase: RoofFusionHeightActionPhaseV1,
  error: unknown,
  correlationId: string,
) {
  let code: RoofFusionHeightActionErrorCodeV1;
  if (phase === "address_revalidation" || phase === "building_revalidation") {
    code = "SOURCE_VALIDATION_UNAVAILABLE";
  } else if (error instanceof KartverketHeightDataError) {
    code = "HEIGHT_DATA_UNAVAILABLE";
  } else if (
    error instanceof RoofFusionHeightSurfacePreviewError ||
    error instanceof SimpleRoofPlaneSegmentationError
  ) {
    code = "ROOF_NOT_DETECTED";
  } else {
    code = "HEIGHT_PROCESSING_FAILED";
  }
  return {
    state: { kind: "error" as const, code, correlationId },
    diagnostic: {
      event: "roof_fusion.preview_height_failed",
      correlationId,
      phase,
      code,
      errorType: safeErrorType(error),
    },
  };
}
