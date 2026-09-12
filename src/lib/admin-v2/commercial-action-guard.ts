import type { Payload } from "payload";
import {
  deriveCaseCommercialContext,
  type CaseCommercialContext,
} from "./case-commercial-context";
import {
  loadCaseCurrentSelection,
  type CaseCurrentSelection,
} from "./case-current-selection";
import { AdminReadError, type AdminReadUser } from "./admin-read-db";

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

type GuardPayload = Pick<Payload, "db" | "findByID">;
type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" ? (value as RawRecord) : {};
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

function quoteInput(raw: RawRecord) {
  return {
    id: Number(raw.id),
    reference: stringValue(raw.reference),
    version: numberValue(raw.version),
    status: stringValue(raw.status),
    supersedesId: relationId(raw.supersedes),
    createdAt: stringValue(raw.createdAt),
    documentHash: stringValue(raw.snapshotHash),
  };
}

function contractInput(raw: RawRecord) {
  return {
    id: Number(raw.id),
    quoteId: relationId(raw.quote),
    reference: stringValue(raw.reference),
    version: numberValue(raw.version),
    status: stringValue(raw.status),
    supersedesId: relationId(raw.supersedes),
    signedAt: stringValue(raw.signedAt),
    companySignedAt: stringValue(raw.companySignedAt),
    signedDocumentId: relationId(raw.signedDocument),
    companySignedDocumentId: relationId(raw.companySignedDocument),
    createdAt: stringValue(raw.createdAt),
    documentHash: stringValue(raw.documentHash),
  };
}

type GuardRead = {
  context: CaseCommercialContext;
  selection: CaseCurrentSelection;
};

/**
 * Read only the IDs selected by the bounded current-state query, then hydrate
 * those records individually. This replaces the old capped collection scans;
 * no action guard depends on the first 100 commercial records.
 */
async function loadCommercialContext(
  payload: GuardPayload,
  user: AdminReadUser,
  leadId: number,
): Promise<GuardRead> {
  if (
    !user?.active ||
    user.role !== "admin" ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0
  ) {
    throw new AdminReadError("ADMIN_REQUIRED");
  }
  const selection = await loadCaseCurrentSelection(payload, user, leadId);
  const quoteIds = new Set<number>();
  if (selection.workingQuoteId) quoteIds.add(selection.workingQuoteId);
  const contractIds = new Set<number>();
  if (selection.workingContractId) contractIds.add(selection.workingContractId);
  if (selection.effectiveContractId)
    contractIds.add(selection.effectiveContractId);

  const find = async (collection: "quotes" | "contracts", id: number) => {
    const value = asRecord(
      await payload.findByID({
        collection,
        id,
        depth: 0,
        overrideAccess: true,
      }),
    );
    if (!Object.keys(value).length || Number(value.id) !== id) {
      throw new StaleCommercialContextError(
        `Saken er oppdatert. Gjeldende ${collection === "quotes" ? "tilbud" : "kontrakt"} finnes ikke lenger. Oppdater siden før du fortsetter.`,
      );
    }
    if (collection === "quotes" && relationId(value.lead) !== leadId) {
      throw new StaleCommercialContextError(
        "Saken er oppdatert. Tilbudet tilhører ikke denne saken. Oppdater siden før du fortsetter.",
      );
    }
    return value;
  };

  const contracts = await Promise.all(
    [...contractIds].map((id) => find("contracts", id)),
  );
  for (const contract of contracts) {
    const quoteId = relationId(contract.quote);
    if (quoteId) quoteIds.add(quoteId);
  }
  const quotes = await Promise.all(
    [...quoteIds].map((id) => find("quotes", id)),
  );
  const ownedQuoteIds = new Set(quotes.map((quote) => Number(quote.id)));
  for (const contract of contracts) {
    const quoteId = relationId(contract.quote);
    if (!quoteId || !ownedQuoteIds.has(quoteId)) {
      throw new StaleCommercialContextError(
        "Saken er oppdatert. Kontrakten tilhører ikke denne saken. Oppdater siden før du fortsetter.",
      );
    }
  }

  return {
    selection,
    context: deriveCaseCommercialContext(
      quotes.map(quoteInput),
      contracts.map(contractInput),
    ),
  };
}

export async function assertCurrentQuoteTarget(
  payload: GuardPayload,
  user: AdminReadUser,
  input: { leadId: number; quoteId: number; expectedVersion?: number },
) {
  const { context, selection } = await loadCommercialContext(
    payload,
    user,
    input.leadId,
  );
  const current = context.workingQuote;
  if (
    selection.workingQuoteId !== input.quoteId ||
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
  payload: GuardPayload,
  user: AdminReadUser,
  input: { leadId: number; contractId: number; expectedVersion?: number },
) {
  const { context, selection } = await loadCommercialContext(
    payload,
    user,
    input.leadId,
  );
  const current = context.workingContract;
  if (
    selection.workingContractId !== input.contractId ||
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
  payload: GuardPayload,
  user: AdminReadUser,
  input: { leadId: number; contractId: number; expectedVersion?: number },
) {
  const { context, selection } = await loadCommercialContext(
    payload,
    user,
    input.leadId,
  );
  const effective = context.effectiveContract;
  const working = context.workingContract;
  if (
    selection.effectiveContractId !== input.contractId ||
    !effective ||
    effective.id !== input.contractId ||
    (input.expectedVersion !== undefined &&
      effective.version !== input.expectedVersion)
  ) {
    throw new StaleCommercialContextError(
      effective
        ? `Arbeidsordren må opprettes fra gjeldende kontrakt ${effective.reference}.`
        : "Arbeidsordren kan ikke opprettes før samme kontrakt er signert av begge parter.",
      effective?.reference,
    );
  }
  if (
    (selection.workingContractId !== null &&
      selection.workingContractId !== selection.effectiveContractId) ||
    (working && working.id !== effective.id)
  ) {
    const workingReference = working?.reference || effective.reference;
    throw new StaleCommercialContextError(
      `En nyere kontraktsversjon, ${workingReference}, er under behandling. Avklar den før arbeidsordren opprettes.`,
      workingReference,
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
