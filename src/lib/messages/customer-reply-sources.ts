import type { Payload } from "payload";
import { documentHash, quoteSnapshotSchema } from "@/lib/quotes/document";
import type {
  CustomerReplyContext,
  CustomerReplyPurpose,
} from "./customer-reply";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  ) {
    return (value as { id: number }).id;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export type CustomerReplySourceBundle = {
  context: CustomerReplyContext;
  fingerprint: string;
  snapshot: Record<string, unknown>;
};

export async function loadCustomerReplySourceBundle(
  payload: Payload,
  input: {
    leadId: number;
    purpose: CustomerReplyPurpose;
    sourceMessageId: number;
  },
): Promise<CustomerReplySourceBundle> {
  const source = await payload.findByID({
    collection: "messages",
    id: input.sourceMessageId,
    depth: 0,
    overrideAccess: true,
  });
  if (
    relationId(source.lead) !== input.leadId ||
    source.direction !== "inbound"
  ) {
    throw new TypeError(
      "Reply source must be an inbound message in the same customer case",
    );
  }

  const lead = await payload.findByID({
    collection: "leads",
    id: input.leadId,
    depth: 0,
    overrideAccess: true,
  });
  if (lead.status === "closed" || lead.recordState !== "active") {
    throw new TypeError(
      "A reply draft cannot be generated for a closed or archived case",
    );
  }
  const sourceAnalysis = record(source.aiAnalysis);
  const sourceQuoteId =
    typeof sourceAnalysis.quoteId === "number" ? sourceAnalysis.quoteId : null;
  const sourceContractId =
    typeof sourceAnalysis.contractId === "number"
      ? sourceAnalysis.contractId
      : null;

  const now = new Date();
  const [measurements, quotes, workOrders, activeTerms, services, priceRules] =
    await Promise.all([
      payload.find({
        collection: "roof-measurements",
        depth: 0,
        limit: 1,
        sort: "-version",
        overrideAccess: true,
        where: {
          and: [
            { lead: { equals: lead.id } },
            { status: { equals: "approved" } },
          ],
        },
      }),
      sourceQuoteId
        ? payload
            .findByID({
              collection: "quotes",
              id: sourceQuoteId,
              depth: 0,
              overrideAccess: true,
            })
            .then((quote) => ({ docs: [quote] }))
        : payload.find({
            collection: "quotes",
            depth: 0,
            limit: 1,
            sort: "-version",
            overrideAccess: true,
            where: {
              and: [
                { lead: { equals: lead.id } },
                { status: { not_equals: "superseded" } },
              ],
            },
          }),
      payload.find({
        collection: "work-orders",
        depth: 0,
        limit: 1,
        sort: "-createdAt",
        overrideAccess: true,
        where: { lead: { equals: lead.id } },
      }),
      payload.find({
        collection: "contract-terms",
        depth: 0,
        limit: 1,
        sort: "-approvedAt",
        overrideAccess: true,
        where: { status: { equals: "approved" } },
      }),
      payload.find({
        collection: "services",
        depth: 0,
        limit: 20,
        overrideAccess: true,
        pagination: false,
        where: { _status: { equals: "published" } },
      }),
      payload.find({
        collection: "price-rules",
        depth: 0,
        limit: 100,
        overrideAccess: true,
        pagination: false,
        sort: "-version",
        where: { status: { equals: "approved" } },
      }),
    ]);

  const measurement = measurements.docs[0];
  const quote = quotes.docs[0];
  if (quote && relationId(quote.lead) !== lead.id) {
    throw new TypeError(
      "The referenced quote does not belong to this customer case",
    );
  }
  const workOrder = workOrders.docs[0];
  const contracts = sourceContractId
    ? {
        docs: [
          await payload.findByID({
            collection: "contracts",
            id: sourceContractId,
            depth: 0,
            overrideAccess: true,
          }),
        ],
      }
    : quote
      ? await payload.find({
          collection: "contracts",
          depth: 0,
          limit: 1,
          sort: "-version",
          overrideAccess: true,
          where: { quote: { equals: quote.id } },
        })
      : { docs: [] };
  const contract = contracts.docs[0];
  if (contract && quote && relationId(contract.quote) !== quote.id) {
    throw new TypeError(
      "The referenced contract does not belong to the referenced quote",
    );
  }
  const parsedQuote = quote
    ? quoteSnapshotSchema.safeParse(quote.snapshot)
    : null;
  const quoteSnapshot = parsedQuote?.success ? parsedQuote.data : null;
  const contractSnapshot = record(contract?.snapshot);
  const caseTerms = record(contractSnapshot.terms);
  const currentTerms = activeTerms.docs[0];

  const currentRules = priceRules.docs
    .filter((rule) => {
      const from = new Date(rule.validFrom).getTime();
      const to = rule.validTo ? new Date(rule.validTo).getTime() : Infinity;
      return from <= now.getTime() && now.getTime() < to;
    })
    .map((rule) => ({
      id: rule.id,
      reference: rule.reference,
      serviceKey: rule.serviceKey,
      termsVersion: rule.termsVersion,
      unitPriceExVatOre: rule.unitPriceExVatOre,
      validFrom: rule.validFrom,
      validTo: rule.validTo || undefined,
      version: rule.version,
    }))
    .sort((left, right) =>
      [left.serviceKey, left.version, left.id]
        .map(String)
        .join(":")
        .localeCompare(
          [right.serviceKey, right.version, right.id].map(String).join(":"),
        ),
    );

  const publishedServices = services.docs
    .map((service) => ({
      id: service.id,
      key: service.key,
      title: service.titleNo,
      description: service.descriptionNo,
      updatedAt: service.updatedAt,
    }))
    .sort((left, right) =>
      [left.key, left.id]
        .map(String)
        .join(":")
        .localeCompare([right.key, right.id].map(String).join(":")),
    );

  const measurementContext = quoteSnapshot
    ? {
        reference: `TM-${lead.id}-V${quoteSnapshot.measurement.version}`,
        areaMinTenths: quoteSnapshot.measurement.actualAreaMinTenths,
        areaMaxTenths: quoteSnapshot.measurement.actualAreaMaxTenths,
      }
    : measurement
      ? {
          reference: measurement.reference,
          areaMinTenths: measurement.actualAreaMinTenths,
          areaMaxTenths: measurement.actualAreaMaxTenths,
        }
      : undefined;

  const maximum =
    quoteSnapshot?.pricing.maximumTotalIncVatOre ??
    quote?.maximumTotalIncVatOre;
  const context: CustomerReplyContext = {
    purpose: input.purpose,
    customerMessage: source.bodyText,
    service: lead.inquiryType,
    ...(measurementContext ? { measurement: measurementContext } : {}),
    ...(quote
      ? {
          quote: {
            reference: quote.reference,
            status: quote.status,
            totalIncVatOre:
              quoteSnapshot?.pricing.totalIncVatOre ?? quote.totalIncVatOre,
            ...(typeof maximum === "number"
              ? { maximumTotalIncVatOre: maximum }
              : {}),
            validUntil: quote.validUntil,
            version: quote.version,
            serviceDescription:
              quoteSnapshot?.serviceDescription || quote.serviceDescription,
            termsVersion: quote.termsVersion,
          },
        }
      : {}),
    ...(contract
      ? {
          contract: {
            reference: contract.reference,
            status: contract.status,
            companySigned: Boolean(contract.companySignedAt),
            version: contract.version,
            termsVersion: contract.termsVersion,
          },
        }
      : {}),
    ...(workOrder
      ? {
          workOrder: {
            reference: workOrder.reference,
            status: workOrder.status,
            ...(workOrder.scheduledAt
              ? { scheduledAt: workOrder.scheduledAt }
              : {}),
            ...(workOrder.arrivalWindow
              ? { arrivalWindow: workOrder.arrivalWindow }
              : {}),
          },
        }
      : {}),
    businessSources: {
      retrievedAt: now.toISOString(),
      caseTerms: text(caseTerms.version)
        ? {
            version: text(caseTerms.version)!,
            text: text(caseTerms.text) || "",
            withdrawalInstructions:
              text(caseTerms.withdrawalInstructions) || "",
          }
        : undefined,
      activeTerms: currentTerms
        ? {
            version: currentTerms.version,
            title: currentTerms.title,
            text: currentTerms.contractText,
            withdrawalInstructions: currentTerms.withdrawalInstructions,
          }
        : undefined,
      services: publishedServices,
      priceRules: currentRules,
    },
  };

  const snapshot = {
    sourceMessage: { id: source.id, updatedAt: source.updatedAt },
    lead: { id: lead.id, inquiryType: lead.inquiryType },
    measurement:
      !quoteSnapshot && measurement
        ? {
            actualAreaMaxTenths: measurement.actualAreaMaxTenths,
            actualAreaMinTenths: measurement.actualAreaMinTenths,
            id: measurement.id,
            reference: measurement.reference,
            status: measurement.status,
            version: measurement.version,
          }
        : null,
    quote: quote
      ? {
          id: quote.id,
          maximumTotalIncVatOre: quote.maximumTotalIncVatOre,
          reference: quote.reference,
          serviceDescription: quote.serviceDescription,
          snapshotHash: quote.snapshotHash,
          status: quote.status,
          termsVersion: quote.termsVersion,
          totalIncVatOre: quote.totalIncVatOre,
          validUntil: quote.validUntil,
          version: quote.version,
        }
      : null,
    contract: contract
      ? {
          documentHash: contract.documentHash,
          id: contract.id,
          reference: contract.reference,
          status: contract.status,
          companySignedAt: contract.companySignedAt,
          termsVersion: contract.termsVersion,
          version: contract.version,
        }
      : null,
    workOrder: workOrder
      ? {
          arrivalWindow: workOrder.arrivalWindow,
          id: workOrder.id,
          reference: workOrder.reference,
          scheduledAt: workOrder.scheduledAt,
          status: workOrder.status,
        }
      : null,
    activeTerms: currentTerms
      ? {
          approvedAt: currentTerms.approvedAt,
          id: currentTerms.id,
          updatedAt: currentTerms.updatedAt,
          version: currentTerms.version,
        }
      : null,
    priceRules: currentRules.map((rule) => ({
      id: rule.id,
      reference: rule.reference,
      serviceKey: rule.serviceKey,
      termsVersion: rule.termsVersion,
      unitPriceExVatOre: rule.unitPriceExVatOre,
      validFrom: rule.validFrom,
      validTo: rule.validTo,
      version: rule.version,
    })),
    services: publishedServices.map((service) => ({
      id: service.id,
      key: service.key,
      title: service.title,
      description: service.description,
      updatedAt: service.updatedAt,
    })),
  };

  return { context, fingerprint: documentHash(snapshot), snapshot };
}

export async function assertCustomerReplySourcesCurrent(
  payload: Payload,
  message: {
    aiAnalysis?: unknown;
    lead?: unknown;
    replyToMessage?: unknown;
  },
) {
  const analysis = record(message.aiAnalysis);
  const purpose = analysis.purpose;
  const leadId = relationId(message.lead);
  const sourceMessageId = relationId(message.replyToMessage);
  if (
    !leadId ||
    !sourceMessageId ||
    !["question", "decline", "cancellation"].includes(String(purpose))
  ) {
    return null;
  }
  const current = await loadCustomerReplySourceBundle(payload, {
    leadId,
    purpose: purpose as CustomerReplyPurpose,
    sourceMessageId,
  });
  if (
    typeof analysis.replySourceFingerprint !== "string" ||
    analysis.replySourceFingerprint !== current.fingerprint
  ) {
    throw new TypeError(
      "The case documents, prices or active company terms changed after this draft was generated. Create a new reply draft before sending.",
    );
  }
  return current;
}
