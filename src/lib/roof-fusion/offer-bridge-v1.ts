import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from "payload";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { calculatePrice } from "@/lib/measurements/pricing";
import { createQuoteDraft } from "@/lib/quotes/payload-quote-engine";
import {
  assertRoofFusionOfferBridgeBindingV1,
  assertRoofFusionOfferBridgePreviewEnabledV1,
  projectApprovedRoofFusionMeasurementV1,
  roofFusionOfferBridgeBindingHashV1,
  roofFusionOfferBridgeCommandHashV1,
  roofFusionOfferBridgeResultV1Schema,
  RoofFusionOfferBridgeErrorV1,
  type RoofFusionOfferBridgeRequestV1,
  type RoofFusionOfferBridgeResultV1,
} from "./offer-bridge-contract-v1";
import { PayloadRoofSnapshotRepositoryV1 } from "./payload-repository-v1";
import {
  executeRoofRepositoryCommandV1,
  RoofRepositoryCommandErrorV1,
} from "./repository-contract-v1";
import { parseRoofSnapshotV1, type RoofSnapshotV1 } from "./roof-snapshot-v1";

type Environment = Readonly<Record<string, string | undefined>>;
type TransactionRequest = Partial<PayloadRequest> & { payload: Payload };

function leadIdForCase(caseId: string) {
  const match = /^lead:([1-9]\d*)$/u.exec(caseId);
  const leadId = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(leadId) || leadId < 1) {
    throw new RoofFusionOfferBridgeErrorV1(
      "CASE_MISMATCH",
      "Roof Fusion offer commands must be bound to a lead case",
      [caseId],
    );
  }
  return leadId;
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

function normalizedLeadAddress(lead: Record<string, unknown>) {
  return [lead.address, lead.houseNumber, lead.postal, lead.city]
    .filter((value) => typeof value === "string" && value.trim())
    .join(", ");
}

function ledgerKey(caseId: string, bindingHash: string) {
  return `${caseId}:${bindingHash}`;
}

function idempotencyScopeKey(caseId: string, idempotencyKey: string) {
  return `${caseId}:${idempotencyKey}`;
}

function storedResult(row: Record<string, unknown>) {
  const parsed = roofFusionOfferBridgeResultV1Schema.safeParse(row.result);
  if (
    !parsed.success ||
    parsed.data.status !== "applied" ||
    row.caseId !== parsed.data.caseId ||
    row.snapshotId !== parsed.data.snapshot.snapshotId ||
    row.snapshotRevision !== parsed.data.snapshot.revision ||
    row.snapshotHash !== parsed.data.snapshot.snapshotHash ||
    row.inputHash !== parsed.data.snapshot.inputHash ||
    row.rendererHash !== parsed.data.snapshot.renderHash ||
    relationId(row.measurement) !== parsed.data.measurement.id ||
    relationId(row.quote) !== parsed.data.quote.id ||
    relationId(row.contract) !== parsed.data.contractId
  ) {
    throw new RoofFusionOfferBridgeErrorV1(
      "REPOSITORY_INTEGRITY",
      "Stored Roof Fusion offer result disagrees with its immutable indexes",
    );
  }
  return parsed.data;
}

function replayStoredCommand(
  row: Record<string, unknown>,
  commandHash: string,
): RoofFusionOfferBridgeResultV1 {
  if (row.commandHash !== commandHash) {
    throw new RoofFusionOfferBridgeErrorV1(
      "IDEMPOTENCY_CONFLICT",
      "The idempotency key was already used for another offer command",
    );
  }
  return { ...structuredClone(storedResult(row)), status: "replayed" };
}

function replayStoredBinding(
  row: Record<string, unknown>,
): RoofFusionOfferBridgeResultV1 {
  return { ...structuredClone(storedResult(row)), status: "replayed" };
}

async function findOfferCommand(
  payload: Payload,
  key: string,
  field: "idempotencyScopeKey" | "ledgerKey",
  req?: TransactionRequest,
) {
  const result = await payload.find({
    collection: "roof-fusion-offer-commands",
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { [field]: { equals: key } },
    ...(req ? { req: req as PayloadRequest } : {}),
  });
  return result.docs[0] as unknown as Record<string, unknown> | undefined;
}

