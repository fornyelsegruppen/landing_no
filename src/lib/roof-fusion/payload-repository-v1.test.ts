import type { Payload } from "payload";
import { describe, expect, it } from "vitest";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import { PayloadRoofSnapshotRepositoryV1 } from "./payload-repository-v1";
import {
  executeRoofRepositoryCommandV1,
  RoofRepositoryCommandErrorV1,
  type RoofRepositoryCommandV1,
} from "./repository-contract-v1";

type CollectionName =
  "roof-fusion-snapshots" | "roof-fusion-commands" | "case-address-revisions";
type Row = Record<string, unknown>;
type Store = Record<CollectionName, Row[]>;

function cloneStore(store: Store): Store {
  return structuredClone(store);
}

function equalsWhere(row: Row, where: Record<string, unknown>): boolean {
  if (Array.isArray(where.and)) {
    return where.and.every((condition) =>
      equalsWhere(row, condition as Record<string, unknown>),
    );
  }
  return Object.entries(where).every(([field, condition]) => {
    if (!condition || typeof condition !== "object") return false;
    return row[field] === (condition as { equals?: unknown }).equals;
  });
}

class FakeTransactionalPayload {
  committed: Store = {
    "roof-fusion-snapshots": [],
    "roof-fusion-commands": [],
    "case-address-revisions": [],
  };
  private readonly transactions = new Map<string, Store>();
  private nextTransaction = 1;
  failCommandCreate = false;

  db = {
    beginTransaction: async () => {
      const id = `rf-transaction-${this.nextTransaction++}`;
      this.transactions.set(id, cloneStore(this.committed));
      return id;
    },
    commitTransaction: async (transactionId: string) => {
      this.committed = cloneStore(this.storeFor(transactionId));
      this.transactions.delete(transactionId);
    },
    rollbackTransaction: async (transactionId: string) => {
      this.transactions.delete(transactionId);
    },
  };

  private transactionId(input: { req?: { transactionID?: string } }) {
    return input.req?.transactionID;
  }

  private storeFor(transactionId?: string) {
    if (!transactionId) return this.committed;
    const store = this.transactions.get(transactionId);
    if (!store) throw new Error(`Unknown fake transaction ${transactionId}`);
    return store;
  }

  find = async (input: {
    collection: CollectionName;
    req?: { transactionID?: string };
    sort?: string;
    where: Record<string, unknown>;
  }) => {
    const store = this.storeFor(this.transactionId(input));
    const rows = store[input.collection].filter((row) =>
      equalsWhere(row, input.where),
    );
    if (input.sort === "-revision") {
      rows.sort(
        (left, right) => Number(right.revision) - Number(left.revision),
      );
    }
    return { docs: structuredClone(rows.slice(0, 1)) };
  };

  create = async (input: {
    collection: CollectionName;
    data: Row;
    req?: { transactionID?: string };
  }) => {
    if (input.collection === "roof-fusion-commands" && this.failCommandCreate) {
      throw new Error("Synthetic ledger failure");
    }
    const store = this.storeFor(this.transactionId(input));
    const uniqueFields =
      input.collection === "roof-fusion-snapshots"
        ? ["snapshotId", "caseRevisionKey"]
        : input.collection === "roof-fusion-commands"
          ? ["ledgerKey"]
          : ["ledgerKey", "revisionKey"];
    if (
      store[input.collection].some((row) =>
        uniqueFields.some((field) => row[field] === input.data[field]),
      )
    ) {
      throw new Error("Synthetic unique constraint violation");
    }
    const row = {
      ...structuredClone(input.data),
      id: store[input.collection].length + 1,
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    };
    store[input.collection].push(row);
    return structuredClone(row);
  };

  asPayload() {
    return this as unknown as Payload;
  }
}

function calculateCommand(): Extract<
  RoofRepositoryCommandV1,
  { commandType: "calculate" }
> {
  const snapshot = buildApprovedGableRoofFixtureV1().reviewedSnapshot;
  return {
    schemaVersion: "roof-repository-command.v1",
    commandType: "calculate",
    caseId: snapshot.subject.caseId,
    expectedLatestRevision: null,
    expectedLatestSnapshotHash: null,
    candidateSnapshot: snapshot,
    idempotencyKey: "roof-repository:case-12:payload-calculate-r1",
    actor: { actorId: "roof-fusion-engine", actorType: "system" },
    occurredAt: "2026-09-01T12:00:00.000Z",
  };
}

