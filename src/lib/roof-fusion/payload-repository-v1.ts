import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
  type Where,
} from "payload";
import type {
  RoofFusionCommand,
  RoofFusionSnapshot,
} from "@/payload/payload-types";
import {
  ROOF_REPOSITORY_CONTRACT_VERSION,
  ROOF_REPOSITORY_RESULT_VERSION,
  RoofRepositoryCommandErrorV1,
  type RoofRepositoryCommandResultV1,
  type RoofSnapshotAppendOnlyRepositoryV1,
  type RoofSnapshotReferenceV1,
  type StoredRoofRepositoryCommandV1,
} from "./repository-contract-v1";
import { parseRoofSnapshotV1, type RoofSnapshotV1 } from "./roof-snapshot-v1";

type TransactionRequest = Partial<PayloadRequest> & { payload: Payload };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function repositoryIntegrity(message: string, entityRefs: string[] = []) {
  return new RoofRepositoryCommandErrorV1(
    "REPOSITORY_INTEGRITY",
    message,
    entityRefs,
  );
}

function snapshotReference(snapshot: RoofSnapshotV1): RoofSnapshotReferenceV1 {
  return {
    snapshotId: snapshot.snapshotId,
    revision: snapshot.revision,
    snapshotHash: snapshot.snapshotHash,
    state: snapshot.state,
    measurementClass: snapshot.measurement.class,
  };
}

function referencesMatch(
  left: RoofSnapshotReferenceV1 | null,
  right: RoofSnapshotReferenceV1 | null,
) {
  return (
    left === right ||
    Boolean(
      left &&
      right &&
      left.snapshotId === right.snapshotId &&
      left.revision === right.revision &&
      left.snapshotHash === right.snapshotHash,
    )
  );
}