async function exactLatestSnapshotInTransaction(input: {
  payload: Payload;
  caseId: string;
  req: TransactionRequest;
}) {
  const result = await input.payload.find({
    collection: "roof-fusion-snapshots",
    depth: 0,
    limit: 1,
    pagination: false,
    sort: "-revision",
    overrideAccess: true,
    req: input.req as PayloadRequest,
    where: { caseId: { equals: input.caseId } },
  });
  const row = result.docs[0];
  if (!row) return null;
  return parseRoofSnapshotV1(row.snapshot);
}

async function isSnapshotInvalidatedInTransaction(input: {
  payload: Payload;
  snapshot: RoofSnapshotV1;
  req: TransactionRequest;
}) {
  const result = await input.payload.find({
    collection: "case-address-revisions",
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req: input.req as PayloadRequest,
    where: {
      and: [
        { caseId: { equals: input.snapshot.subject.caseId } },
        { rfInvalidationStatus: { equals: "invalidated" } },
        { invalidatedRfSnapshotId: { equals: input.snapshot.snapshotId } },
        {
          invalidatedRfSnapshotRevision: {
            equals: input.snapshot.revision,
          },
        },
        {
          invalidatedRfSnapshotHash: {
            equals: input.snapshot.snapshotHash,
          },
        },
      ],
    },
  });
  return Boolean(result.docs[0]);
}

function approvalIdempotencyKey(commandHash: string) {
  return `rf-offer-approve:${commandHash}`;
}

function approvalSnapshotId(snapshot: RoofSnapshotV1, commandHash: string) {
  return `${snapshot.snapshotId}-offer-${commandHash.slice(0, 12)}`.slice(0, 160);
}

