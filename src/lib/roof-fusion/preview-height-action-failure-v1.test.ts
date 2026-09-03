import { describe, expect, it } from "vitest";
import { KartverketHeightDataError } from "@/lib/providers/kartverket-hoydedata-provider";
import { RoofFusionHeightSurfacePreviewError } from "./hoydedata-surface-preview-v1";
import { mapRoofFusionHeightActionFailureV1 } from "./preview-height-action-failure-v1";

describe("Preview height action failure mapping", () => {
  it("keeps source revalidation failures distinct from Høydedata", () => {
    const result = mapRoofFusionHeightActionFailureV1(
      "building_revalidation",
      new Error("sensitive provider detail"),
      "correlation-123",
    );
    expect(result.state.code).toBe("SOURCE_VALIDATION_UNAVAILABLE");
    expect(result.diagnostic).toEqual({
      event: "roof_fusion.preview_height_failed",
      correlationId: "correlation-123",
      phase: "building_revalidation",
      code: "SOURCE_VALIDATION_UNAVAILABLE",
      errorType: "Error",
    });
    expect(JSON.stringify(result.diagnostic)).not.toContain("sensitive");
  });

  it("maps typed height and roof-processing failures accurately", () => {
    expect(
      mapRoofFusionHeightActionFailureV1(
        "height_fetch",
        new KartverketHeightDataError("PROVIDER_UNAVAILABLE", "network"),
        "correlation-456",
      ).state.code,
    ).toBe("HEIGHT_DATA_UNAVAILABLE");
    expect(
      mapRoofFusionHeightActionFailureV1(
        "height_processing",
        new RoofFusionHeightSurfacePreviewError(
          "ROOF_SURFACE_NOT_DETECTED",
          "roof",
        ),
        "correlation-789",
      ).state.code,
    ).toBe("ROOF_NOT_DETECTED");
    expect(
      mapRoofFusionHeightActionFailureV1(
        "height_processing",
        new TypeError("unexpected"),
        "correlation-987",
      ).state.code,
    ).toBe("HEIGHT_PROCESSING_FAILED");
  });
});
