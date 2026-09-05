import { createHash } from "node:crypto";
import { sql } from "@payloadcms/db-postgres";
import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
  type Where,
} from "payload";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { parseRoofSnapshotV1 } from "@/lib/roof-fusion/roof-snapshot-v1";
import {
  isPreviewCaseAddressCommandEnabled,
  type PreviewCaseAddressEnvironment,
} from "./preview-case-address-feature";

export const PREVIEW_CASE_ADDRESS_COMMAND_VERSION =
  "preview-case-address-command.v1" as const;
export const PREVIEW_CASE_ADDRESS_COMMAND_RESULT_VERSION =
  "preview-case-address-command-result.v1" as const;

const identifier = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const correlationIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

export const previewCaseAddressCommandSchema = z
  .object({
    schemaVersion: z.literal(PREVIEW_CASE_ADDRESS_COMMAND_VERSION),
    leadId: z.number().int().positive(),
    expectedCaseRevision: z.number().int().positive(),
    expectedAddressRevision: z.number().int().positive(),
    idempotencyKey: identifier,
    correlationId: correlationIdentifier,
    actorId: z.number().int().positive(),
    reasonCode: z.enum([
      "operator_correction",
      "customer_confirmation",
      "provider_resolution",
      "data_quality_recovery",
    ]),
    address: z
      .object({
        street: z.string().trim().min(2).max(200),
        houseNumber: z.string().trim().min(1).max(30).nullable(),
        postalCode: z.string().regex(/^\d{4}$/u),
        city: z.string().trim().min(2).max(100).nullable(),
      })
      .strict(),
  })
  .strict();

export type PreviewCaseAddressCommand = z.infer<
  typeof previewCaseAddressCommandSchema
>;

export type PreviewCaseAddressCommandErrorCode =
  | "ADDRESS_REVISION_CONFLICT"
  | "CASE_NOT_FOUND"
  | "CASE_REVISION_CONFLICT"
  | "FEATURE_DISABLED"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_COMMAND"
  | "NO_CHANGE"
  | "PREVIEW_REQUIRED"
  | "REPOSITORY_INTEGRITY"
  | "TRANSACTION_REQUIRED";

const errorStatus: Record<PreviewCaseAddressCommandErrorCode, number> = {
  ADDRESS_REVISION_CONFLICT: 409,
  CASE_NOT_FOUND: 404,
  CASE_REVISION_CONFLICT: 409,
  FEATURE_DISABLED: 404,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_COMMAND: 400,
  NO_CHANGE: 422,
  PREVIEW_REQUIRED: 404,
  REPOSITORY_INTEGRITY: 500,
  TRANSACTION_REQUIRED: 500,
};

export class PreviewCaseAddressCommandError extends Error {
  readonly suggestedHttpStatus: number;

  constructor(
    readonly code: PreviewCaseAddressCommandErrorCode,
    message: string,
    readonly expectedRevision?: number,
    readonly actualRevision?: number,
  ) {
    super(message);
    this.name = "PreviewCaseAddressCommandError";
    this.suggestedHttpStatus = errorStatus[code];
  }
}

export function assertPreviewCaseAddressCommandEnabled(
  environment: PreviewCaseAddressEnvironment = process.env,
) {
  if (environment.VERCEL_ENV !== "preview") {
    throw new PreviewCaseAddressCommandError(
      "PREVIEW_REQUIRED",
      "Preview case address command is unavailable",
    );
  }
  if (!isPreviewCaseAddressCommandEnabled(environment)) {
    throw new PreviewCaseAddressCommandError(
      "FEATURE_DISABLED",
      "Preview case address command is unavailable",
    );
  }
}

export type PreviewCaseAddress = PreviewCaseAddressCommand["address"];

export type PreviewCaseAddressCommandResult = {
  schemaVersion: typeof PREVIEW_CASE_ADDRESS_COMMAND_RESULT_VERSION;
  status: "applied" | "replayed";
  case: {
    id: number;
    caseRevision: number;
    addressRevision: number;
  };
  address: PreviewCaseAddress;
  rfInvalidation:
    | { status: "not_applicable" }
    | {
        status: "invalidated";
        snapshot: { id: string; revision: number; hash: string };
      };
  commercialDraftInvalidation:
    | { status: "not_applicable"; quoteIds: []; contractIds: [] }
    | {
        status: "invalidated";
        quoteIds: number[];
        contractIds: number[];
      };
};

