import { describe, expect, it } from "vitest";
import {
  calculateLegacyManualPitchFallbackV1,
  LEGACY_MANUAL_PITCH_FALLBACK_VERSION,
} from "./legacy-manual-pitch-fallback-v1";

function previewInput(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: LEGACY_MANUAL_PITCH_FALLBACK_VERSION,
    horizontalAreaM2: 100,
    pitchDegrees: 30,
    useIntent: "preview_only",
    roofFusionContext: { state: "no_higher_accuracy_result" },
    ...overrides,
  };
}

describe("legacy manual pitch fallback v1", () => {
  it("deterministically converts horizontal area with area divided by cosine", () => {
    const first = calculateLegacyManualPitchFallbackV1(previewInput());
    const second = calculateLegacyManualPitchFallbackV1(
      structuredClone(previewInput()),
    );

    expect(first).toEqual(second);
    expect(first.status).toBe("review_required");
    expect(first.pricingReady).toBe(false);
    expect(first.measurementClass).toBe("preliminary");
    expect(first.calculation).toEqual({
      method: "legacy_manual_pitch",
      horizontalAreaM2: 100,
      pitchDegrees: 30,
      slopeFactor: 1.154701,
      surfaceAreaM2: 115.47,
    });
    expect(first.calculationHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rounds canonical inputs and results before hashing", () => {
    const result = calculateLegacyManualPitchFallbackV1(
      previewInput({ horizontalAreaM2: 123.45649, pitchDegrees: 22.22249 }),
    );

    expect(result.status).toBe("review_required");
    expect(result.calculation).toMatchObject({
      horizontalAreaM2: 123.456,
      pitchDegrees: 22.222,
      surfaceAreaM2: 133.361,
    });
  });

  it.each([
    [10, 0, 10],
    [5_000, 60, 10_000],
  ])(
    "accepts boundary area %s and pitch %s",
    (horizontalAreaM2, pitchDegrees, surfaceAreaM2) => {
      const result = calculateLegacyManualPitchFallbackV1(
        previewInput({ horizontalAreaM2, pitchDegrees }),
      );

      expect(result.status).toBe("review_required");
      expect(result.calculation?.surfaceAreaM2).toBe(surfaceAreaM2);
    },
  );

  it.each([9.999, 5_000.001, Number.NaN, Number.POSITIVE_INFINITY])(
    "blocks invalid horizontal area %s",
    (horizontalAreaM2) => {
      const result = calculateLegacyManualPitchFallbackV1(
        previewInput({ horizontalAreaM2 }),
      );

      expect(result.status).toBe("blocked");
      expect(result.issues.map((item) => item.code)).toContain(
        "HORIZONTAL_AREA_OUT_OF_RANGE",
      );
    },
  );

  it.each([-0.001, 60.001, Number.NaN, Number.POSITIVE_INFINITY])(
    "blocks unsafe pitch %s",
    (pitchDegrees) => {
      const result = calculateLegacyManualPitchFallbackV1(
        previewInput({ pitchDegrees }),
      );

      expect(result.status).toBe("blocked");
      expect(result.issues.map((item) => item.code)).toContain(
        "PITCH_OUT_OF_RANGE",
      );
    },
  );

  it("requires source and justification before proposing storage", () => {
    const missing = calculateLegacyManualPitchFallbackV1(
      previewInput({ useIntent: "propose_for_storage" }),
    );
    const short = calculateLegacyManualPitchFallbackV1(
      previewInput({
        useIntent: "propose_for_storage",
        evidence: { source: "drawing", justification: "no" },
      }),
    );
    const missingSource = calculateLegacyManualPitchFallbackV1(
      previewInput({
        useIntent: "propose_for_storage",
        evidence: { justification: "Measured by the administrator." },
      }),
    );
    const supplied = calculateLegacyManualPitchFallbackV1(
      previewInput({
        useIntent: "propose_for_storage",
        evidence: {
          source: "drawing",
          justification: "  Verified against section A-03.  ",
          reference: "  A-03  ",
        },
      }),
    );

    expect(missing.status).toBe("blocked");
    expect(short.status).toBe("blocked");
    expect(missingSource.status).toBe("blocked");
    expect(missing.issues.map((item) => item.code)).toContain(
      "STORAGE_EVIDENCE_REQUIRED",
    );
    expect(missingSource.issues.map((item) => item.code)).toContain(
      "STORAGE_EVIDENCE_REQUIRED",
    );
    expect(supplied.status).toBe("review_required");
    if (supplied.status !== "review_required")
      throw new Error("Expected a reviewable stored proposal");
    expect(supplied.evidence).toEqual({
      source: "drawing",
      justification: "Verified against section A-03.",
      reference: "A-03",
    });
  });

  it("protects a higher-accuracy result unless storage has an explicit override", () => {
    const roofFusionContext = {
      state: "protected_result",
      resultId: "rf-result-17",
      method: "assisted_manual_height_geometry",
    };
    const preview = calculateLegacyManualPitchFallbackV1(
      previewInput({ roofFusionContext }),
    );
    const storage = {
      useIntent: "propose_for_storage",
      evidence: {
        source: "onsite",
        justification: "Roof pitch measured from the access point.",
      },
      roofFusionContext,
    };
    const blocked = calculateLegacyManualPitchFallbackV1(previewInput(storage));
    const overridden = calculateLegacyManualPitchFallbackV1(
      previewInput({
        ...storage,
        higherAccuracyOverride: {
          confirmed: true,
          justification: "Known obstruction invalidates the height model.",
        },
      }),
    );

    expect(preview.status).toBe("review_required");
    if (preview.status !== "review_required")
      throw new Error("Expected a preview result");
    expect(preview.higherAccuracyOverrideConfirmed).toBe(false);
    expect(blocked.status).toBe("blocked");
    expect(blocked.issues.map((item) => item.code)).toContain(
      "HIGHER_ACCURACY_OVERRIDE_REQUIRED",
    );
    expect(overridden.status).toBe("review_required");
    if (overridden.status !== "review_required")
      throw new Error("Expected an explicitly overridden proposal");
    expect(overridden.higherAccuracyOverrideConfirmed).toBe(true);
    expect(overridden.reviewReasons).toContain(
      "HIGHER_ACCURACY_OPERATOR_OVERRIDE",
    );
    expect(overridden.pricingReady).toBe(false);
  });

  it("rejects unknown fields instead of silently weakening the contract", () => {
    const result = calculateLegacyManualPitchFallbackV1(
      previewInput({ pricingReady: true }),
    );

    expect(result.status).toBe("blocked");
    expect(result.issues.map((item) => item.code)).toContain("INPUT_INVALID");
  });

  it("requires callers to declare whether a higher-accuracy result exists", () => {
    const withoutGuard: Record<string, unknown> = { ...previewInput() };
    delete withoutGuard.roofFusionContext;
    const result = calculateLegacyManualPitchFallbackV1(withoutGuard);

    expect(result.status).toBe("blocked");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INPUT_INVALID",
          field: "roofFusionContext",
        }),
      ]),
    );
  });
});
