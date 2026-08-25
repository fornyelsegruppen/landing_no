export const ROOF_SLOPE_PRESETS = [22, 27, 32, 36, 40, 45] as const;

export type RoofSlopePreset = (typeof ROOF_SLOPE_PRESETS)[number];

const SLOPE_BANDS: Record<RoofSlopePreset, readonly [number, number]> = {
  22: [20, 24],
  27: [25, 29],
  32: [30, 34],
  36: [35, 37],
  40: [38, 42],
  45: [43, 47],
};

export function slopeBandForPreset(preset: RoofSlopePreset) {
  return SLOPE_BANDS[preset];
}

export function slopedAreaSquareMeters(horizontalArea: number, slopeDegrees: number) {
  if (!Number.isFinite(horizontalArea) || horizontalArea <= 0) throw new RangeError("Horizontal area must be positive");
  if (!Number.isFinite(slopeDegrees) || slopeDegrees < 0 || slopeDegrees >= 90) throw new RangeError("Slope must be between 0 and 90 degrees");
  return horizontalArea / Math.cos(slopeDegrees * Math.PI / 180);
}

export function manualAreaDeviationPercent(previousAreaTenths: number | undefined, nextAreaTenths: number) {
  if (!previousAreaTenths || previousAreaTenths <= 0) return 0;
  return Math.abs(nextAreaTenths - previousAreaTenths) / previousAreaTenths * 100;
}

export function requiresLargeManualAreaConfirmation(previousAreaTenths: number | undefined, nextAreaTenths: number) {
  return manualAreaDeviationPercent(previousAreaTenths, nextAreaTenths) > 20;
}