async function approvedSnapshotForOffer(input: {
  payload: Payload;
  request: RoofFusionOfferBridgeRequestV1;
  commandHash: string;
  actorId: number;
  actorDisplayName?: string;
  now: Date;
  caseRevision: number;
  addressRevision: number;
}) {
  const repository = new PayloadRoofSnapshotRepositoryV1(input.payload);
  const [requestedSnapshot, latestSnapshot] = await Promise.all([
    repository.readSnapshot(input.request.snapshot.snapshotId),
    repository.readLatestSnapshot(input.request.caseId),
  ]);
  if (!requestedSnapshot) {
    throw new RoofFusionOfferBridgeErrorV1(
      "SNAPSHOT_NOT_FOUND",
      "The reviewed Roof Fusion snapshot no longer exists",
      [input.request.snapshot.snapshotId],
    );
  }
  if (!latestSnapshot) {
    throw new RoofFusionOfferBridgeErrorV1(
      "SNAPSHOT_NOT_FOUND",
      "The Roof Fusion case has no current snapshot",
      [input.request.caseId],
    );
  }
  if (await repository.isSnapshotInvalidated(requestedSnapshot)) {
    throw new RoofFusionOfferBridgeErrorV1(
      "ADDRESS_REVISION_CONFLICT",
      "The reviewed Roof Fusion snapshot was invalidated by an address correction",
      [requestedSnapshot.snapshotId],
    );
  }

  const approvalKey = approvalIdempotencyKey(input.commandHash);
  if (requestedSnapshot.state !== "approved") {
    const priorApproval = await repository.readCommand(
      input.request.caseId,
      approvalKey,
    );
    if (priorApproval) {
      assertRoofFusionOfferBridgeBindingV1({
        request: input.request,
        snapshot: requestedSnapshot,
        latestSnapshot: requestedSnapshot,
        caseRevision: input.caseRevision,
        addressRevision: input.addressRevision,
      });
      if (
        latestSnapshot.snapshotId !== priorApproval.result.snapshot.snapshotId ||
        latestSnapshot.snapshotHash !== priorApproval.result.snapshot.snapshotHash
      ) {
        throw new RoofFusionOfferBridgeErrorV1(
          "STALE_SNAPSHOT",
          "A newer Roof Fusion snapshot exists after offer approval",
          [latestSnapshot.snapshotId],
        );
      }
      return latestSnapshot;
    }
  }

  assertRoofFusionOfferBridgeBindingV1({
    request: input.request,
    snapshot: requestedSnapshot,
    latestSnapshot,
    caseRevision: input.caseRevision,
    addressRevision: input.addressRevision,
  });
  if (requestedSnapshot.state === "approved") return requestedSnapshot;

  try {
    const result = await executeRoofRepositoryCommandV1(repository, {
      schemaVersion: "roof-repository-command.v1",
      commandType: "approve",
      caseId: input.request.caseId,
      currentSnapshotId: requestedSnapshot.snapshotId,
      newSnapshotId: approvalSnapshotId(requestedSnapshot, input.commandHash),
      expectedRevision: requestedSnapshot.revision,
      approval: {
        schemaVersion: "roof-snapshot-approval-command.v1",
        expectedSnapshotHash: requestedSnapshot.snapshotHash,
        idempotencyKey: approvalKey,
        actor: {
          actorId: String(input.actorId),
          actorType: "administrator",
          ...(input.actorDisplayName
            ? { displayName: input.actorDisplayName }
            : {}),
        },
        approvedAt: input.now.toISOString(),
        ...(input.request.exceptionReason
          ? { reviewReason: input.request.exceptionReason }
          : {}),
      },
    });
    const approved = await repository.readSnapshot(result.snapshot.snapshotId);
    if (!approved || approved.state !== "approved") {
      throw new RoofFusionOfferBridgeErrorV1(
        "REPOSITORY_INTEGRITY",
        "Approved Roof Fusion snapshot could not be reloaded",
        [result.snapshot.snapshotId],
      );
    }
    return approved;
  } catch (error) {
    if (error instanceof RoofFusionOfferBridgeErrorV1) throw error;
    if (error instanceof RoofRepositoryCommandErrorV1) {
      if (
        error.code === "IDEMPOTENCY_CONFLICT" ||
        error.code === "SNAPSHOT_ID_CONFLICT"
      ) {
        const concurrentApproval = await repository.readCommand(
          input.request.caseId,
          approvalKey,
        );
        if (concurrentApproval) {
          const [approved, latest] = await Promise.all([
            repository.readSnapshot(
              concurrentApproval.result.snapshot.snapshotId,
            ),
            repository.readLatestSnapshot(input.request.caseId),
          ]);
          if (
            approved?.state === "approved" &&
            latest?.snapshotId === approved.snapshotId &&
            latest.snapshotHash === approved.snapshotHash
          ) {
            return approved;
          }
        }
      }
      const code =
        error.code === "QUALITY_BLOCKED" || error.code === "INVALID_STATE"
          ? "QUALITY_BLOCKED"
          : error.code === "IDEMPOTENCY_CONFLICT"
            ? "IDEMPOTENCY_CONFLICT"
            : error.code === "SNAPSHOT_NOT_FOUND"
              ? "SNAPSHOT_NOT_FOUND"
              : "STALE_SNAPSHOT";
      throw new RoofFusionOfferBridgeErrorV1(
        code,
        error.message,
        error.entityRefs,
      );
    }
    throw error;
  }
}

