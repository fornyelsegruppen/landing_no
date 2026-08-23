import { createHash } from "node:crypto";
import { addVat, lineTotal, nok } from "../platform/money";

export type PriceRuleSnapshot = {
  id: string | number;
  version: number;
  serviceKey: string;
  unitPriceExVatOre: number;
  vatBasisPoints: number;
  minimumExVatOre: number;
  toleranceBasisPoints: number;
  maximumExVatOre?: number | null;
  status: "draft" | "approved" | "retired";
};

export type PriceCalculation = {
  inputHash: string;
  quantityTenths: number;
  lineItems: Array<{
    code: string;
    quantityTenths: number;
    unitPriceExVatOre: number;
    totalExVatOre: number;
  }>;
  subtotalExVatOre: number;
  vatOre: number;
  totalIncVatOre: number;
  toleranceBasisPoints: number;
  maximumTotalIncVatOre: number | null;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculatePrice(
  quantityTenths: number,
  rule: PriceRuleSnapshot,
): PriceCalculation {
  if (!Number.isSafeInteger(quantityTenths) || quantityTenths <= 0) {
    throw new TypeError("Area must be a positive integer in tenths of a square metre");
  }
  if (rule.status !== "approved") throw new Error("Only an approved price rule may be calculated");

  const calculated = lineTotal(nok(rule.unitPriceExVatOre), quantityTenths * 100);
  let subtotalExVatOre = Math.max(calculated.amountMinor, rule.minimumExVatOre);
  if (rule.maximumExVatOre != null) {
    subtotalExVatOre = Math.min(subtotalExVatOre, rule.maximumExVatOre);
  }
  const totals = addVat(nok(subtotalExVatOre), rule.vatBasisPoints);
  const maximumNet = Math.round(
    (subtotalExVatOre * (10_000 + rule.toleranceBasisPoints)) / 10_000,
  );
  const maximum = addVat(nok(maximumNet), rule.vatBasisPoints).gross.amountMinor;
  const input = { quantityTenths, rule };

  return {
    inputHash: createHash("sha256").update(stable(input)).digest("hex"),
    quantityTenths,
    lineItems: [{
      code: rule.serviceKey,
      quantityTenths,
      unitPriceExVatOre: rule.unitPriceExVatOre,
      totalExVatOre: subtotalExVatOre,
    }],
    subtotalExVatOre,
    vatOre: totals.vat.amountMinor,
    totalIncVatOre: totals.gross.amountMinor,
    toleranceBasisPoints: rule.toleranceBasisPoints,
    maximumTotalIncVatOre: maximum,
  };
}

export function verifyAiPriceExplanation(
  text: string,
  calculation: PriceCalculation,
): boolean {
  const forbiddenNumbers = [...text.matchAll(/\b\d[\d .]*(?:,\d+)?\b/g)]
    .map((match) => Number(match[0].replace(/[ .]/g, "").replace(",", ".")))
    .filter(Number.isFinite);
  const allowed = new Set([
    calculation.quantityTenths / 10,
    calculation.subtotalExVatOre / 100,
    calculation.vatOre / 100,
    calculation.totalIncVatOre / 100,
    calculation.maximumTotalIncVatOre == null ? -1 : calculation.maximumTotalIncVatOre / 100,
    calculation.toleranceBasisPoints / 100,
    25,
  ]);
  return forbiddenNumbers.every((value) => allowed.has(value));
}
