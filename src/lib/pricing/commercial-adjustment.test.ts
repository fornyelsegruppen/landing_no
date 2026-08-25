import { describe, expect, it } from "vitest";
import { calculateAdjustedPrice } from "./commercial-adjustment";

const rule = { id: 1, version: 1, serviceKey: "takvask", unitPriceExVatOre: 10_000, vatBasisPoints: 2_500, minimumExVatOre: 100_000, toleranceBasisPoints: 1_000, status: "approved" as const };

describe("commercial price adjustment", () => {
  it("applies the audited discount before VAT and maximum-price tolerance", () => {
    const result = calculateAdjustedPrice({ administratorId: 9, areaTenths: 1000, discountKind: "percent", discountValue: 10, reason: "Avtalt kampanjerabatt", rule, unitPriceExVatOre: 10_000 });
    expect(result.subtotalExVatOre).toBe(900_000);
    expect(result.vatOre).toBe(225_000);
    expect(result.totalIncVatOre).toBe(1_125_000);
    expect(result.maximumTotalIncVatOre).toBe(1_237_500);
    expect(result.adjustment.discountOre).toBe(100_000);
  });

  it("blocks unapproved deep discounts and unsafe unit prices", () => {
    expect(() => calculateAdjustedPrice({ administratorId: 9, areaTenths: 1000, discountKind: "percent", discountValue: 21, reason: "For stor rabatt uten godkjenning", rule, unitPriceExVatOre: 10_000 })).toThrow(/20%/);
    expect(() => calculateAdjustedPrice({ administratorId: 9, areaTenths: 1000, discountKind: "none", discountValue: 0, reason: "Pris satt for lavt", rule, unitPriceExVatOre: 7_000 })).toThrow(/80–200%/);
  });
});
