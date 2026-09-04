export const LEGACY_MANUAL_PITCH_MIN_HORIZONTAL_AREA_M2 = 10;
export const LEGACY_MANUAL_PITCH_MAX_HORIZONTAL_AREA_M2 = 5_000;
export const LEGACY_MANUAL_PITCH_MIN_DEGREES = 0;
export const LEGACY_MANUAL_PITCH_MAX_DEGREES = 60;
export const LEGACY_MANUAL_PITCH_PRESETS = [22, 27, 32, 36, 40, 45] as const;

export type LegacyManualPitchCalculationV1 = {
  method: "legacy_manual_pitch";
  horizontalAreaM2: number;
  pitchDegrees: number;
  slopeFactor: number;
  surfaceAreaM2: number;
};

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  const result = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

/**
 * Browser-safe geometry shared by the Preview UI and the guarded server
 * contract. Persistence, override and pricing rules remain server concerns.
 */
export function calculateLegacyManualPitchGeometryV1(input: {
  horizontalAreaM2: number;
  pitchDegrees: number;
}): LegacyManualPitchCalculationV1 | null {
  if (
    !Number.isFinite(input.horizontalAreaM2) ||
    input.horizontalAreaM2 < LEGACY_MANUAL_PITCH_MIN_HORIZONTAL_AREA_M2 ||
    input.horizontalAreaM2 > LEGACY_MANUAL_PITCH_MAX_HORIZONTAL_AREA_M2 ||
    !Number.isFinite(input.pitchDegrees) ||
    input.pitchDegrees < LEGACY_MANUAL_PITCH_MIN_DEGREES ||
    input.pitchDegrees > LEGACY_MANUAL_PITCH_MAX_DEGREES
  )
    return null;

  const horizontalAreaM2 = round(input.horizontalAreaM2, 3);
  const pitchDegrees = round(input.pitchDegrees, 3);
  const slopeFactor = 1 / Math.cos((pitchDegrees * Math.PI) / 180);
  return {
    method: "legacy_manual_pitch",
    horizontalAreaM2,
    pitchDegrees,
    slopeFactor: round(slopeFactor, 6),
    surfaceAreaM2: round(horizontalAreaM2 * slopeFactor, 3),
  };
}