export async function executeRoofFusionOfferBridgeV1(input: {
  payload: Payload;
  request: RoofFusionOfferBridgeRequestV1;
  actorId: number;
  actorDisplayName?: string;
  correlationId: string;
  environment?: Environment;
  now?: Date;
}): Promise<RoofFusionOfferBridgeResultV1> {
  assertRoofFusionOfferBridgePreviewEnabledV1(input.environment);
  const commandHash = roofFusionOfferBridgeCommandHashV1(input.request);
  const bindingHash = roofFusionOfferBridgeBindingHashV1(input.request);
  const key = ledgerKey(input.request.caseId, bindingHash);
  const scopeKey = idempotencyScopeKey(
    input.request.caseId,
    input.request.idempotencyKey,
  );
  const idempotentDuplicate = await findOfferCommand(
    input.payload,
    scopeKey,
    "idempotencyScopeKey",
  );
  if (idempotentDuplicate)
    return replayStoredCommand(idempotentDuplicate, commandHash);
  const bindingDuplicate = await findOfferCommand(
    input.payload,
    key,
    "ledgerKey",
  );
  if (bindingDuplicate) return replayStoredBinding(bindingDuplicate);

  const leadId = leadIdForCase(input.request.caseId);
  const lead = (await input.payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>;
  const caseRevision = Number(lead.caseRevision || 1);
  const addressRevision = Number(lead.addressRevision || 1);
  const now = input.now || new Date();
  const approvedSnapshot = await approvedSnapshotForOffer({
    payload: input.payload,
    request: input.request,
    commandHash,
    actorId: input.actorId,
    actorDisplayName: input.actorDisplayName,
    now,
    caseRevision,
    addressRevision,
  });

  const transaction = { payload: input.payload } as TransactionRequest;
  const started = await initTransaction(transaction);
  if (!started) {
    throw new RoofFusionOfferBridgeErrorV1(
      "REPOSITORY_INTEGRITY",
      "The Roof Fusion offer package requires a database transaction",
      [input.request.caseId],
    );
  }
  let committed = false;
  try {
    const currentLead = (await input.payload.findByID({
      collection: "leads",
      id: leadId,
      depth: 0,
      overrideAccess: true,
      req: transaction as PayloadRequest,
    })) as unknown as Record<string, unknown>;
    if (Number(currentLead.caseRevision || 1) !== input.request.expectedCaseRevision) {
      throw new RoofFusionOfferBridgeErrorV1(
        "CASE_REVISION_CONFLICT",
        "The case changed before the offer package could be committed",
        [input.request.caseId],
      );
    }
    if (
      Number(currentLead.addressRevision || 1) !==
      input.request.expectedAddressRevision
    ) {
      throw new RoofFusionOfferBridgeErrorV1(
        "ADDRESS_REVISION_CONFLICT",
        "The address changed before the offer package could be committed",
        [input.request.caseId],
      );
    }
    const caseLockContext = {
      trustedCaseCommand: true,
      expectedCaseRevision: input.request.expectedCaseRevision,
    } as const;
    transaction.context = caseLockContext;
    transaction.payloadAPI = "local";
    const caseLock = await input.payload.update({
      collection: "leads",
      depth: 0,
      overrideAccess: true,
      context: caseLockContext,
      req: transaction as PayloadRequest,
      where: {
        and: [
          { id: { equals: leadId } },
          {
            caseRevision: {
              equals: input.request.expectedCaseRevision,
            },
          },
          {
            addressRevision: {
              equals: input.request.expectedAddressRevision,
            },
          },
        ],
      },
      data: { caseRevision: input.request.expectedCaseRevision },
    });
    if (!Array.isArray(caseLock.docs) || caseLock.docs.length !== 1) {
      throw new RoofFusionOfferBridgeErrorV1(
        "CASE_REVISION_CONFLICT",
        "The case changed before the offer package acquired its revision lock",
        [input.request.caseId],
      );
    }

    const inTransactionIdempotentDuplicate = await findOfferCommand(
      input.payload,
      scopeKey,
      "idempotencyScopeKey",
      transaction,
    );
    if (inTransactionIdempotentDuplicate) {
      const replay = replayStoredCommand(
        inTransactionIdempotentDuplicate,
        commandHash,
      );
      await commitTransaction(transaction);
      committed = true;
      return replay;
    }
    const inTransactionBindingDuplicate = await findOfferCommand(
      input.payload,
      key,
      "ledgerKey",
      transaction,
    );
    if (inTransactionBindingDuplicate) {
      const replay = replayStoredBinding(inTransactionBindingDuplicate);
      await commitTransaction(transaction);
      committed = true;
      return replay;
    }

    const lockedLatestSnapshot = await exactLatestSnapshotInTransaction({
      payload: input.payload,
      caseId: input.request.caseId,
      req: transaction,
    });
    if (
      !lockedLatestSnapshot ||
      lockedLatestSnapshot.snapshotId !== approvedSnapshot.snapshotId ||
      lockedLatestSnapshot.revision !== approvedSnapshot.revision ||
      lockedLatestSnapshot.snapshotHash !== approvedSnapshot.snapshotHash ||
      lockedLatestSnapshot.inputHash !== approvedSnapshot.inputHash ||
      lockedLatestSnapshot.rendererPayload.renderHash !==
        approvedSnapshot.rendererPayload.renderHash
    ) {
      throw new RoofFusionOfferBridgeErrorV1(
        "STALE_SNAPSHOT",
        "The Roof Fusion snapshot changed before the offer package acquired its case lock",
        [
          approvedSnapshot.snapshotId,
          ...(lockedLatestSnapshot ? [lockedLatestSnapshot.snapshotId] : []),
        ],
      );
    }
    if (
      await isSnapshotInvalidatedInTransaction({
        payload: input.payload,
        snapshot: approvedSnapshot,
        req: transaction,
      })
    ) {
      throw new RoofFusionOfferBridgeErrorV1(
        "ADDRESS_REVISION_CONFLICT",
        "The reviewed Roof Fusion snapshot was invalidated before package commit",
        [approvedSnapshot.snapshotId],
      );
    }

    const previousMeasurements = await input.payload.find({
      collection: "roof-measurements",
      depth: 0,
      limit: 1,
      pagination: false,
      sort: "-version",
      overrideAccess: true,
      where: { lead: { equals: leadId } },
      req: transaction as PayloadRequest,
    });
    const previousMeasurement = previousMeasurements.docs[0];
    const measurementVersion = Number(previousMeasurement?.version || 0) + 1;
    const measurementProjection = projectApprovedRoofFusionMeasurementV1({
      snapshot: approvedSnapshot,
      leadId,
      version: measurementVersion,
      ...(previousMeasurement
        ? { supersedes: relationId(previousMeasurement.id) }
        : {}),
      normalizedAddress: normalizedLeadAddress(currentLead),
      caseRevision: input.request.expectedCaseRevision,
      addressRevision: input.request.expectedAddressRevision,
      approvedBy: input.actorId,
    });
    const measurement = await input.payload.create({
      collection: "roof-measurements",
      depth: 0,
      overrideAccess: true,
      context: { trustedRoofFusionProjection: true },
      req: transaction as PayloadRequest,
      data: measurementProjection,
    });

    const rules = await input.payload.find({
      collection: "price-rules",
      depth: 0,
      limit: 1,
      pagination: false,
      sort: "-version",
      overrideAccess: true,
      where: {
        and: [
          { serviceKey: { equals: currentLead.inquiryType } },
          { status: { equals: "approved" } },
        ],
      },
      req: transaction as PayloadRequest,
    });
    const rule = rules.docs[0];
    if (!rule) {
      throw new RoofFusionOfferBridgeErrorV1(
        "PACKAGE_CONFLICT",
        "No approved price rule exists for this service",
        [input.request.caseId],
      );
    }
    const calculated = calculatePrice(measurement.actualAreaMaxTenths, {
      id: rule.id,
      version: rule.version,
      serviceKey: rule.serviceKey,
      unitPriceExVatOre: rule.unitPriceExVatOre,
      vatBasisPoints: rule.vatBasisPoints,
      minimumExVatOre: rule.minimumExVatOre,
      toleranceBasisPoints: rule.toleranceBasisPoints,
      maximumExVatOre: rule.maximumExVatOre,
      status: rule.status,
    });
    const calculation = await input.payload.create({
      collection: "price-calculations",
      depth: 0,
      overrideAccess: true,
      req: transaction as PayloadRequest,
      data: {
        reference: `RF-PB-${leadId}-${commandHash.slice(0, 12)}`,
        lead: leadId,
        measurement: measurement.id,
        priceRule: rule.id,
        inputSnapshot: {
          schemaVersion: "roof-fusion-price-input.v1",
          caseRevision: input.request.expectedCaseRevision,
          addressRevision: input.request.expectedAddressRevision,
          measurementHash: measurement.inputHash,
          measurementVersion: measurement.version,
          snapshotId: approvedSnapshot.snapshotId,
          snapshotRevision: approvedSnapshot.revision,
          snapshotHash: approvedSnapshot.snapshotHash,
          sourceInputHash: approvedSnapshot.inputHash,
          rendererHash: approvedSnapshot.rendererPayload.renderHash,
          rule,
        },
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
    let documents: Awaited<ReturnType<typeof createQuoteDraft>>;
    try {
      documents = await createQuoteDraft(
       input.payload,
       calculation.id,
       now,
        {
          preservePrevious: true,
          req: transaction as PayloadRequest,
        },
      );
    } catch (error) {
      throw new RoofFusionOfferBridgeErrorV1(
        "PACKAGE_CONFLICT",
        error instanceof Error
          ? error.message
          : "Offer and contract drafts could not be created",
        [input.request.caseId],
      );
    }

    const result: RoofFusionOfferBridgeResultV1 = {
      schemaVersion: "roof-fusion-offer-bridge-result.v1",
      status: "applied",
      caseId: input.request.caseId,
      snapshot: {
        snapshotId: approvedSnapshot.snapshotId,
        revision: approvedSnapshot.revision,
        snapshotHash: approvedSnapshot.snapshotHash,
        inputHash: approvedSnapshot.inputHash,
        renderHash: approvedSnapshot.rendererPayload.renderHash,
      },
      measurement: {
        id: measurement.id,
        version: measurement.version,
        inputHash: measurement.inputHash,
      },
      quote: { id: documents.quote.id, version: documents.quote.version },
      contractId: documents.contract.id,
      customerSideEffects: "none",
      offerHref: `/admin-next-preview/cases/${leadId}?focus=offer-${documents.quote.id}`,
    };
    await input.payload.create({
      collection: "roof-fusion-offer-commands",
      depth: 0,
      overrideAccess: true,
      context: { trustedRoofFusionOfferCommandAppend: true },
      req: transaction as PayloadRequest,
      data: {
        ledgerKey: key,
        idempotencyScopeKey: scopeKey,
        caseId: input.request.caseId,
        idempotencyKey: input.request.idempotencyKey,
        commandHash,
        caseRevision: input.request.expectedCaseRevision,
        addressRevision: input.request.expectedAddressRevision,
        snapshotId: approvedSnapshot.snapshotId,
        snapshotRevision: approvedSnapshot.revision,
        snapshotHash: approvedSnapshot.snapshotHash,
        inputHash: approvedSnapshot.inputHash,
        rendererHash: approvedSnapshot.rendererPayload.renderHash,
        measurement: measurement.id,
        quote: documents.quote.id,
        contract: documents.contract.id,
        actor: input.actorId,
        correlationId: input.correlationId,
        occurredAt: now.toISOString(),
        result,
      },
    });
    await recordAuditEvent(
      createPayloadAuditWriter(input.payload, {
        req: transaction as PayloadRequest,
      }),
      {
        actorId: input.actorId,
        action: "roof-fusion.offer-draft-created",
        entityType: "lead",
        entityId: leadId,
        correlationId: input.correlationId,
        changedFields: [
          "roofMeasurement",
          "priceCalculation",
          "quoteDraft",
          "contractDraft",
        ],
        after: result,
        metadata: {
          caseRevision: input.request.expectedCaseRevision,
          sourceRevision: input.request.expectedAddressRevision,
          snapshotRevision: approvedSnapshot.revision,
          measurementId: measurement.id,
          quoteId: documents.quote.id,
          contractId: documents.contract.id,
          customerSideEffects: false,
        },
      },
    );
    await commitTransaction(transaction);
    committed = true;
    return result;
  } catch (error) {
    if (!committed) await killTransaction(transaction);
    if (error instanceof RoofFusionOfferBridgeErrorV1) throw error;
    const concurrentIdempotentReplay = await findOfferCommand(
      input.payload,
      scopeKey,
      "idempotencyScopeKey",
    ).catch(() => undefined);
    if (concurrentIdempotentReplay)
      return replayStoredCommand(concurrentIdempotentReplay, commandHash);
    const concurrentBindingReplay = await findOfferCommand(
      input.payload,
      key,
      "ledgerKey",
    ).catch(() => undefined);
    if (concurrentBindingReplay)
      return replayStoredBinding(concurrentBindingReplay);
    throw new RoofFusionOfferBridgeErrorV1(
      "REPOSITORY_INTEGRITY",
      "Roof Fusion offer package could not be committed",
      [input.request.caseId],
    );
  }
}
