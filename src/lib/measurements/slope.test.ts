import { describe, expect, it } from "vitest";
import { displayedSlopeFactor, slopeFactor } from "./slope";

describe("roof slope factors", () => {
  it.each([
    [22, 1.079], [27, 1.122], [32, 1.179], [36, 1.236], [40, 1.305], [45, 1.414],
  ])("uses 1/cos for %d degrees", (angle, expected) => {
    expect(displayedSlopeFactor(angle)).toBe(expected);
    expect(Math.round(slopeFactor(angle) * 100 * 10) / 10).toBeCloseTo(expected * 100, 1);
  });
});
