import type { Payload } from "payload";
import type { PriceCalculation, RoofMeasurement } from "@/payload/payload-types";
import { calculatePrice, type PriceRuleSnapshot } from "@/lib/measurements/pricing";
import { prepareMeasurement } from "@/lib/measurements/proposal";
import { nextMeasurementVersion } from "@/lib/measurements/versioning";
import { createQuoteDraft } from "@/lib/quotes/payload-quote-engine";
import { documentHash } from "@/lib/quotes/document";
import { issueQuoteCustomerLink } from "@/lib/quotes/issue";
import { deliverMessage, enqueueMessageJob } from "@/lib/messages/message-engine";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { KartverketAddressProvider } from "@/lib/providers/kartverket-address-provider";
import {
  OpenStreetMapBuildingProvider,
  type BuildingFootprintCandidate,
} from "@/lib/providers/osm-building-provider";

export type AutomaticPackageBlockCode =
  | "ADDRESS_REQUIRED"
  | "ADDRESS_NOT_FOUND"
  | "BUILDING_NOT_FOUND"
  | "BUILDING_AMBIGUOUS"
  | "PRICE_RULE_NOT_FOUND"
  | "SERVICE_REVIEW_REQUIRED";

export type AutomaticPackageResult =
  | {
      status: "ready";
      measurementId: number;
      calculationId: number;
      quoteId: number;
      contractId: number;
      duplicate: boolean;
    }
  | { status: "blocked"; code: AutomaticPackageBlockCode; reason: string };

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") {
    return (value as { id: number }).id;
  }
  return null;
}

function usableAddress(value: unknown): value is string {
  return typeof value === "string"
    && value.trim().length >= 4
    && !/^ikke oppgitt$/i.test(value.trim());
}

