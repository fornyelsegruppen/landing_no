import type { Payload } from "payload";
import { deriveCaseCommercialContext } from "./case-commercial-context";

export class StaleCommercialContextError extends TypeError {
  currentReference?: string;

  constructor(message: string, currentReference?: string) {
    super(message);
    this.name = "StaleCommercialContextError";
    this.currentReference = currentReference;
  }
}

export function assertExpectedDocumentHash(input: {
  expectedDocumentHash?: string;
  currentDocumentHash?: string;
  currentReference?: string;
}) {
  if (
    input.expectedDocumentHash &&
    input.currentDocumentHash !== input.expectedDocumentHash
  ) {
    throw new StaleCommercialContextError(
      input.currentReference
        ? `Dokumentet ${input.currentReference} er oppdatert. Oppdater siden før du fortsetter.`
        : "Dokumentet er oppdatert. Oppdater siden før du fortsetter.",
      input.currentReference,
    );
  }
}

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  )
    return (value as { id: number }).id;
  return undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

async function loadCommercialContext(payload: Payload, leadId: number) {
  const quotesResult = await payload.find({
    collection: "quotes",
    depth: 0,
    limit: 100,
    overrideAccess: true,
    sort: "-version",
    where: { lead: { equals: leadId } },
  });
  const quotes = quotesResult.docs;
  const quoteIds = quotes.map((item) => Number(item.id));
  const contractsResult = quoteIds.length
    ? await payload.find({
        collection: "contracts",
        depth: 0,
        limit: 100,
        overrideAccess: true,
        sort: "-version",
        where: { quote: { in: quoteIds } },
      })
    : { docs: [] };

  return deriveCaseCommercialContext(
    quotes.map((item) => ({
      id: Number(item.id),
      reference: item.reference,
      version: item.version,
      status: item.status,
      supersedesId: relationId(item.supersedes),
    })),
    contractsResult.docs.map((item) => ({
      id: Number(item.id),
      quoteId: relationId(item.quote),
      reference: item.reference,
      version: item.version,
      status: item.status,
      supersedesId: relationId(item.supersedes),
      signedAt: stringValue(item.signedAt),
      companySignedAt: stringValue(item.companySignedAt),
      signedDocumentId: relationId(item.signedDocument),
      companySignedDocumentId: relationId(item.companySignedDocument),
    })),
  );
}

export async function assertCurrentQuoteTarget(
  payload: Payload,
  input: { leadId: number; quoteId: number; expectedVersion?: number },
) {
  const context = await loadCommercialContext(payload, input.leadId);
  const current = context.workingQuote;
  if (
    !current ||
    current.id !== input.quoteId ||
    (input.expectedVersion !== undefined &&
      current.version !== input.expectedVersion)
  ) {
    throw new StaleCommercialContextError(
      current
        ? `Saken er oppdatert. Gjeldende tilbud er ${current.reference}. Oppdater siden før du fortsetter.`
        : "Saken er oppdatert og har ikke lenger et aktivt tilbud. Oppdater siden før du fortsetter.",
      current?.reference,
    );
  }
  return context;
}

export async function assertCurrentContractTarget(
  payload: Payload,
  input: { leadId: number; contractId: number; expectedVersion?: number },
) {
  const context = await loadCommercialContext(payload, input.leadId);
  const current = context.workingContract;
  if (
    !current ||
    current.id !== input.contractId ||
    (input.expectedVersion !== undefined &&
      current.version !== input.expectedVersion)
  ) {
    throw new StaleCommercialContextError(
      current
        ? `Saken er oppdatert. Gjeldende kontrakt er ${current.reference}. Oppdater siden før du fortsetter.`
        : "Saken er oppdatert og har ikke lenger en aktiv kontrakt. Oppdater siden før du fortsetter.",
      current?.reference,
    );
  }
  return context;
}

export async function assertWorkOrderContractTarget(
  payload: Payload,
  input: { leadId: number; contractId: number },
) {
  const context = await loadCommercialContext(payload, input.leadId);
  const effective = context.effectiveContract;
  const working = context.workingContract;
  if (!effective || effective.id !== input.contractId) {
    throw new StaleCommercialContextError(
      effective
        ? `Arbeidsordren må opprettes fra gjeldende kontrakt ${effective.reference}.`
        : "Arbeidsordren kan ikke opprettes før samme kontrakt er signert av begge parter.",
      effective?.reference,
    );
  }
  if (working && working.id !== effective.id) {
    throw new StaleCommercialContextError(
      `En nyere kontraktsversjon, ${working.reference}, er under behandling. Avklar den før arbeidsordren opprettes.`,
      working.reference,
    );
  }
  return context;
}

export function commercialTargetMetadata(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    expectedVersion: numberValue(record.expectedVersion),
  };
}