type TransactionRequest = Partial<PayloadRequest> & { payload: Payload };

type PostgresRowLockTransaction = {
  select(fields: { id: unknown }): {
    from(table: unknown): {
      where(condition: ReturnType<typeof sql>): {
        for(strength: "update"): Promise<Array<{ id: unknown }>>;
      };
    };
  };
};

type PostgresRowLockAdapter = {
  packageName?: string;
  sessions?: Record<
    string,
    { db?: PostgresRowLockTransaction } | undefined
  >;
  tables?: Record<string, { id: unknown } | undefined>;
};

async function lockLeadAddressRow(
  payload: Payload,
  req: TransactionRequest,
  leadId: number,
) {
  const transactionId = await req.transactionID;
  const adapter = payload.db as unknown as PostgresRowLockAdapter;
  const transaction = transactionId
    ? adapter.sessions?.[String(transactionId)]?.db
    : undefined;
  const table = adapter.tables?.leads;
  if (
    adapter.packageName !== "@payloadcms/db-postgres" ||
    !transaction ||
    !table
  ) {
    throw new PreviewCaseAddressCommandError(
      "TRANSACTION_REQUIRED",
      "Address correction requires an active PostgreSQL row-lock transaction",
    );
  }

  const rows = await transaction
    .select({ id: table.id })
    .from(table)
    .where(sql`${table.id} = ${leadId}`)
    .for("update");
  if (rows.length !== 1) {
    throw new PreviewCaseAddressCommandError(
      "CASE_NOT_FOUND",
      "Case was not found",
    );
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

function digest(domain: string, value: unknown) {
  return createHash("sha256")
    .update(domain)
    .update("\0")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function storedAddress(lead: Record<string, unknown>): PreviewCaseAddress {
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    street: text(lead.address) || "Ikke oppgitt",
    houseNumber: text(lead.houseNumber),
    postalCode: text(lead.postal) || "0000",
    city: text(lead.city),
  };
}

function commandHash(command: PreviewCaseAddressCommand) {
  return digest("preview-case-address-command.v1", {
    actorId: command.actorId,
    address: command.address,
    expectedAddressRevision: command.expectedAddressRevision,
    expectedCaseRevision: command.expectedCaseRevision,
    leadId: command.leadId,
    reasonCode: command.reasonCode,
  });
}

function ledgerKey(command: PreviewCaseAddressCommand) {
  return `lead:${command.leadId}:${digest("preview-case-address-idempotency.v1", command.idempotencyKey)}`;
}

function parseStoredResult(
  row: Record<string, unknown>,
  expectedCommandHash: string,
): PreviewCaseAddressCommandResult {
  if (row.commandHash !== expectedCommandHash) {
    throw new PreviewCaseAddressCommandError(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key was already used for another address correction",
    );
  }
  const result = row.result as PreviewCaseAddressCommandResult | undefined;
  if (
    !result ||
    result.schemaVersion !== PREVIEW_CASE_ADDRESS_COMMAND_RESULT_VERSION ||
    result.status !== "applied"
  ) {
    throw new PreviewCaseAddressCommandError(
      "REPOSITORY_INTEGRITY",
      "Stored address command result failed validation",
    );
  }
  return structuredClone({ ...result, status: "replayed" });
}

async function findHistory(
  payload: Payload,
  where: Where,
  req?: TransactionRequest,
  sort?: string,
) {
  const result = await payload.find({
    collection: "case-address-revisions",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where,
    ...(req ? { req: req as PayloadRequest } : {}),
    ...(sort ? { sort } : {}),
  });
  return result.docs[0] as unknown as Record<string, unknown> | undefined;
}

async function latestRfInvalidation(
  payload: Payload,
  caseId: string,
  req: TransactionRequest,
): Promise<PreviewCaseAddressCommandResult["rfInvalidation"]> {
  const result = await payload.find({
    collection: "roof-fusion-snapshots",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    sort: "-revision",
    where: { caseId: { equals: caseId } },
    req: req as PayloadRequest,
  });
  const row = result.docs[0];
  if (!row) return { status: "not_applicable" };
  const snapshot = parseRoofSnapshotV1(row.snapshot);
  if (
    row.snapshotId !== snapshot.snapshotId ||
    row.caseId !== snapshot.subject.caseId ||
    row.revision !== snapshot.revision ||
    row.snapshotHash !== snapshot.snapshotHash
  ) {
    throw new PreviewCaseAddressCommandError(
      "REPOSITORY_INTEGRITY",
      "RF snapshot indexes disagree with the canonical snapshot",
    );
  }
  return {
    status: "invalidated",
    snapshot: {
      id: snapshot.snapshotId,
      revision: snapshot.revision,
      hash: snapshot.snapshotHash,
    },
  };
}

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
  return undefined;
}

function quoteUsesInvalidatedSnapshot(
  quote: Record<string, unknown>,
  invalidation: Extract<
    PreviewCaseAddressCommandResult["rfInvalidation"],
    { status: "invalidated" }
  >,
) {
  const snapshot = quote.snapshot;
  if (!snapshot || typeof snapshot !== "object") return false;
  const measurement = (snapshot as Record<string, unknown>).measurement;
  if (!measurement || typeof measurement !== "object") return false;
  const binding = (measurement as Record<string, unknown>).rfBinding;
  if (!binding || typeof binding !== "object") return false;
  const exact = binding as Record<string, unknown>;
  return (
    exact.snapshotId === invalidation.snapshot.id &&
    exact.snapshotRevision === invalidation.snapshot.revision &&
    exact.snapshotHash === invalidation.snapshot.hash
  );
}

async function invalidateCommercialDrafts(
  payload: Payload,
  leadId: number,
  rfInvalidation: PreviewCaseAddressCommandResult["rfInvalidation"],
  req: TransactionRequest,
): Promise<PreviewCaseAddressCommandResult["commercialDraftInvalidation"]> {
  if (rfInvalidation.status !== "invalidated") {
    return { status: "not_applicable", quoteIds: [], contractIds: [] };
  }
  const quotes = await payload.find({
    collection: "quotes",
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    where: {
      and: [
        { lead: { equals: leadId } },
        { status: { equals: "draft" } },
      ],
    },
    req: req as PayloadRequest,
  });
  const affectedQuotes = quotes.docs.filter((quote) =>
    quoteUsesInvalidatedSnapshot(
      quote as unknown as Record<string, unknown>,
      rfInvalidation,
    ),
  );
  const quoteIds: number[] = [];
  const contractIds: number[] = [];
  for (const quote of affectedQuotes) {
    const quoteId = relationId(quote.id);
    if (!quoteId) {
      throw new PreviewCaseAddressCommandError(
        "REPOSITORY_INTEGRITY",
        "RF-bound quote has no stable identity",
      );
    }
    const contracts = await payload.find({
      collection: "contracts",
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: true,
      where: {
        and: [
          { quote: { equals: quoteId } },
          { status: { equals: "draft" } },
        ],
      },
      req: req as PayloadRequest,
    });
    for (const contract of contracts.docs) {
      const contractId = relationId(contract.id);
      if (!contractId) continue;
      await payload.update({
        collection: "contracts",
        id: contractId,
        depth: 0,
        overrideAccess: true,
        req: req as PayloadRequest,
        data: { status: "superseded" },
      });
      contractIds.push(contractId);
    }
    await payload.update({
      collection: "quotes",
      id: quoteId,
      depth: 0,
      overrideAccess: true,
      req: req as PayloadRequest,
      data: { status: "superseded" },
    });
    quoteIds.push(quoteId);
  }
  return quoteIds.length || contractIds.length
    ? { status: "invalidated", quoteIds, contractIds }
    : { status: "not_applicable", quoteIds: [], contractIds: [] };
}

function revisionConflict(
  code: "CASE_REVISION_CONFLICT" | "ADDRESS_REVISION_CONFLICT",
  expected: number,
  actual: number,
) {
  return new PreviewCaseAddressCommandError(
    code,
    `${code === "CASE_REVISION_CONFLICT" ? "Case" : "Address"} revision changed`,
    expected,
    actual,
  );
}

export async function executePreviewCaseAddressCommand(input: {
  payload: Payload;
  command: PreviewCaseAddressCommand;
  environment?: PreviewCaseAddressEnvironment;
  now?: Date;
}): Promise<PreviewCaseAddressCommandResult> {
  assertPreviewCaseAddressCommandEnabled(input.environment);
  const parsed = previewCaseAddressCommandSchema.safeParse(input.command);
  if (!parsed.success) {
    throw new PreviewCaseAddressCommandError(
      "INVALID_COMMAND",
      "Invalid Preview case address command",
    );
  }
  const command = parsed.data;
  const hash = commandHash(command);
  const key = ledgerKey(command);
  const caseId = `lead:${command.leadId}`;
  const request = { payload: input.payload } as TransactionRequest;
  const started = await initTransaction(request);
  if (!started) {
    throw new PreviewCaseAddressCommandError(
      "TRANSACTION_REQUIRED",
      "Address correction requires a database transaction",
    );
  }

  let committed = false;
  try {
    const duplicate = await findHistory(
      input.payload,
      { ledgerKey: { equals: key } },
      request,
    );
    if (duplicate) {
      const replay = parseStoredResult(duplicate, hash);
      await commitTransaction(request);
      committed = true;
      return replay;
    }

    await lockLeadAddressRow(input.payload, request, command.leadId);

    // A matching command may have committed while this transaction waited for
    // the row lock. Re-read the append-only ledger after acquiring the lock so
    // an identical retry is replayed without attempting another write.
    const duplicateAfterLock = await findHistory(
      input.payload,
      { ledgerKey: { equals: key } },
      request,
    );
    if (duplicateAfterLock) {
      const replay = parseStoredResult(duplicateAfterLock, hash);
      await commitTransaction(request);
      committed = true;
      return replay;
    }

    let lead: Record<string, unknown>;
    try {
      lead = (await input.payload.findByID({
        collection: "leads",
        id: command.leadId,
        depth: 0,
        overrideAccess: true,
        req: request as PayloadRequest,
      })) as unknown as Record<string, unknown>;
    } catch {
      throw new PreviewCaseAddressCommandError(
        "CASE_NOT_FOUND",
        "Case was not found",
      );
    }
    const actualCaseRevision = Number(lead.caseRevision || 1);
    const actualAddressRevision = Number(lead.addressRevision || 1);
    if (actualCaseRevision !== command.expectedCaseRevision) {
      throw revisionConflict(
        "CASE_REVISION_CONFLICT",
        command.expectedCaseRevision,
        actualCaseRevision,
      );
    }
    if (actualAddressRevision !== command.expectedAddressRevision) {
      throw revisionConflict(
        "ADDRESS_REVISION_CONFLICT",
        command.expectedAddressRevision,
        actualAddressRevision,
      );
    }

    const context = {
      trustedCaseAddressCommand: true,
      trustedCaseCommand: true,
      expectedCaseRevision: actualCaseRevision,
      expectedAddressRevision: actualAddressRevision,
    } as const;
    request.context = context;
    request.payloadAPI = "local";

    const before = storedAddress(lead);
    const beforeHash = digest("preview-case-address.v1", before);
    const after = command.address;
    const afterHash = digest("preview-case-address.v1", after);
    if (beforeHash === afterHash) {
      throw new PreviewCaseAddressCommandError(
        "NO_CHANGE",
        "Corrected address is unchanged",
      );
    }
    if (actualAddressRevision > 1) {
      const previous = await findHistory(
        input.payload,
        { caseId: { equals: caseId } },
        request,
        "-addressRevision",
      );
      if (
        !previous ||
        Number(previous.addressRevision) !== actualAddressRevision ||
        previous.afterHash !== beforeHash
      ) {
        throw new PreviewCaseAddressCommandError(
          "REPOSITORY_INTEGRITY",
          "Address revision chain does not match the current case",
        );
      }
    }

    const nextCaseRevision = actualCaseRevision + 1;
    const nextAddressRevision = actualAddressRevision + 1;
    await input.payload.update({
      collection: "leads",
      id: command.leadId,
      depth: 0,
      overrideAccess: true,
      context,
      req: request as PayloadRequest,
      data: {
        address: after.street,
        houseNumber: after.houseNumber,
        postal: after.postalCode,
        city: after.city,
        caseRevision: nextCaseRevision,
        addressRevision: nextAddressRevision,
      },
    });

    const rfInvalidation = await latestRfInvalidation(
      input.payload,
      caseId,
      request,
    );
    const commercialDraftInvalidation = await invalidateCommercialDrafts(
      input.payload,
      command.leadId,
      rfInvalidation,
      request,
    );

    const result: PreviewCaseAddressCommandResult = {
      schemaVersion: PREVIEW_CASE_ADDRESS_COMMAND_RESULT_VERSION,
      status: "applied",
      case: {
        id: command.leadId,
        caseRevision: nextCaseRevision,
        addressRevision: nextAddressRevision,
      },
      address: structuredClone(after),
      rfInvalidation,
      commercialDraftInvalidation,
    };
    await input.payload.create({
      collection: "case-address-revisions",
      depth: 0,
      overrideAccess: true,
      context: { trustedCaseAddressRevisionAppend: true },
      req: request as PayloadRequest,
      data: {
        ledgerKey: key,
        revisionKey: `${caseId}:${nextAddressRevision}`,
        lead: command.leadId,
        caseId,
        addressRevision: nextAddressRevision,
        previousAddressRevision: actualAddressRevision,
        expectedCaseRevision: actualCaseRevision,
        resultingCaseRevision: nextCaseRevision,
        idempotencyKey: command.idempotencyKey,
        commandHash: hash,
        correlationId: command.correlationId,
        actor: command.actorId,
        reasonCode: command.reasonCode,
        before,
        after,
        beforeHash,
        afterHash,
        rfInvalidationStatus: rfInvalidation.status,
        ...(rfInvalidation.status === "invalidated"
          ? {
              invalidatedRfSnapshotId: rfInvalidation.snapshot.id,
              invalidatedRfSnapshotRevision: rfInvalidation.snapshot.revision,
              invalidatedRfSnapshotHash: rfInvalidation.snapshot.hash,
            }
          : {}),
        occurredAt: (input.now || new Date()).toISOString(),
        result,
      },
    });
    await recordAuditEvent(
      createPayloadAuditWriter(input.payload, {
        req: request as PayloadRequest,
      }),
      {
        actorId: command.actorId,
        action: "case.address_corrected",
        entityType: "lead",
        entityId: command.leadId,
        correlationId: command.correlationId,
        before,
        after,
        changedFields: [
          "address",
          "houseNumber",
          "postal",
          "city",
          "caseRevision",
          "addressRevision",
        ],
        metadata: {
          caseRevision: nextCaseRevision,
          revision: nextAddressRevision,
          idempotencyDigest: digest(
            "preview-case-address-audit-idempotency.v1",
            command.idempotencyKey,
          ),
          rfInvalidated: rfInvalidation.status === "invalidated",
          quoteDraftsInvalidated:
            commercialDraftInvalidation.quoteIds.length,
          contractDraftsInvalidated:
            commercialDraftInvalidation.contractIds.length,
        },
      },
    );
    await commitTransaction(request);
    committed = true;
    return result;
  } catch (error) {
    if (!committed) await killTransaction(request);
    const concurrentReplay = await findHistory(input.payload, {
      ledgerKey: { equals: key },
    }).catch(() => undefined);
    if (concurrentReplay) return parseStoredResult(concurrentReplay, hash);
    if (error instanceof PreviewCaseAddressCommandError) throw error;
    const caseMatch =
      error instanceof Error &&
      /^CASE_REVISION_CONFLICT:(\d+):(\d+)$/u.exec(error.message);
    if (caseMatch) {
      throw revisionConflict(
        "CASE_REVISION_CONFLICT",
        Number(caseMatch[1]),
        Number(caseMatch[2]),
      );
    }
    const addressMatch =
      error instanceof Error &&
      /^ADDRESS_REVISION_CONFLICT:(\d+):(\d+)$/u.exec(error.message);
    if (addressMatch) {
      throw revisionConflict(
        "ADDRESS_REVISION_CONFLICT",
        Number(addressMatch[1]),
        Number(addressMatch[2]),
      );
    }
    throw new PreviewCaseAddressCommandError(
      "REPOSITORY_INTEGRITY",
      "Address correction could not be committed",
    );
  }
}
