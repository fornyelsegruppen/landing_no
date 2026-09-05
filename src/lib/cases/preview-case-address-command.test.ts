import type { Payload } from "payload";
import { describe, expect, it } from "vitest";
import { buildRoofFusionPreviewUatGoldenPlanV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";
import {
  executePreviewCaseAddressCommand,
  PREVIEW_CASE_ADDRESS_COMMAND_VERSION,
  PreviewCaseAddressCommandError,
  type PreviewCaseAddressCommand,
} from "./preview-case-address-command";

type Collection =
  | "audit-events"
  | "case-address-revisions"
  | "contracts"
  | "leads"
  | "quotes"
  | "roof-fusion-snapshots";
type Row = Record<string, unknown>;
type Store = Record<Collection, Row[]>;

function cloneStore(store: Store) {
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
  committed: Store;
  private readonly transactions = new Map<string, Store>();
  private readonly sessions: Record<
    string,
    { db: ReturnType<FakeTransactionalPayload["rowLockDatabase"]> }
  > = {};
  private readonly leadLocks = new Map<
    number,
    {
      owner: string;
      released: Promise<void>;
      release: () => void;
    }
  >();
  private nextTransaction = 1;
  failAuditCreate = false;
  disableTransactions = false;
  leadBulkUpdateCalls = 0;

  constructor(rfRows: Row[] = []) {
    this.committed = {
      "audit-events": [],
      "case-address-revisions": [],
      contracts: [],
      leads: [
        {
          id: 13,
          address: "Old gate",
          houseNumber: "1",
          postal: "0001",
          city: "Oslo",
          caseRevision: 7,
          addressRevision: 1,
        },
      ],
      quotes: [],
      "roof-fusion-snapshots": rfRows,
    };
  }

  db = {
    packageName: "@payloadcms/db-postgres",
    sessions: this.sessions,
    tables: { leads: { id: {} } },
    beginTransaction: async () => {
      if (this.disableTransactions) return "";
      const id = `address-tx-${this.nextTransaction++}`;
      this.transactions.set(id, cloneStore(this.committed));
      this.sessions[id] = { db: this.rowLockDatabase(id) };
      return id;
    },
    commitTransaction: async (id: string) => {
      this.committed = cloneStore(this.storeFor(id));
      this.transactions.delete(id);
      delete this.sessions[id];
      this.releaseLeadLocks(id);
    },
    rollbackTransaction: async (id: string) => {
      this.transactions.delete(id);
      delete this.sessions[id];
      this.releaseLeadLocks(id);
    },
  };

  private rowLockDatabase(transactionId: string) {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            for: async (strength: "update") => {
              if (strength !== "update") throw new Error("invalid lock");
              return this.acquireLeadLock(transactionId, 13);
            },
          }),
        }),
      }),
    };
  }

  private async acquireLeadLock(transactionId: string, leadId: number) {
    while (true) {
      const existing = this.leadLocks.get(leadId);
      if (!existing || existing.owner === transactionId) break;
      await existing.released;
    }
    if (!this.leadLocks.has(leadId)) {
      let release: () => void = () => {};
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      this.leadLocks.set(leadId, {
        owner: transactionId,
        released,
        release,
      });
    }

    // PostgreSQL READ COMMITTED takes a fresh snapshot after a competing row
    // lock is released. The fake mirrors that boundary for concurrency tests.
    this.transactions.set(transactionId, cloneStore(this.committed));
    const row = this.storeFor(transactionId).leads.find(
      ({ id }) => id === leadId,
    );
    return row ? [{ id: row.id }] : [];
  }

  private releaseLeadLocks(transactionId: string) {
    for (const [leadId, lock] of this.leadLocks) {
      if (lock.owner !== transactionId) continue;
      this.leadLocks.delete(leadId);
      lock.release();
    }
  }

  private storeFor(id?: string) {
    if (!id) return this.committed;
    const store = this.transactions.get(id);
    if (!store) throw new Error(`Unknown transaction ${id}`);
    return store;
  }

  private transactionId(input: { req?: { transactionID?: string } }) {
    return input.req?.transactionID;
  }

  find = async (input: {
    collection: Collection;
    req?: { transactionID?: string };
    sort?: string;
    where: Record<string, unknown>;
  }) => {
    const rows = this.storeFor(this.transactionId(input))
      [input.collection].filter((row) => equalsWhere(row, input.where))
      .sort((left, right) => {
        if (input.sort === "-revision") {
          return Number(right.revision) - Number(left.revision);
        }
        if (input.sort === "-addressRevision") {
          return Number(right.addressRevision) - Number(left.addressRevision);
        }
        return 0;
      });
    return { docs: structuredClone(rows.slice(0, 1)) };
  };

  findByID = async (input: {
    collection: "leads";
    id: number;
    req?: { transactionID?: string };
  }) => {
    const row = this.storeFor(this.transactionId(input)).leads.find(
      ({ id }) => id === input.id,
    );
    if (!row) throw new Error("not found");
    return structuredClone(row);
  };

  update = async (input: {
    collection: "contracts" | "leads" | "quotes";
    id?: number;
    data: Row;
    req?: { transactionID?: string };
    where?: Record<string, unknown>;
  }) => {
    const store = this.storeFor(this.transactionId(input));
    if (input.where) {
      if (input.collection === "leads") {
        this.leadBulkUpdateCalls += 1;
        return {
          docs: [],
          errors: [
            {
              id: 13,
              message: "Case address revisions must advance exactly once",
            },
          ],
        };
      }
      const rows = store[input.collection].filter((row) =>
        equalsWhere(row, input.where!),
      );
      rows.forEach((row) => Object.assign(row, structuredClone(input.data)));
      return { docs: structuredClone(rows), errors: [] };
    }
    const row = store[input.collection].find(({ id }) => id === input.id);
    if (!row) throw new Error("not found");
    Object.assign(row, structuredClone(input.data));
    return structuredClone(row);
  };

  create = async (input: {
    collection: "audit-events" | "case-address-revisions";
    data: Row;
    req?: { transactionID?: string };
  }) => {
    if (input.collection === "audit-events" && this.failAuditCreate) {
      throw new Error("synthetic audit failure");
    }
    const store = this.storeFor(this.transactionId(input));
    if (
      input.collection === "case-address-revisions" &&
      store[input.collection].some(
        (row) =>
          row.ledgerKey === input.data.ledgerKey ||
          row.revisionKey === input.data.revisionKey,
      )
    ) {
      throw new Error("synthetic unique conflict");
    }
    const row = {
      id: store[input.collection].length + 1,
      ...structuredClone(input.data),
    };
    store[input.collection].push(row);
    return structuredClone(row);
  };

  asPayload() {
    return this as unknown as Payload;
  }
}

