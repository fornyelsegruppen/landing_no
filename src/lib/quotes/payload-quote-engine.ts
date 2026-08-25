import type { Payload } from "payload";
import { buildContractSnapshot, buildQuoteSnapshot, documentHash, type QuoteSnapshot } from "./document";

function idOf(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  throw new TypeError("Required relationship is missing");
}

const serviceNames: Record<string, string> = {
  takvask: "Takvask", takvask_impregnering: "Takvask og impregnering", impregnering: "Impregnering",
  takmaling: "Takmaling", nytt_tak: "Nytt tak",
};

export async function createQuoteDraft(
  payload: Payload,
  calculationId: number,
  now = new Date(),
  options: {
    allowPendingMeasurement?: boolean;
    optionGroup?: string;
    optionKind?: "base" | "recommended";
    preservePrevious?: boolean;
    siblingQuoteId?: number;
  } = {},
) {
  const calculation = await payload.findByID({ collection: "price-calculations", id: calculationId, depth: 0, overrideAccess: true });
  if (calculation.status !== "ready") throw new Error("Price calculation is not ready");
  const leadId = idOf(calculation.lead);
  const measurementId = idOf(calculation.measurement);
  const ruleId = idOf(calculation.priceRule);
  const [lead, measurement, rule, termsResult, existing] = await Promise.all([
    payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: "roof-measurements", id: measurementId, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: "price-rules", id: ruleId, depth: 0, overrideAccess: true }),
    payload.find({ collection: "contract-terms", depth: 0, limit: 1, sort: "-approvedAt", overrideAccess: true, where: { status: { equals: "approved" } } }),
    payload.find({ collection: "quotes", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { lead: { equals: leadId } } }),
  ]);
  const pendingMeasurementAllowed = options.allowPendingMeasurement === true
    && ["draft", "review_required"].includes(measurement.status);
  if (measurement.status !== "approved" && !pendingMeasurementAllowed) {
    throw new Error("Roof measurement must be approved");
  }
  if (pendingMeasurementAllowed && Array.isArray(measurement.blockingReasons) && measurement.blockingReasons.length > 0) {
    throw new Error("A blocked roof measurement cannot be used for a quote draft");
  }
  if (rule.status !== "approved") throw new Error("Price rule must be approved");
  const terms = termsResult.docs[0];
  if (!terms || !terms.legalReviewReference || terms.legalReviewReference !== process.env.LEGAL_REVIEW_REFERENCE) {
    throw new Error("Approved legally reviewed contract terms are required");
  }
  const previous = existing.docs[0];
  if (previous?.status === "accepted") throw new Error("An accepted quote requires a controlled change agreement");
  const version = (previous?.version ?? 0) + 1;
  const quoteReference = `T-${leadId}-V${version}`;
  const assumptions = [
    `Takarealet er estimert til ${measurement.actualAreaMinTenths / 10}–${measurement.actualAreaMaxTenths / 10} m² fra lagret polygon og vinkelintervall.`,
    "Takvinkel og faktisk areal kontrolleres på stedet før arbeidet starter.",
    "Arbeid utover avtalt toleranse eller maksimalpris krever en separat godkjenning fra kunden.",
  ];
  const snapshot = buildQuoteSnapshot({
    quoteReference, leadId, serviceKey: rule.serviceKey,
    serviceDescription: serviceNames[rule.serviceKey] ?? rule.serviceKey,
    propertyAddress: measurement.normalizedAddress,
    measurement: {
      id: measurement.id, version: measurement.version, inputHash: measurement.inputHash,
      horizontalAreaTenths: measurement.horizontalAreaTenths,
      actualAreaMinTenths: measurement.actualAreaMinTenths, actualAreaMaxTenths: measurement.actualAreaMaxTenths,
      source: measurement.source, credits: measurement.credits, capturedAt: measurement.capturedAt, assumptions,
    },
    pricing: {
      calculationId: calculation.id, inputHash: calculation.inputHash, ruleId: rule.id, ruleVersion: rule.version,
      unitPriceExVatOre: rule.unitPriceExVatOre, subtotalExVatOre: calculation.subtotalExVatOre,
      vatBasisPoints: rule.vatBasisPoints, vatOre: calculation.vatOre, totalIncVatOre: calculation.totalIncVatOre,
      toleranceBasisPoints: rule.toleranceBasisPoints, maximumTotalIncVatOre: calculation.maximumTotalIncVatOre ?? null,
    },
    termsVersion: terms.version,
    validUntil: new Date(now.getTime() + 14 * 24 * 60 * 60_000).toISOString(),
  });
  const quote = await payload.create({ collection: "quotes", overrideAccess: true, data: {
    reference: quoteReference, lead: leadId, measurement: measurement.id, priceCalculation: calculation.id,
    version, supersedes: options.preservePrevious ? undefined : previous?.id,
    optionGroup: options.optionGroup, optionKind: options.optionKind, siblingQuote: options.siblingQuoteId,
    snapshot, snapshotHash: documentHash(snapshot),
    serviceDescription: snapshot.serviceDescription, totalIncVatOre: snapshot.pricing.totalIncVatOre,
    maximumTotalIncVatOre: snapshot.pricing.maximumTotalIncVatOre, termsVersion: terms.version,
    validUntil: snapshot.validUntil, status: "draft",
  } });
  try {
    const contractSnapshot = buildContractSnapshot({
      contractReference: `K-${leadId}-V${version}`,
      quote: snapshot,
      customer: { name: lead.name, address: measurement.normalizedAddress, email: lead.email, phone: lead.phone },
      terms: { version: terms.version, text: terms.contractText, withdrawalInstructions: terms.withdrawalInstructions, withdrawalFormUrl: terms.withdrawalFormUrl },
    });
    const contract = await payload.create({ collection: "contracts", overrideAccess: true, data: {
      reference: contractSnapshot.contractReference, quote: quote.id, version,
      snapshot: contractSnapshot, documentHash: documentHash(contractSnapshot), termsVersion: terms.version, status: "draft",
    } });
    if (previous && !options.preservePrevious) {
      await payload.update({ collection: "quotes", id: previous.id, overrideAccess: true, data: { status: "superseded" } });
      const oldContracts = await payload.find({ collection: "contracts", depth: 0, limit: 10, overrideAccess: true, where: { quote: { equals: previous.id } } });
      for (const old of oldContracts.docs) {
        if (["draft", "issued"].includes(old.status)) await payload.update({ collection: "contracts", id: old.id, overrideAccess: true, data: { status: "superseded" } });
      }
    }
    await payload.update({ collection: "price-calculations", id: calculation.id, overrideAccess: true, data: { status: "superseded" } });
    return { quote, contract, snapshot };
  } catch (error) {
    await payload.delete({ collection: "quotes", id: quote.id, overrideAccess: true }).catch(() => undefined);
    throw error;
  }
}

export function quoteSnapshotFromRecord(value: unknown): QuoteSnapshot {
  return buildQuoteSnapshot(value as Omit<QuoteSnapshot, "schemaVersion">);
}