function leadIdForPreviewCase(caseId: string) {
  if (process.env.VERCEL_ENV !== "preview") return null;
  const match = /^lead:([1-9]\d*)$/u.exec(caseId);
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseStoredSnapshot(row: RoofFusionSnapshot): RoofSnapshotV1 {
  let snapshot: RoofSnapshotV1;
  try {
    snapshot = parseRoofSnapshotV1(row.snapshot);
  } catch (error) {
    throw repositoryIntegrity(
      `Stored Roof Fusion snapshot failed contract validation: ${error instanceof Error ? error.message : String(error)}`,
      [row.snapshotId],
    );
  }
  if (
    row.snapshotId !== snapshot.snapshotId ||
    row.caseId !== snapshot.subject.caseId ||
    row.caseRevisionKey !== `${snapshot.subject.caseId}:${snapshot.revision}` ||
    row.revision !== snapshot.revision ||
    (row.supersedesSnapshotId ?? undefined) !== snapshot.supersedesSnapshotId ||
    row.snapshotHash !== snapshot.snapshotHash ||
    row.state !== snapshot.state ||
    row.measurementClass !== snapshot.measurement.class
  ) {
    throw repositoryIntegrity(
      "Stored Roof Fusion snapshot indexes disagree with the authoritative JSON",
      [row.snapshotId],
    );
  }
  return snapshot;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStoredCommand(
  row: RoofFusionCommand,
): StoredRoofRepositoryCommandV1 {
  const value = row.result;
  if (
    !isObject(value) ||
    value.schemaVersion !== ROOF_REPOSITORY_RESULT_VERSION ||
    value.repositoryContractVersion !== ROOF_REPOSITORY_CONTRACT_VERSION ||
    value.caseId !== row.caseId ||
    value.idempotencyKey !== row.idempotencyKey ||
    value.commandHash !== row.commandHash ||
    value.commandType !== row.commandType ||
    !isObject(value.snapshot) ||
    value.snapshot.snapshotId !== row.snapshotId ||
    row.ledgerKey !== `${row.caseId}:${row.idempotencyKey}`
  ) {
    throw repositoryIntegrity(
      "Stored Roof Fusion command indexes disagree with the authoritative result",
      [row.ledgerKey],
    );
  }
  return {
    commandHash: row.commandHash,
    result: clone(value) as RoofRepositoryCommandResultV1,
  };
}

function assertAppendBinding(input: {
  snapshot: RoofSnapshotV1;
  command: StoredRoofRepositoryCommandV1;
}) {
  const { snapshot, command } = input;
  const result = command.result;
  if (
    command.commandHash !== result.commandHash ||
    result.repositoryContractVersion !== ROOF_REPOSITORY_CONTRACT_VERSION ||
    result.caseId !== snapshot.subject.caseId ||
    result.snapshot.snapshotId !== snapshot.snapshotId ||
    result.snapshot.revision !== snapshot.revision ||
    result.snapshot.snapshotHash !== snapshot.snapshotHash ||
    result.snapshot.state !== snapshot.state ||
    result.snapshot.measurementClass !== snapshot.measurement.class
  ) {
    throw repositoryIntegrity(
      "Atomic append command result does not reference its snapshot",
      [snapshot.snapshotId],
    );
  }
}

export class PayloadRoofSnapshotRepositoryV1 implements RoofSnapshotAppendOnlyRepositoryV1 {
  readonly contractVersion = ROOF_REPOSITORY_CONTRACT_VERSION;

  constructor(private readonly payload: Payload) {}

  private async findSnapshot(
    where: Where,
    options: { req?: TransactionRequest; sort?: string } = {},
  ) {
    const result = await this.payload.find({
      collection: "roof-fusion-snapshots",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where,
      ...(options.req ? { req: options.req as PayloadRequest } : {}),
      ...(options.sort ? { sort: options.sort } : {}),
    });
    return result.docs[0] ? parseStoredSnapshot(result.docs[0]) : null;
  }

  private async findCommand(
    caseId: string,
    idempotencyKey: string,
    req?: TransactionRequest,
  ) {
    const result = await this.payload.find({
      collection: "roof-fusion-commands",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: {
        and: [
          { caseId: { equals: caseId } },
          { idempotencyKey: { equals: idempotencyKey } },
        ],
      },
      ...(req ? { req: req as PayloadRequest } : {}),
    });
    return result.docs[0] ? parseStoredCommand(result.docs[0]) : null;
  }

  async readSnapshot(snapshotId: string) {
    return this.findSnapshot({ snapshotId: { equals: snapshotId } });
  }

  async readLatestSnapshot(caseId: string) {
    return this.findSnapshot(
      { caseId: { equals: caseId } },
      { sort: "-revision" },
    );
  }

  async readCommand(caseId: string, idempotencyKey: string) {
    return this.findCommand(caseId, idempotencyKey);
  }

  async isSnapshotInvalidated(snapshot: RoofSnapshotV1) {
    const result = await this.payload.find({
      collection: "case-address-revisions",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: {
        and: [
          { caseId: { equals: snapshot.subject.caseId } },
          { rfInvalidationStatus: { equals: "invalidated" } },
          { invalidatedRfSnapshotId: { equals: snapshot.snapshotId } },
          { invalidatedRfSnapshotRevision: { equals: snapshot.revision } },
          { invalidatedRfSnapshotHash: { equals: snapshot.snapshotHash } },
        ],
      },
    });
    return Boolean(result.docs[0]);
  }

  async appendAtomically(input: {
    expectedLatest: RoofSnapshotReferenceV1 | null;
    snapshot: RoofSnapshotV1;
    command: StoredRoofRepositoryCommandV1;
  }) {
    const snapshot = parseRoofSnapshotV1(input.snapshot);
    assertAppendBinding({ snapshot, command: input.command });
    const caseId = snapshot.subject.caseId;
    const request = { payload: this.payload } as TransactionRequest;
    const started = await initTransaction(request);
    if (!started) {
      throw repositoryIntegrity(
        "Roof Fusion append requires an independently owned database transaction",
        [caseId],
      );
    }

    let committed = false;
    try {
      const leadId = leadIdForPreviewCase(caseId);
      if (leadId) {
        const lead = await this.payload.findByID({
          collection: "leads",
          id: leadId,
          depth: 0,
          overrideAccess: true,
          req: request as PayloadRequest,
        });
        const caseRevision = Number(lead.caseRevision || 1);
        const context = {
          trustedCaseCommand: true,
          expectedCaseRevision: caseRevision,
        } as const;
        request.context = context;
        request.payloadAPI = "local";
        const lock = await this.payload.update({
          collection: "leads",
          depth: 0,
          overrideAccess: true,
          context,
          req: request as PayloadRequest,
          where: {
            and: [
              { id: { equals: leadId } },
              { caseRevision: { equals: caseRevision } },
            ],
          },
          data: { caseRevision },
        });
        if (!Array.isArray(lock.docs) || lock.docs.length !== 1) {
          throw repositoryIntegrity(
            "Roof Fusion append could not acquire the Preview case lock",
            [caseId],
          );
        }
      }
      const latest = await this.findSnapshot(
        { caseId: { equals: caseId } },
        { req: request, sort: "-revision" },
      );
      if (
        !referencesMatch(
          latest ? snapshotReference(latest) : null,
          input.expectedLatest,
        )
      ) {
        throw repositoryIntegrity("Atomic append compare-and-set failed", [
          caseId,
        ]);
      }
      if (
        (!latest &&
          (snapshot.revision !== 1 || snapshot.supersedesSnapshotId)) ||
        (latest &&
          (snapshot.revision !== latest.revision + 1 ||
            snapshot.supersedesSnapshotId !== latest.snapshotId))
      ) {
        throw repositoryIntegrity(
          "Atomic append snapshot lineage is not consecutive",
          [snapshot.snapshotId],
        );
      }
      if (
        await this.findSnapshot(
          { snapshotId: { equals: snapshot.snapshotId } },
          { req: request },
        )
      ) {
        throw new RoofRepositoryCommandErrorV1(
          "SNAPSHOT_ID_CONFLICT",
          "Append-only repository already contains the snapshot ID",
          [snapshot.snapshotId],
        );
      }
      if (
        await this.findCommand(
          caseId,
          input.command.result.idempotencyKey,
          request,
        )
      ) {
        throw new RoofRepositoryCommandErrorV1(
          "IDEMPOTENCY_CONFLICT",
          "Append-only repository already contains the command key",
          [input.command.result.idempotencyKey],
        );
      }

      await this.payload.create({
        collection: "roof-fusion-snapshots",
        context: { trustedRoofFusionAppend: true },
        data: {
          snapshotId: snapshot.snapshotId,
          caseId,
          caseRevisionKey: `${caseId}:${snapshot.revision}`,
          revision: snapshot.revision,
          ...(snapshot.supersedesSnapshotId
            ? { supersedesSnapshotId: snapshot.supersedesSnapshotId }
            : {}),
          snapshotHash: snapshot.snapshotHash,
          state: snapshot.state,
          measurementClass: snapshot.measurement.class,
          snapshot: clone(snapshot),
        },
        depth: 0,
        overrideAccess: true,
        req: request as PayloadRequest,
      });
      await this.payload.create({
        collection: "roof-fusion-commands",
        context: { trustedRoofFusionAppend: true },
        data: {
          ledgerKey: `${caseId}:${input.command.result.idempotencyKey}`,
          caseId,
          idempotencyKey: input.command.result.idempotencyKey,
          commandHash: input.command.commandHash,
          commandType: input.command.result.commandType,
          snapshotId: snapshot.snapshotId,
          result: clone(input.command.result),
        },
        depth: 0,
        overrideAccess: true,
        req: request as PayloadRequest,
      });
      await commitTransaction(request);
      committed = true;
    } catch (error) {
      if (!committed) await killTransaction(request);
      if (error instanceof RoofRepositoryCommandErrorV1) throw error;

      const [existingSnapshot, existingCommand] = await Promise.all([
        this.readSnapshot(snapshot.snapshotId).catch(() => null),
        this.readCommand(caseId, input.command.result.idempotencyKey).catch(
          () => null,
        ),
      ]);
      if (existingSnapshot) {
        throw new RoofRepositoryCommandErrorV1(
          "SNAPSHOT_ID_CONFLICT",
          "Append-only repository already contains the snapshot ID",
          [snapshot.snapshotId],
        );
      }
      if (existingCommand) {
        throw new RoofRepositoryCommandErrorV1(
          "IDEMPOTENCY_CONFLICT",
          "Append-only repository already contains the command key",
          [input.command.result.idempotencyKey],
        );
      }
      throw repositoryIntegrity(
        `Atomic Roof Fusion append failed: ${error instanceof Error ? error.message : String(error)}`,
        [snapshot.snapshotId],
      );
    }
  }
}
