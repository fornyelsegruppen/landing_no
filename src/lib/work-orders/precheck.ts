export type WorkOrderPriceRule = {
  unitPriceExVatOre: number;
  vatBasisPoints: number;
  minimumExVatOre: number;
};

export type WorkOrderContractLimits = {
  estimatedAreaMinTenths: number;
  estimatedAreaMaxTenths: number;
  toleranceBasisPoints: number;
  originalTotalIncVatOre: number;
  maximumTotalIncVatOre: number | null;
};

export type PrecheckResult = {
  decision: "ready" | "blocked";
  outcome: "lower" | "within_contract" | "over_tolerance" | "over_maximum" | "scope_change" | "hms_blocked";
  actualSubtotalExVatOre: number;
  actualVatOre: number;
  actualTotalIncVatOre: number;
  allowedAreaMaxTenths: number;
  blockingReasons: string[];
};

function safeInteger(label: string, value: number, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
}

export function assessPrecheck(input: {
  actualAreaTenths: number;
  hmsSafe: boolean;
  scopeChanged: boolean;
  contract: WorkOrderContractLimits;
  rule: WorkOrderPriceRule;
}): PrecheckResult {
  safeInteger("Actual area", input.actualAreaTenths, true);
  safeInteger("Unit price", input.rule.unitPriceExVatOre);
  safeInteger("VAT", input.rule.vatBasisPoints);
  safeInteger("Minimum", input.rule.minimumExVatOre);
  safeInteger("Estimated maximum area", input.contract.estimatedAreaMaxTenths, true);
  safeInteger("Tolerance", input.contract.toleranceBasisPoints);
  safeInteger("Original total", input.contract.originalTotalIncVatOre);
  if (input.contract.maximumTotalIncVatOre !== null) safeInteger("Maximum total", input.contract.maximumTotalIncVatOre);

  const actualSubtotalExVatOre = Math.max(
    Math.round((input.rule.unitPriceExVatOre * input.actualAreaTenths) / 10),
    input.rule.minimumExVatOre,
  );
  const actualVatOre = Math.round((actualSubtotalExVatOre * input.rule.vatBasisPoints) / 10_000);
  const actualTotalIncVatOre = actualSubtotalExVatOre + actualVatOre;
  const allowedAreaMaxTenths = Math.floor(
    (input.contract.estimatedAreaMaxTenths * (10_000 + input.contract.toleranceBasisPoints)) / 10_000,
  );
  const blockingReasons: string[] = [];
  let outcome: PrecheckResult["outcome"] = actualTotalIncVatOre < input.contract.originalTotalIncVatOre ? "lower" : "within_contract";

  if (!input.hmsSafe) {
    outcome = "hms_blocked";
    blockingReasons.push("HMS eller adkomst er ikke bekreftet trygg.");
  } else if (input.scopeChanged) {
    outcome = "scope_change";
    blockingReasons.push("Arbeidsomfanget avviker fra den signerte kontrakten.");
  } else if (input.actualAreaTenths > allowedAreaMaxTenths) {
    outcome = "over_tolerance";
    blockingReasons.push("Kontrollmålt areal er høyere enn avtalt toleranse.");
  } else if (input.contract.maximumTotalIncVatOre !== null && actualTotalIncVatOre > input.contract.maximumTotalIncVatOre) {
    outcome = "over_maximum";
    blockingReasons.push("Kontrollmålt pris overstiger avtalt maksimalbeløp.");
  }

  return {
    decision: blockingReasons.length ? "blocked" : "ready",
    outcome,
    actualSubtotalExVatOre,
    actualVatOre,
    actualTotalIncVatOre,
    allowedAreaMaxTenths,
    blockingReasons,
  };
}

export function assessAcceptedChangePrecheck(input: {
  actualAreaTenths: number;
  agreedAreaTenths: number;
  agreedSubtotalExVatOre: number;
  agreedTotalIncVatOre: number;
  unitPriceExVatOre: number;
  vatBasisPoints: number;
  hmsSafe: boolean;
  scopeChangedAgain: boolean;
}): PrecheckResult {
  safeInteger("Actual area", input.actualAreaTenths, true);
  safeInteger("Agreed area", input.agreedAreaTenths, true);
  const reductionExVatOre = input.actualAreaTenths < input.agreedAreaTenths
    ? Math.round((input.unitPriceExVatOre * (input.agreedAreaTenths - input.actualAreaTenths)) / 10)
    : 0;
  const actualSubtotalExVatOre = Math.max(0, input.agreedSubtotalExVatOre - reductionExVatOre);
  const actualVatOre = Math.round((actualSubtotalExVatOre * input.vatBasisPoints) / 10_000);
  const actualTotalIncVatOre = actualSubtotalExVatOre + actualVatOre;
  const blockingReasons: string[] = [];
  let outcome: PrecheckResult["outcome"] = actualTotalIncVatOre < input.agreedTotalIncVatOre ? "lower" : "within_contract";
  if (!input.hmsSafe) { outcome = "hms_blocked"; blockingReasons.push("HMS eller adkomst er ikke bekreftet trygg."); }
  else if (input.scopeChangedAgain) { outcome = "scope_change"; blockingReasons.push("Arbeidsomfanget har endret seg etter kundens godkjenning."); }
  else if (input.actualAreaTenths > input.agreedAreaTenths) { outcome = "over_tolerance"; blockingReasons.push("Kontrollmålt areal er høyere enn den godkjente endringsavtalen."); }
  return { decision: blockingReasons.length ? "blocked" : "ready", outcome, actualSubtotalExVatOre, actualVatOre, actualTotalIncVatOre, allowedAreaMaxTenths: input.agreedAreaTenths, blockingReasons };
}