function command(
  overrides: Partial<PreviewCaseAddressCommand> = {},
): PreviewCaseAddressCommand {
  return {
    schemaVersion: PREVIEW_CASE_ADDRESS_COMMAND_VERSION,
    leadId: 13,
    expectedCaseRevision: 7,
    expectedAddressRevision: 1,
    idempotencyKey: "address-correction-13-r1",
    correlationId: "corr-address-13-r1",
    actorId: 7,
    reasonCode: "operator_correction",
    address: {
      street: "New gate",
      houseNumber: "2A",
      postalCode: "0001",
      city: "Oslo",
    },
    ...overrides,
  };
}

const previewEnvironment = {
  VERCEL_ENV: "preview",
  FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND: "true",
};

async function expectCode(operation: Promise<unknown>, code: string) {
  try {
    await operation;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(PreviewCaseAddressCommandError);
    expect((error as PreviewCaseAddressCommandError).code).toBe(code);
  }
}

describe("Preview case address command", () => {
  it.each([
    [
      {
        VERCEL_ENV: "production",
        FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND: "true",
      },
      "PREVIEW_REQUIRED",
    ],
    [
      {
        VERCEL_ENV: "preview",
        FEATURE_ADMIN_NEXT_CASE_ADDRESS_COMMAND: "false",
      },
      "FEATURE_DISABLED",
    ],
  ] as const)(
    "fails closed before a transaction for %j",
    async (environment, code) => {
      const payload = new FakeTransactionalPayload();
      await expectCode(
        executePreviewCaseAddressCommand({
          payload: payload.asPayload(),
          command: command(),
          environment,
        }),
        code,
      );
      expect(payload.committed["case-address-revisions"]).toEqual([]);
    },
  );

  it("atomically advances both revisions, appends history and invalidates exact RF source", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    const payload = new FakeTransactionalPayload([
      {
        snapshotId: snapshot.snapshotId,
        caseId: snapshot.subject.caseId,
        revision: snapshot.revision,
        snapshotHash: snapshot.snapshotHash,
        snapshot,
      },
    ]);

    const result = await executePreviewCaseAddressCommand({
      payload: payload.asPayload(),
      command: command(),
      environment: previewEnvironment,
      now: new Date("2026-09-04T18:00:00.000Z"),
    });

    expect(result).toEqual({
      schemaVersion: "preview-case-address-command-result.v1",
      status: "applied",
      case: { id: 13, caseRevision: 8, addressRevision: 2 },
      address: {
        street: "New gate",
        houseNumber: "2A",
        postalCode: "0001",
        city: "Oslo",
      },
      rfInvalidation: {
        status: "invalidated",
        snapshot: {
          id: snapshot.snapshotId,
          revision: snapshot.revision,
          hash: snapshot.snapshotHash,
        },
      },
      commercialDraftInvalidation: {
        status: "not_applicable",
        quoteIds: [],
        contractIds: [],
      },
    });
    expect(payload.committed.leads[0]).toMatchObject({
      address: "New gate",
      houseNumber: "2A",
      postal: "0001",
      city: "Oslo",
      caseRevision: 8,
      addressRevision: 2,
    });
    expect(payload.committed["case-address-revisions"][0]).toMatchObject({
      caseId: "lead:13",
      previousAddressRevision: 1,
      addressRevision: 2,
      expectedCaseRevision: 7,
      resultingCaseRevision: 8,
      idempotencyKey: "address-correction-13-r1",
      correlationId: "corr-address-13-r1",
      actor: 7,
      rfInvalidationStatus: "invalidated",
      invalidatedRfSnapshotId: snapshot.snapshotId,
      invalidatedRfSnapshotRevision: snapshot.revision,
      invalidatedRfSnapshotHash: snapshot.snapshotHash,
    });
    expect(payload.committed["audit-events"][0]).toMatchObject({
      actor: 7,
      action: "case.address_corrected",
      entityType: "lead",
      entityId: "13",
      correlationId: "corr-address-13-r1",
      beforeHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      afterHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      metadata: {
        caseRevision: 8,
        revision: 2,
        idempotencyDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
        rfInvalidated: true,
      },
    });
    expect(JSON.stringify(payload.committed["audit-events"])).not.toMatch(
      /Old gate|New gate|2A/u,
    );
    // The former pseudo-lock used a Payload bulk update with the unchanged
    // caseRevision. Payload captured the hook failure in `errors` and returned
    // `docs: []`. A real row lock must never invoke that bulk path.
    expect(payload.leadBulkUpdateCalls).toBe(0);
  });

  it("supersedes only draft documents bound to the invalidated exact RF snapshot", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    const payload = new FakeTransactionalPayload([
      {
        snapshotId: snapshot.snapshotId,
        caseId: snapshot.subject.caseId,
        revision: snapshot.revision,
        snapshotHash: snapshot.snapshotHash,
        snapshot,
      },
    ]);
    payload.committed.quotes.push({
      id: 41,
      lead: 13,
      status: "draft",
      snapshot: {
        measurement: {
          rfBinding: {
            snapshotId: snapshot.snapshotId,
            snapshotRevision: snapshot.revision,
            snapshotHash: snapshot.snapshotHash,
          },
        },
      },
    });
    payload.committed.contracts.push({
      id: 51,
      quote: 41,
      status: "draft",
    });

    const result = await executePreviewCaseAddressCommand({
      payload: payload.asPayload(),
      command: command(),
      environment: previewEnvironment,
    });

    expect(result.commercialDraftInvalidation).toEqual({
      status: "invalidated",
      quoteIds: [41],
      contractIds: [51],
    });
    expect(payload.committed.quotes[0].status).toBe("superseded");
    expect(payload.committed.contracts[0].status).toBe("superseded");
    expect(payload.committed["audit-events"][0]).toMatchObject({
      metadata: {
        quoteDraftsInvalidated: 1,
        contractDraftsInvalidated: 1,
      },
    });
  });

  it("replays the stored result and rejects the same key with another command hash", async () => {
    const payload = new FakeTransactionalPayload();
    const applied = await executePreviewCaseAddressCommand({
      payload: payload.asPayload(),
      command: command(),
      environment: previewEnvironment,
    });
    const replayed = await executePreviewCaseAddressCommand({
      payload: payload.asPayload(),
      command: command({ correlationId: "corr-address-retry" }),
      environment: previewEnvironment,
    });

    expect(replayed).toEqual({ ...applied, status: "replayed" });
    expect(payload.committed["case-address-revisions"]).toHaveLength(1);
    expect(payload.committed["audit-events"]).toHaveLength(1);

    await expectCode(
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command({
          address: { ...command().address, street: "Different gate" },
        }),
        environment: previewEnvironment,
      }),
      "IDEMPOTENCY_CONFLICT",
    );
    expect(payload.committed["case-address-revisions"]).toHaveLength(1);
  });

  it("replays an identical command that waited behind a concurrent winner", async () => {
    const payload = new FakeTransactionalPayload();
    const results = await Promise.all([
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command(),
        environment: previewEnvironment,
      }),
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command({ correlationId: "corr-concurrent-retry" }),
        environment: previewEnvironment,
      }),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      "applied",
      "replayed",
    ]);
    expect(payload.committed["case-address-revisions"]).toHaveLength(1);
    expect(payload.committed["audit-events"]).toHaveLength(1);
    expect(payload.committed.leads[0]).toMatchObject({
      caseRevision: 8,
      addressRevision: 2,
    });
  });

  it("allows only one of two competing address revisions to commit", async () => {
    const payload = new FakeTransactionalPayload();
    const results = await Promise.allSettled([
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command(),
        environment: previewEnvironment,
      }),
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command({
          idempotencyKey: "address-correction-13-competing",
          correlationId: "corr-address-13-competing",
          address: { ...command().address, street: "Competing gate" },
        }),
        environment: previewEnvironment,
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.objectContaining({
        code: "CASE_REVISION_CONFLICT",
        expectedRevision: 7,
        actualRevision: 8,
      }),
    });
    expect(payload.committed["case-address-revisions"]).toHaveLength(1);
    expect(payload.committed["audit-events"]).toHaveLength(1);
    expect(payload.committed.leads[0]).toMatchObject({
      caseRevision: 8,
      addressRevision: 2,
    });
    expect(["New gate", "Competing gate"]).toContain(
      payload.committed.leads[0].address,
    );
  });

  it.each([
    ["expectedCaseRevision", 6, "CASE_REVISION_CONFLICT"],
    ["expectedAddressRevision", 2, "ADDRESS_REVISION_CONFLICT"],
  ] as const)("rejects stale %s", async (field, value, code) => {
    const payload = new FakeTransactionalPayload();
    await expectCode(
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command({ [field]: value }),
        environment: previewEnvironment,
      }),
      code,
    );
    expect(payload.committed.leads[0]).toMatchObject({
      caseRevision: 7,
      addressRevision: 1,
    });
  });

  it("rolls the lead, RF-bound drafts and history back when audit append fails", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    const payload = new FakeTransactionalPayload([
      {
        snapshotId: snapshot.snapshotId,
        caseId: snapshot.subject.caseId,
        revision: snapshot.revision,
        snapshotHash: snapshot.snapshotHash,
        snapshot,
      },
    ]);
    payload.committed.quotes.push({
      id: 41,
      lead: 13,
      status: "draft",
      snapshot: {
        measurement: {
          rfBinding: {
            snapshotId: snapshot.snapshotId,
            snapshotRevision: snapshot.revision,
            snapshotHash: snapshot.snapshotHash,
          },
        },
      },
    });
    payload.committed.contracts.push({
      id: 51,
      quote: 41,
      status: "draft",
    });
    payload.failAuditCreate = true;

    await expectCode(
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command(),
        environment: previewEnvironment,
      }),
      "REPOSITORY_INTEGRITY",
    );
    expect(payload.committed.leads[0]).toMatchObject({
      address: "Old gate",
      caseRevision: 7,
      addressRevision: 1,
    });
    expect(payload.committed["case-address-revisions"]).toEqual([]);
    expect(payload.committed.quotes[0]).toMatchObject({ status: "draft" });
    expect(payload.committed.contracts[0]).toMatchObject({ status: "draft" });
    expect(payload.committed["audit-events"]).toEqual([]);
  });

  it("refuses to degrade to split writes without a transaction", async () => {
    const payload = new FakeTransactionalPayload();
    payload.disableTransactions = true;
    await expectCode(
      executePreviewCaseAddressCommand({
        payload: payload.asPayload(),
        command: command(),
        environment: previewEnvironment,
      }),
      "TRANSACTION_REQUIRED",
    );
    expect(payload.committed.leads[0]).toMatchObject({ caseRevision: 7 });
  });
});
