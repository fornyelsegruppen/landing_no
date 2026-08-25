import { describe, expect, it } from "vitest";
import {
  manualAreaDeviationPercent,
  requiresLargeManualAreaConfirmation,
  slopedAreaSquareMeters,
  slopeBandForPreset,
} from "./admin-workbench";

describe("admin measurement workbench", () => {
  it("maps every supported slope preset to a deterministic range", () => {
    expect(slopeBandForPreset(22)).toEqual([20, 24]);
    expect(slopeBandForPreset(32)).toEqual([30, 34]);
    expect(slopeBandForPreset(45)).toEqual([43, 47]);
  });

  it("calculates the sloped surface from the horizontal footprint", () => {
    expect(slopedAreaSquareMeters(100, 32)).toBeCloseTo(117.92, 2);
  });

  it("requires a second confirmation only above a twenty percent change", () => {
    expect(manualAreaDeviationPercent(1_000, 1_200)).toBeCloseTo(20);
    expect(requiresLargeManualAreaConfirmation(1_000, 1_200)).toBe(false);
    expect(requiresLargeManualAreaConfirmation(1_000, 1_201)).toBe(true);
    expect(requiresLargeManualAreaConfirmation(undefined, 1_500)).toBe(false);
  });

  it("rejects impossible area and slope inputs", () => {
    expect(() => slopedAreaSquareMeters(0, 32)).toThrow(RangeError);
    expect(() => slopedAreaSquareMeters(100, 90)).toThrow(RangeError);
  });
});