function uniqueAddressParts(parts: unknown[]) {
  const seen = new Set<string>();
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLocaleLowerCase("nb-NO");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function selectAutomaticBuildingCandidate(candidates: BuildingFootprintCandidate[]) {
  const containing = candidates.filter((candidate) => candidate.containsAddress && candidate.confidence === "high");
  if (containing.length === 1) return { candidate: containing[0], reason: null };
  if (containing.length > 1) return { candidate: null, reason: "multiple_buildings_contain_address" };

  const first = candidates[0];
  const second = candidates[1];
  const clearlyNearest = first?.confidence === "medium"
    && first.distanceToAddressMeters <= 20
    && (!second || second.distanceToAddressMeters - first.distanceToAddressMeters >= 12);
  if (clearlyNearest) return { candidate: first, reason: null };
  return { candidate: null, reason: candidates.length ? "building_match_ambiguous" : "building_not_found" };
}

async function markBlocked(
  payload: Payload,
  lead: Record<string, unknown> & { id: number },
  code: AutomaticPackageBlockCode,
  reason: string,
): Promise<AutomaticPackageResult> {
  const qualification = lead.qualification && typeof lead.qualification === "object"
    ? lead.qualification as Record<string, unknown>
    : {};
  await payload.update({
    collection: "leads",
    id: lead.id,
    overrideAccess: true,
    data: {
      status: "measuring",
      qualification: {
        ...qualification,
        packagePreparation: { status: "blocked", code, reason, checkedAt: new Date().toISOString() },
      },
      nextAction: reason,
      nextActionAt: new Date().toISOString(),
    },
  });
  return { status: "blocked", code, reason };
}

export function priceRuleSnapshot(rule: {
  id: number;
  version: number;
  serviceKey: string;
  unitPriceExVatOre: number;
  vatBasisPoints: number;
  minimumExVatOre: number;
  toleranceBasisPoints: number;
  maximumExVatOre?: number | null;
  status: "draft" | "approved" | "retired";
}): PriceRuleSnapshot {
  return {
    id: rule.id,
    version: rule.version,
    serviceKey: rule.serviceKey,
    unitPriceExVatOre: rule.unitPriceExVatOre,
    vatBasisPoints: rule.vatBasisPoints,
    minimumExVatOre: rule.minimumExVatOre,
    toleranceBasisPoints: rule.toleranceBasisPoints,
    maximumExVatOre: rule.maximumExVatOre,
    status: rule.status,
  };
}

export async function prepareAutomaticLeadPackage(
  payload: Payload,
  leadId: number,
  providers: {
    addresses?: KartverketAddressProvider;
    buildings?: OpenStreetMapBuildingProvider;
  } = {},
): Promise<AutomaticPackageResult> {
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  if (["converted", "closed"].includes(lead.status || "")) {
    throw new TypeError("Automatic package cannot be prepared for a closed lead");
  }

  const existingQuotes = await payload.find({
    collection: "quotes",
    depth: 0,
    limit: 1,
    sort: "-version",
    overrideAccess: true,
    where: { and: [{ lead: { equals: leadId } }, { status: { not_equals: "superseded" } }] },
  });
  const existingQuote = existingQuotes.docs[0];
  if (existingQuote) {
    const contracts = await payload.find({
      collection: "contracts",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { quote: { equals: existingQuote.id } },
    });
    const calculationId = relationId(existingQuote.priceCalculation);
    const measurementId = relationId(existingQuote.measurement);
    if (contracts.docs[0] && calculationId && measurementId) {
      return {
        status: "ready",
        measurementId,
        calculationId,
        quoteId: existingQuote.id,
        contractId: contracts.docs[0].id,
        duplicate: true,
      };
    }
  }

  if (!usableAddress(lead.address)) {
    return markBlocked(payload, lead as typeof lead & Record<string, unknown>, "ADDRESS_REQUIRED", "Legg inn nøyaktig gateadresse og husnummer før automatisk takmåling.");
  }
  if (lead.inquiryType === "usikker") {
    return markBlocked(payload, lead as typeof lead & Record<string, unknown>, "SERVICE_REVIEW_REQUIRED", "Velg riktig tjeneste før pris og tilbud kan forberedes automatisk.");
  }

  const rules = await payload.find({
    collection: "price-rules",
    depth: 0,
    limit: 1,
    sort: "-version",
    overrideAccess: true,
    where: { and: [{ serviceKey: { equals: lead.inquiryType } }, { status: { equals: "approved" } }] },
  });
  const rule = rules.docs[0];
  if (!rule) {
    return markBlocked(payload, lead as typeof lead & Record<string, unknown>, "PRICE_RULE_NOT_FOUND", "Godkjent prisregel mangler for valgt tjeneste.");
  }

  const query = uniqueAddressParts([lead.address, lead.houseNumber, lead.postal, lead.city]).join(" ");
  const addresses = await (providers.addresses ?? new KartverketAddressProvider()).searchAddress(query);
  if (!addresses.length) {
    return markBlocked(payload, lead as typeof lead & Record<string, unknown>, "ADDRESS_NOT_FOUND", "Kartverket fant ikke adressen. Kontroller gate, husnummer og postnummer.");
  }
  const exactPostal = lead.postal ? addresses.filter((address) => address.postalCode === lead.postal) : addresses;
  const address = exactPostal[0] ?? addresses[0];
  const candidates = await (providers.buildings ?? new OpenStreetMapBuildingProvider()).findBuildings({
    latitude: address.latitude,
    longitude: address.longitude,
  });
  const selected = selectAutomaticBuildingCandidate(candidates);
  if (!selected.candidate) {
    const code = candidates.length ? "BUILDING_AMBIGUOUS" : "BUILDING_NOT_FOUND";
    const reason = candidates.length
      ? "Flere mulige bygg ble funnet. Administrator må velge riktig tak før beregning."
      : "Ingen brukbar bygningskontur ble funnet. Administrator må måle taket manuelt.";
    return markBlocked(payload, lead as typeof lead & Record<string, unknown>, code, reason);
  }

  const candidate = selected.candidate;
  const proposal = {
    buildingIdentifier: candidate.id,
    confidence: candidate.confidence,
    confidenceReasoning: `${candidate.confidenceReasoning} Automatisk forslag bruker foreløpig vinkelintervall 22–32° og må godkjennes før utsending.`,
    roofPlanes: [{
      id: `${candidate.id}-roof`,
      polygon: candidate.polygon,
      angleMinDegrees: 22,
      angleMaxDegrees: 32,
    }],
  } as const;
  const prepared = prepareMeasurement({
    proposal,
    addressResolved: true,
    sourceAuthorized: true,
    hasApprovedPriceRule: true,
  });
  if (!prepared.gate.allowed || !prepared.calculation) {
    return markBlocked(payload, lead as typeof lead & Record<string, unknown>, "BUILDING_AMBIGUOUS", `Automatisk måling ble blokkert: ${prepared.gate.reasons.join(", ")}`);
  }

  const previousMeasurements = await payload.find({
    collection: "roof-measurements",
    depth: 0,
    limit: 1,
    sort: "-version",
    overrideAccess: true,
    where: { lead: { equals: leadId } },
  });
  const previousMeasurement = previousMeasurements.docs[0];
  const version = (previousMeasurement?.version ?? 0) + 1;
  const measurement = await payload.create({
    collection: "roof-measurements",
    overrideAccess: true,
    data: {
      reference: `TM-${leadId}-V${version}`,
      lead: leadId,
      version,
      supersedes: previousMeasurement?.id,
      normalizedAddress: address.label,
      addressSourceId: address.id,
      latitude: address.latitude,
      longitude: address.longitude,
      buildingIdentifier: candidate.id,
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      license: candidate.license,
      credits: candidate.credits,
      imageryLicensed: true,
      capturedAt: new Date().toISOString(),
      roofPlanes: prepared.proposal.roofPlanes,
      horizontalAreaTenths: prepared.calculation.horizontalAreaTenths,
      actualAreaMinTenths: prepared.calculation.actualAreaMinTenths,
      actualAreaMaxTenths: prepared.calculation.actualAreaMaxTenths,
      calculationSnapshot: prepared.calculation,
      inputHash: prepared.inputHash,
      confidence: prepared.proposal.confidence,
      confidenceReasoning: prepared.proposal.confidenceReasoning,
      status: "review_required",
      blockingReasons: [],
    },
  });
  if (previousMeasurement && previousMeasurement.status !== "approved") {
    await payload.update({ collection: "roof-measurements", id: previousMeasurement.id, overrideAccess: true, data: { status: "superseded" } });
  }

  const snapshot = priceRuleSnapshot(rule);
  const calculated = calculatePrice(measurement.actualAreaMaxTenths, snapshot);
  const calculation = await payload.create({
    collection: "price-calculations",
    overrideAccess: true,
    data: {
      reference: `PB-${leadId}-${Date.now()}`,
      lead: leadId,
      measurement: measurement.id,
      priceRule: rule.id,
      inputSnapshot: { measurementHash: measurement.inputHash, measurementVersion: measurement.version, rule: snapshot },
      outputSnapshot: calculated,
      inputHash: calculated.inputHash,
      subtotalExVatOre: calculated.subtotalExVatOre,
      vatOre: calculated.vatOre,
      totalIncVatOre: calculated.totalIncVatOre,
      maximumTotalIncVatOre: calculated.maximumTotalIncVatOre,
      status: "ready",
      blockingReasons: [],
    },
  });
  const preparedDocuments = await createQuoteDraft(payload, calculation.id, new Date(), { allowPendingMeasurement: true });

  const draftReplies = await payload.find({
    collection: "messages",
    depth: 0,
    limit: 20,
    overrideAccess: true,
    where: { and: [
      { lead: { equals: leadId } },
      { category: { equals: "ai_reply" } },
      { status: { equals: "draft" } },
    ] },
  });
  for (const message of draftReplies.docs) {
    await payload.update({ collection: "messages", id: message.id, overrideAccess: true, data: { status: "cancelled" } });
  }

  const qualification = lead.qualification && typeof lead.qualification === "object"
    ? lead.qualification as Record<string, unknown>
    : {};
  await payload.update({
    collection: "leads",
    id: lead.id,
    overrideAccess: true,
    data: {
      status: "measuring",
      qualification: {
        ...qualification,
        packagePreparation: {
          status: "ready_for_admin_review",
          measurementId: measurement.id,
          calculationId: calculation.id,
          quoteId: preparedDocuments.quote.id,
          contractId: preparedDocuments.contract.id,
          preparedAt: new Date().toISOString(),
        },
      },
      nextAction: "Kontroller automatisk takmåling, pris, tilbud og kontrakt. Godkjenn deretter hele pakken for utsending.",
      nextActionAt: new Date().toISOString(),
    },
  });

  return {
    status: "ready",
    measurementId: measurement.id,
    calculationId: calculation.id,
    quoteId: preparedDocuments.quote.id,
    contractId: preparedDocuments.contract.id,
    duplicate: false,
  };
}

export async function overridePreparedLeadArea(
  payload: Payload,
  input: {
    measurementId: number;
    administratorId: number;
    areaSquareMeters: number;
    reason: string;
  },
) {
  const current = await payload.findByID({
    collection: "roof-measurements",
    id: input.measurementId,
    depth: 0,
    overrideAccess: true,
  });
  if (!["draft", "review_required"].includes(current.status)) {
    throw new TypeError("Only a measurement awaiting review can be overridden");
  }
  const leadId = relationId(current.lead);
  if (!leadId) throw new TypeError("Measurement lead is missing");
  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  const [quotes, rules] = await Promise.all([
    payload.find({
      collection: "quotes",
      depth: 0,
      limit: 1,
      sort: "-version",
      overrideAccess: true,
      where: { and: [{ lead: { equals: leadId } }, { status: { not_equals: "superseded" } }] },
    }),
    payload.find({
      collection: "price-rules",
      depth: 0,
      limit: 1,
      sort: "-version",
      overrideAccess: true,
      where: { and: [{ serviceKey: { equals: lead.inquiryType } }, { status: { equals: "approved" } }] },
    }),
  ]);
  const previousQuote = quotes.docs[0];
  if (!previousQuote || previousQuote.status !== "draft") {
    throw new TypeError("The roof area can only be overridden before the quote is sent");
  }
  const rule = rules.docs[0];
  if (!rule) throw new TypeError("No approved price rule exists for this service");

  const areaTenths = Math.round(input.areaSquareMeters * 10);
  const overriddenAt = new Date().toISOString();
  const previousCalculation = current.calculationSnapshot && typeof current.calculationSnapshot === "object"
    ? current.calculationSnapshot as Record<string, unknown>
    : {};
  const calculationSnapshot = {
    ...previousCalculation,
    horizontalAreaTenths: current.horizontalAreaTenths,
    actualAreaMinTenths: areaTenths,
    actualAreaMaxTenths: areaTenths,
    manualOverride: {
      areaSquareMeters: input.areaSquareMeters,
      areaTenths,
      reason: input.reason,
      administratorId: input.administratorId,
      overriddenAt,
      previousMeasurementId: current.id,
      previousInputHash: current.inputHash,
    },
  };
  const versionData = nextMeasurementVersion(
    current as unknown as Record<string, unknown> & { id: number; version: number; lead: unknown; reference: string },
    {
      actualAreaMinTenths: areaTenths,
      actualAreaMaxTenths: areaTenths,
      calculationSnapshot,
      confidence: "high",
      confidenceReasoning: `Takarealet er manuelt kontrollert av administrator: ${input.reason}`,
      blockingReasons: [],
    },
    new Date(overriddenAt),
  );
  const createData = { ...versionData } as Record<string, unknown>;
  for (const key of ["id", "createdAt", "updatedAt"]) delete createData[key];

  let measurement: RoofMeasurement | null = null;
  let calculation: PriceCalculation | null = null;
  try {
    measurement = await payload.create({
      collection: "roof-measurements",
      overrideAccess: true,
      data: createData as never,
    });
    const snapshot = priceRuleSnapshot(rule);
    const calculated = calculatePrice(areaTenths, snapshot);
    calculation = await payload.create({
      collection: "price-calculations",
      overrideAccess: true,
      data: {
        reference: `PB-${leadId}-${Date.now()}`,
        lead: leadId,
        measurement: measurement.id,
        priceRule: rule.id,
        inputSnapshot: { measurementHash: measurement.inputHash, measurementVersion: measurement.version, rule: snapshot, manualAreaOverride: true },
        outputSnapshot: calculated,
        inputHash: calculated.inputHash,
        subtotalExVatOre: calculated.subtotalExVatOre,
        vatOre: calculated.vatOre,
        totalIncVatOre: calculated.totalIncVatOre,
        maximumTotalIncVatOre: calculated.maximumTotalIncVatOre,
        status: "ready",
        blockingReasons: [],
      },
    });
    const preparedDocuments = await createQuoteDraft(payload, calculation.id, new Date(overriddenAt), { allowPendingMeasurement: true });
    await payload.update({ collection: "roof-measurements", id: current.id, overrideAccess: true, data: { status: "superseded" } });

    const qualification = lead.qualification && typeof lead.qualification === "object"
      ? lead.qualification as Record<string, unknown>
      : {};
    await payload.update({
      collection: "leads",
      id: leadId,
      overrideAccess: true,
      data: {
        status: "measuring",
        qualification: {
          ...qualification,
          packagePreparation: {
            status: "ready_for_admin_review",
            measurementId: measurement.id,
            calculationId: calculation.id,
            quoteId: preparedDocuments.quote.id,
            contractId: preparedDocuments.contract.id,
            preparedAt: overriddenAt,
            manualAreaOverride: true,
          },
        },
        nextAction: "Kontroller manuelt overstyrt takareal, maksimalpris, tilbud og kontrakt. Godkjenn deretter hele pakken for utsending.",
        nextActionAt: overriddenAt,
      },
    });
    return {
      measurementId: measurement.id,
      calculationId: calculation.id,
      quoteId: preparedDocuments.quote.id,
      contractId: preparedDocuments.contract.id,
      areaSquareMeters: input.areaSquareMeters,
    };
  } catch (error) {
    if (calculation) await payload.delete({ collection: "price-calculations", id: calculation.id, overrideAccess: true }).catch(() => undefined);
    if (measurement) await payload.delete({ collection: "roof-measurements", id: measurement.id, overrideAccess: true }).catch(() => undefined);
    throw error;
  }
}

export async function approveAndSendPreparedLeadPackage(
  payload: Payload,
  leadId: number,
  administratorId: number,
  correlationId: string,
) {
  const [measurements, quotes] = await Promise.all([
    payload.find({
      collection: "roof-measurements",
      depth: 0,
      limit: 1,
      sort: "-version",
      overrideAccess: true,
      where: { and: [{ lead: { equals: leadId } }, { status: { not_equals: "superseded" } }] },
    }),
    payload.find({
      collection: "quotes",
      depth: 0,
      limit: 1,
      sort: "-version",
      overrideAccess: true,
      where: { and: [{ lead: { equals: leadId } }, { status: { not_equals: "superseded" } }] },
    }),
  ]);
  const measurement = measurements.docs[0];
  const quote = quotes.docs[0];
  if (!measurement || !quote) throw new TypeError("Prepared measurement and quote are required");
  if (!["draft", "review_required", "approved"].includes(measurement.status)) {
    throw new TypeError("Prepared roof measurement is not ready for approval");
  }
  if (quote.status !== "draft") throw new TypeError("Prepared quote must still be a draft");
  if (relationId(quote.measurement) !== measurement.id) {
    throw new TypeError("The quote is based on an older roof measurement. Recalculate the package first");
  }

  const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
  const rules = await payload.find({
    collection: "price-rules",
    depth: 0,
    limit: 1,
    sort: "-version",
    overrideAccess: true,
    where: { and: [{ serviceKey: { equals: lead.inquiryType } }, { status: { equals: "approved" } }] },
  });
  const rule = rules.docs[0];
  const prepared = prepareMeasurement({
    proposal: {
      buildingIdentifier: measurement.buildingIdentifier ?? null,
      confidence: measurement.confidence,
      confidenceReasoning: measurement.confidenceReasoning,
      roofPlanes: measurement.roofPlanes,
    },
    addressResolved: Boolean(measurement.addressSourceId),
    sourceAuthorized: measurement.imageryLicensed === true,
    hasApprovedPriceRule: Boolean(rule),
  });
  if (!prepared.gate.allowed) {
    throw new TypeError(`Roof measurement is blocked: ${prepared.gate.reasons.join(", ")}`);
  }
  if (documentHash(quote.snapshot) !== quote.snapshotHash) {
    throw new TypeError("Quote snapshot hash mismatch");
  }

  if (measurement.status !== "approved") {
    await payload.update({
      collection: "roof-measurements",
      id: measurement.id,
      overrideAccess: true,
      data: {
        status: "approved",
        approvedBy: administratorId,
        approvedAt: new Date().toISOString(),
        blockingReasons: [],
      },
    });
  }
  const approvedQuote = await payload.update({
    collection: "quotes",
    id: quote.id,
    overrideAccess: true,
    context: { trustedQuoteApproval: true },
    data: {
      status: "approved",
      approvedBy: administratorId,
      approvedAt: new Date().toISOString(),
    },
  });
  const issued = await issueQuoteCustomerLink(payload, approvedQuote.id);
  const now = new Date().toISOString();
  const queued = await payload.update({
    collection: "messages",
    id: issued.message.id,
    overrideAccess: true,
    data: {
      status: "queued",
      approvedBy: administratorId,
      approvedAt: now,
      queuedAt: now,
    },
  });
  await enqueueMessageJob(payload, queued.id, correlationId);

  let sent = false;
  const provider = createEmailProvider();
  if (provider.health().status === "ready") {
    try {
      await deliverMessage(payload, provider, queued.id, correlationId);
      sent = true;
    } catch {
      // The durable outbox job remains queued and the administrator sees its
      // delivery state in the case timeline.
    }
  }
  await payload.update({
    collection: "leads",
    id: leadId,
    overrideAccess: true,
    data: {
      status: "quoted",
      nextAction: sent
        ? "Vent på at kunden åpner, godtar, spør eller avslår tilbudet."
        : "Tilbudet er godkjent, men e-posten står i kø. Kontroller leveringsstatus.",
      nextActionAt: sent ? new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString() : now,
    },
  });
  return {
    measurementId: measurement.id,
    quoteId: approvedQuote.id,
    contractId: issued.contract.id,
    messageId: queued.id,
    sent,
  };
}