async function expectRepositoryError(
  operation: Promise<unknown>,
  code: RoofRepositoryCommandErrorV1["code"],
) {
  try {
    await operation;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(RoofRepositoryCommandErrorV1);
    expect((error as RoofRepositoryCommandErrorV1).code).toBe(code);
  }
}

describe("Payload Roof Snapshot repository v1", () => {
  it("atomically persists an authoritative snapshot and case-scoped command ledger", async () => {
    const payload = new FakeTransactionalPayload();
    const repository = new PayloadRoofSnapshotRepositoryV1(payload.asPayload());
    const command = calculateCommand();

    const applied = await executeRoofRepositoryCommandV1(repository, command);
    const replayed = await executeRoofRepositoryCommandV1(repository, command);

    expect(applied.status).toBe("applied");
    expect(replayed.status).toBe("replayed");
    expect(payload.committed["roof-fusion-snapshots"]).toHaveLength(1);
    expect(payload.committed["roof-fusion-commands"]).toHaveLength(1);
    expect(await repository.readLatestSnapshot(command.caseId)).toMatchObject({
      snapshotId: command.candidateSnapshot.snapshotId,
      snapshotHash: command.candidateSnapshot.snapshotHash,
    });
  });

  it("rolls the snapshot back when ledger persistence fails", async () => {
    const payload = new FakeTransactionalPayload();
    payload.failCommandCreate = true;
    const repository = new PayloadRoofSnapshotRepositoryV1(payload.asPayload());

    await expectRepositoryError(
      executeRoofRepositoryCommandV1(repository, calculateCommand()),
      "REPOSITORY_INTEGRITY",
    );
    expect(payload.committed["roof-fusion-snapshots"]).toHaveLength(0);
    expect(payload.committed["roof-fusion-commands"]).toHaveLength(0);
  });

  it("fails closed when indexed copies disagree with authoritative JSON", async () => {
    const payload = new FakeTransactionalPayload();
    const repository = new PayloadRoofSnapshotRepositoryV1(payload.asPayload());
    const command = calculateCommand();
    await executeRoofRepositoryCommandV1(repository, command);
    payload.committed["roof-fusion-snapshots"][0].snapshotHash = "0".repeat(64);

    await expectRepositoryError(
      repository.readSnapshot(command.candidateSnapshot.snapshotId),
      "REPOSITORY_INTEGRITY",
    );
  });

  it("requires a database transaction instead of degrading to split writes", async () => {
    const payload = new FakeTransactionalPayload();
    payload.db.beginTransaction = async () => "";
    const repository = new PayloadRoofSnapshotRepositoryV1(payload.asPayload());

    await expectRepositoryError(
      executeRoofRepositoryCommandV1(repository, calculateCommand()),
      "REPOSITORY_INTEGRITY",
    );
    expect(payload.committed["roof-fusion-snapshots"]).toHaveLength(0);
    expect(payload.committed["roof-fusion-commands"]).toHaveLength(0);
  });

  it("recognizes only an exact append-only address invalidation binding", async () => {
    const payload = new FakeTransactionalPayload();
    const repository = new PayloadRoofSnapshotRepositoryV1(payload.asPayload());
    const command = calculateCommand();
    await executeRoofRepositoryCommandV1(repository, command);
    const snapshot = command.candidateSnapshot;
    payload.committed["case-address-revisions"].push({
      ledgerKey: "address-ledger-1",
      revisionKey: `${snapshot.subject.caseId}:2`,
      caseId: snapshot.subject.caseId,
      rfInvalidationStatus: "invalidated",
      invalidatedRfSnapshotId: snapshot.snapshotId,
      invalidatedRfSnapshotRevision: snapshot.revision,
      invalidatedRfSnapshotHash: snapshot.snapshotHash,
    });

    await expect(repository.isSnapshotInvalidated(snapshot)).resolves.toBe(
      true,
    );
    await expect(
      repository.isSnapshotInvalidated({
        ...snapshot,
        snapshotHash: "0".repeat(64),
      }),
    ).resolves.toBe(false);
  });
});
