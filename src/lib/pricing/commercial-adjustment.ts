import { createHash } from "node:crypto";
import { addVat, nok } from "@/lib/platform/money";
import { calculatePrice, type PriceCalculation, type PriceRuleSnapshot } from "@/lib/measurements/pricing";

export type DiscountKind = "none" | "percent" | "fixed";

export type CommercialAdjustment = {
  administratorId: number;
  baseUnitPriceExVatOre: number;
  discountKind: DiscountKind;
  discountOre: number;
  discountValue: number;
  reason: string;
  unitPriceExVatOre: number;
};

export type AdjustedPriceCalculation = PriceCalculation & {
  adjustment: CommercialAdjustment;
  standardSubtotalExVatOre: number;
};

export function calculateAdjustedPrice(input: {
  administratorId: number;
  areaTenths: number;
  discountKind: DiscountKind;
  discountValue: number;
  reason: string;
  rule: PriceRuleSnapshot;
  unitPriceExVatOre: number;
}): AdjustedPriceCalculation {
  if (!Number.isSafeInteger(input.administratorId) || input.administratorId <= 0) throw new TypeError("Administrator is required");
  if (input.reason.trim().length < 10) throw new TypeError("A clear commercial adjustment reason is required");
  if (!Number.isSafeInteger(input.unitPriceExVatOre) || input.unitPriceExVatOre <= 0) throw new TypeError("Unit price must be a positive amount in øre");
  const minimumUnit = Math.round(input.rule.unitPriceExVatOre * 0.8);
  const maximumUnit = Math.round(input.rule.unitPriceExVatOre * 2);
  if (input.unitPriceExVatOre < minimumUnit || input.unitPriceExVatOre > maximumUnit) {
    throw new RangeError("Unit price is outside the approved 80–200% safety range");
  }

  const adjustedRule = { ...input.rule, unitPriceExVatOre: input.unitPriceExVatOre };
  const standard = calculatePrice(input.areaTenths, adjustedRule);
  let discountOre = 0;
  if (input.discountKind === "percent") {
    const basisPoints = Math.round(input.discountValue * 100);
    if (basisPoints < 0 || basisPoints > 2_000) throw new RangeError("Discount may not exceed 20% without separate approval");
    discountOre = Math.round((standard.subtotalExVatOre * basisPoints) / 10_000);
  } else if (input.discountKind === "fixed") {
    discountOre = Math.round(input.discountValue * 100);
    if (discountOre < 0 || discountOre > Math.round(standard.subtotalExVatOre * 0.2)) throw new RangeError("Discount may not exceed 20% without separate approval");
  } else if (input.discountValue !== 0) {
    throw new TypeError("Discount value must be zero when no discount is selected");
  }
  const subtotalExVatOre = standard.subtotalExVatOre - discountOre;
  if (subtotalExVatOre < input.rule.minimumExVatOre) throw new RangeError("Adjusted price is below the approved minimum price");
  const totals = addVat(nok(subtotalExVatOre), input.rule.vatBasisPoints);
  const maximumNet = Math.round((subtotalExVatOre * (10_000 + input.rule.toleranceBasisPoints)) / 10_000);
  const maximum = addVat(nok(maximumNet), input.rule.vatBasisPoints).gross.amountMinor;
  const adjustment: CommercialAdjustment = {
    administratorId: input.administratorId,
    baseUnitPriceExVatOre: input.rule.unitPriceExVatOre,
    discountKind: input.discountKind,
    discountOre,
    discountValue: input.discountValue,
    reason: input.reason.trim(),
    unitPriceExVatOre: input.unitPriceExVatOre,
  };
  const hashInput = JSON.stringify({ areaTenths: input.areaTenths, rule: adjustedRule, adjustment });
  return {
    ...standard,
    adjustment,
    inputHash: createHash("sha256").update(hashInput).digest("hex"),
    lineItems: [{ code: input.rule.serviceKey, quantityTenths: input.areaTenths, unitPriceExVatOre: input.unitPriceExVatOre, totalExVatOre: subtotalExVatOre }],
    maximumTotalIncVatOre: maximum,
    standardSubtotalExVatOre: standard.subtotalExVatOre,
    subtotalExVatOre,
    totalIncVatOre: totals.gross.amountMinor,
    vatOre: totals.vat.amountMinor,
  };
}
