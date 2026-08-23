import { describe, expect, it } from "vitest";
import { addVat, formatNok, lineTotal, nok } from "./money";

describe("minor-unit money calculations", () => {
  it("adds Norwegian standard VAT without floating-point money", () => {
    expect(addVat(nok(13_800))).toEqual({
      net: nok(13_800),
      vat: nok(3_450),
      gross: nok(17_250),
      vatBasisPoints: 2_500,
    });
  });

  it("calculates a price for a roof area stored in thousandths", () => {
    expect(lineTotal(nok(13_800), 150_500)).toEqual(nok(2_076_900));
  });

  it("rejects fractional minor units", () => {
    expect(() => nok(10.5)).toThrow(/safe integer/);
  });

  it("formats NOK for Norwegian readers", () => {
    expect(formatNok(nok(17_250))).toContain("172,50");
  });
});
