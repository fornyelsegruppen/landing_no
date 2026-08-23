import { describe, expect, it } from "vitest";
import { calculatePrice, verifyAiPriceExplanation, type PriceRuleSnapshot } from "./pricing";

const rule: PriceRuleSnapshot = {
  id: 1, version: 3, serviceKey: "takvask", unitPriceExVatOre: 13_800,
  vatBasisPoints: 2_500, minimumExVatOre: 100_000, toleranceBasisPoints: 1_000,
  status: "approved",
};

describe("deterministic roof pricing", () => {
  it("uses integer ore and returns identical snapshots for locked input", () => {
    const first = calculatePrice(1_505, rule);
    const second = calculatePrice(1_505, { ...rule });
    expect(first).toEqual(second);
    expect(first.subtotalExVatOre).toBe(2_076_900);
    expect(first.vatOre).toBe(519_225);
    expect(first.totalIncVatOre).toBe(2_596_125);
    expect(Number.isSafeInteger(first.totalIncVatOre)).toBe(true);
  });

  it("rejects draft rules", () => {
    expect(() => calculatePrice(1_000, { ...rule, status: "draft" })).toThrow(/approved/);
  });

  it("rejects AI prose that invents a different price", () => {
    const calculation = calculatePrice(1_505, rule);
    expect(verifyAiPriceExplanation("Areal 150,5 m². Total 25961,25 kr og 25 % mva.", calculation)).toBe(true);
    expect(verifyAiPriceExplanation("Totalen blir 30 000 kr.", calculation)).toBe(false);
  });
});
