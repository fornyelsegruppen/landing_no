import type { Payload } from "payload";
import { priceRuleSnapshot } from "@/lib/leads/automatic-package";
import { calculatePrice } from "@/lib/measurements/pricing";
import { createQuoteDraft } from "@/lib/quotes/payload-quote-engine";
import { calculateAdjustedPrice, type DiscountKind } from "./commercial-adjustment";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  throw new TypeError("Required relationship is missing");
}

export async function rebuildCommercialPackage(payload: Payload, input: {
  administratorId: number;
  baseUnitPriceExVatOre: number;
  discountKind: DiscountKind;
  discountValue: number;
  leadId: number;
  reason: string;
  recommendedServiceKey?: string;
}) {
  const [lead, measurementResult, quoteResult] = await Promise.all([
    payload.findByID({ collection: "leads", id: input.leadId, depth: 0, overrideAccess: true }),
    payload.find({ collection: "roof-measurements", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { and: [{ lead: { equals: input.leadId } }, { status: { not_equals: "superseded" } }] } }),
    payload.find({ collection: "quotes", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { and: [{ lead: { equals: input.leadId } }, { status: { not_equals: "superseded" } }] } }),
  ]);
  const measurement = measurementResult.docs[0];
  const currentQuote = quoteResult.docs[0];
  if (!measurement || !["draft", "review_required", "approved"].includes(measurement.status)) throw new Error("A reviewable roof measurement is required");
  if (!currentQuote || currentQuote.status !== "draft") throw new Error("Commercial terms may only be edited before the quote is approved or sent");
  const requestedService = lead.inquiryType;
  if (!requestedService || requestedService === "usikker") throw new Error("A concrete requested service is required");
  const serviceKeys = [requestedService, input.recommendedServiceKey].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  const rulesResult = await payload.find({ collection: "price-rules", depth: 0, limit: 20, sort: "-version", overrideAccess: true, where: { and: [{ serviceKey: { in: serviceKeys } }, { status: { equals: "approved" } }] } });
  const rules = new Map<string, (typeof rulesResult.docs)[number]>();
  for (const rule of rulesResult.docs) if (!rules.has(rule.serviceKey)) rules.set(rule.serviceKey, rule);
  const baseRule = rules.get(requestedService);
  if (!baseRule) throw new Error("No approved price rule exists for the requested service");
  if (input.recommendedServiceKey && !rules.get(input.recommendedServiceKey)) throw new Error("No approved price rule exists for the recommended service");
  const areaTenths = measurement.actualAreaMaxTenths;
  if (!areaTenths) throw new Error("Verified roof area is required");
  const now = new Date();
  const group = `TG-${input.leadId}-${now.getTime()}`;
  const oldSiblingId = typeof currentQuote.siblingQuote === "number" ? currentQuote.siblingQuote : currentQuote.siblingQuote?.id;
  if (oldSiblingId) {
    const oldSibling = await payload.findByID({ collection: "quotes", id: oldSiblingId, depth: 0, overrideAccess: true }).catch(() => null);
    if (oldSibling && oldSibling.status === "draft") {
      await payload.update({ collection: "quotes", id: oldSibling.id, depth: 0, overrideAccess: true, data: { status: "superseded" } });
      const oldContracts = await payload.find({ collection: "contracts", depth: 0, limit: 10, overrideAccess: true, where: { quote: { equals: oldSibling.id } } });
      for (const oldContract of oldContracts.docs) if (oldContract.status === "draft") await payload.update({ collection: "contracts", id: oldContract.id, depth: 0, overrideAccess: true, data: { status: "superseded" } });
    }
  }

  async function createCalculation(serviceKey: string, adjusted: boolean) {
    const rule = rules.get(serviceKey)!;
    const snapshot = priceRuleSnapshot(rule);
    const calculated = adjusted
      ? calculateAdjustedPrice({ administratorId: input.administratorId, areaTenths, discountKind: input.discountKind, discountValue: input.discountValue, reason: input.reason, rule: snapshot, unitPriceExVatOre: input.baseUnitPriceExVatOre })
      : calculatePrice(areaTenths, snapshot);
    return payload.create({ collection: "price-calculations", depth: 0, overrideAccess: true, data: {
      reference: `PB-${input.leadId}-${now.getTime()}-${serviceKey}`,
      lead: input.leadId,
      measurement: measurement.id,
      priceRule: rule.id,
      inputSnapshot: { measurementHash: measurement.inputHash, measurementVersion: measurement.version, rule: snapshot, ...(adjusted ? { commercialAdjustment: (calculated as ReturnType<typeof calculateAdjustedPrice>).adjustment } : {}) },
      outputSnapshot: calculated,
      inputHash: calculated.inputHash,
      subtotalExVatOre: calculated.subtotalExVatOre,
      vatOre: calculated.vatOre,
      totalIncVatOre: calculated.totalIncVatOre,
      maximumTotalIncVatOre: calculated.maximumTotalIncVatOre,
      status: "ready",
      blockingReasons: [],
    } });
  }

  const baseCalculation = await createCalculation(requestedService, true);
  const base = await createQuoteDraft(payload, baseCalculation.id, now, { allowPendingMeasurement: true, optionGroup: group, optionKind: "base" });
  let recommended: typeof base | undefined;
  if (input.recommendedServiceKey && input.recommendedServiceKey !== requestedService) {
    const recommendedCalculation = await createCalculation(input.recommendedServiceKey, false);
    recommended = await createQuoteDraft(payload, recommendedCalculation.id, now, { allowPendingMeasurement: true, optionGroup: group, optionKind: "recommended", preservePrevious: true, siblingQuoteId: base.quote.id });
    await Promise.all([
      payload.update({ collection: "quotes", id: base.quote.id, depth: 0, overrideAccess: true, data: { siblingQuote: recommended.quote.id } }),
      payload.update({ collection: "quotes", id: recommended.quote.id, depth: 0, overrideAccess: true, data: { siblingQuote: base.quote.id } }),
    ]);
  }
  await payload.update({ collection: "leads", id: input.leadId, depth: 0, overrideAccess: true, data: {
    status: "quoted",
    nextAction: recommended ? "Kontroller begge tilbudsalternativene, godkjenn og send dem samlet til kunden." : "Kontroller den nye prisversjonen, godkjenn og send tilbudet til kunden.",
    nextActionAt: now.toISOString(),
  } });
  return { base, recommended, optionGroup: group, sourceQuoteId: relationId(currentQuote.id) };
}
