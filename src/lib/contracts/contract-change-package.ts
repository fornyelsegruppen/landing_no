import type { Payload } from "payload";
import { priceRuleSnapshot } from "@/lib/leads/automatic-package";
import { calculatePrice } from "@/lib/measurements/pricing";
import { createQuoteDraft } from "@/lib/quotes/payload-quote-engine";
import type { ContractChangeServiceKey } from "./contract-change-service";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") {
    return (value as { id: number }).id;
  }
  return null;
}

export async function prepareContractChangePackage(payload: Payload, input: {
  administratorId: number;
  contractRequestId: number;
  leadId: number;
  targetServiceKey: ContractChangeServiceKey;
}) {
  const [lead, measurements, sourceQuotes, rules] = await Promise.all([
    payload.findByID({ collection: "leads", id: input.leadId, depth: 0, overrideAccess: true }),
    payload.find({ collection: "roof-measurements", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { and: [{ lead: { equals: input.leadId } }, { status: { equals: "approved" } }] } }),
    payload.find({ collection: "quotes", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { and: [{ lead: { equals: input.leadId } }, { status: { equals: "accepted" } }] } }),
    payload.find({ collection: "price-rules", depth: 0, limit: 1, sort: "-version", overrideAccess: true, where: { and: [{ serviceKey: { equals: input.targetServiceKey } }, { status: { equals: "approved" } }] } }),
  ]);
  const measurement = measurements.docs[0];
  const sourceQuote = sourceQuotes.docs[0];
  const rule = rules.docs[0];
  if (!measurement?.actualAreaMaxTenths) throw new TypeError("A verified approved roof measurement is required for the revised quote");
  if (!sourceQuote) throw new TypeError("An accepted source quote is required for a controlled contract change");
  if (!rule) throw new TypeError("No approved price rule exists for the requested replacement service");

  const existing = await payload.find({
    collection: "quotes",
    depth: 0,
    limit: 1,
    sort: "-version",
    overrideAccess: true,
    where: { and: [
      { lead: { equals: input.leadId } },
      { supersedes: { equals: sourceQuote.id } },
      { status: { in: ["draft", "approved", "sent", "viewed"] } },
    ] },
  });
  const existingQuote = existing.docs.find((quote) => {
    const snapshot = quote.snapshot && typeof quote.snapshot === "object" ? quote.snapshot as Record<string, unknown> : {};
    return snapshot.serviceKey === input.targetServiceKey;
  });
  if (existingQuote) {
    const contracts = await payload.find({ collection: "contracts", depth: 0, limit: 1, overrideAccess: true, where: { quote: { equals: existingQuote.id } } });
    const contract = contracts.docs[0];
    if (!contract) throw new TypeError("The revised quote exists without its contract draft");
    return { quote: existingQuote, contract, sourceQuote, duplicate: true };
  }

  const calculated = calculatePrice(measurement.actualAreaMaxTenths, priceRuleSnapshot(rule));
  const now = new Date();
  const calculation = await payload.create({ collection: "price-calculations", depth: 0, overrideAccess: true, data: {
    reference: `PB-${input.leadId}-${now.getTime()}-${input.targetServiceKey}`,
    lead: input.leadId,
    measurement: measurement.id,
    priceRule: rule.id,
    inputSnapshot: {
      measurementHash: measurement.inputHash,
      measurementVersion: measurement.version,
      rule: priceRuleSnapshot(rule),
      controlledContractChange: {
        contractRequestId: input.contractRequestId,
        sourceQuoteId: sourceQuote.id,
        previousServiceKey: lead.inquiryType,
        targetServiceKey: input.targetServiceKey,
        preparedBy: input.administratorId,
      },
    },
    outputSnapshot: calculated,
    inputHash: calculated.inputHash,
    subtotalExVatOre: calculated.subtotalExVatOre,
    vatOre: calculated.vatOre,
    totalIncVatOre: calculated.totalIncVatOre,
    maximumTotalIncVatOre: calculated.maximumTotalIncVatOre,
    status: "ready",
    blockingReasons: [],
  } });

  try {
    const prepared = await createQuoteDraft(payload, calculation.id, now, {
      controlledChangeFromQuoteId: relationId(sourceQuote.id) || undefined,
    });
    return { ...prepared, sourceQuote, duplicate: false };
  } catch (error) {
    await payload.delete({ collection: "price-calculations", id: calculation.id, overrideAccess: true }).catch(() => undefined);
    throw error;
  }
}
