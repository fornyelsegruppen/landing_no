export const NORWAY_STANDARD_VAT_BPS = 2_500;

export type Money = {
  amountMinor: number;
  currency: "NOK";
};

function assertMinorAmount(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new TypeError("Money must use a safe integer minor-unit amount");
  }
}

export function nok(amountMinor: number): Money {
  assertMinorAmount(amountMinor);
  return { amountMinor, currency: "NOK" };
}

export function addVat(
  net: Money,
  vatBasisPoints: number = NORWAY_STANDARD_VAT_BPS,
): { net: Money; vat: Money; gross: Money; vatBasisPoints: number } {
  assertMinorAmount(net.amountMinor);
  if (!Number.isInteger(vatBasisPoints) || vatBasisPoints < 0) {
    throw new TypeError("VAT must be a non-negative integer in basis points");
  }

  const vatMinor = Math.round((net.amountMinor * vatBasisPoints) / 10_000);
  return {
    net,
    vat: nok(vatMinor),
    gross: nok(net.amountMinor + vatMinor),
    vatBasisPoints,
  };
}

export function lineTotal(
  unitPrice: Money,
  quantityThousandths: number,
): Money {
  assertMinorAmount(unitPrice.amountMinor);
  if (!Number.isSafeInteger(quantityThousandths) || quantityThousandths < 0) {
    throw new TypeError("Quantity must be non-negative thousandths");
  }

  return nok(
    Math.round((unitPrice.amountMinor * quantityThousandths) / 1_000),
  );
}

export function formatNok(money: Money, locale = "nb-NO") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money.amountMinor / 100);
}
