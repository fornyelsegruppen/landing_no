import type { Payload } from "payload";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  createQuoteDraft: vi.fn(),
  init: vi.fn(),
  kill: vi.fn(),
}));

vi.mock("payload", async (original) => {
  const actual = await original<typeof import("payload")>();
  return {
    ...actual,
    commitTransaction: mocks.commit,
    initTransaction: mocks.init,
    killTransaction: mocks.kill,
  };
});
vi.mock("@/lib/quotes/payload-quote-engine", () => ({
  createQuoteDraft: mocks.createQuoteDraft,
}));

import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import { executeRoofFusionOfferBridgeV1 } from "./offer-bridge-v1";

function equalsValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const field = record[key];
  if (field && typeof field === "object" && "equals" in field) {
    return (field as { equals?: unknown }).equals;
  }
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = equalsValue(item, key);
        if (found !== undefined) return found;
      }
    } else {
      const found = equalsValue(child, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function fakePayload(
  options: { raceLatestSnapshot?: boolean; reviewed?: boolean } = {},
) {
  const roofFixture = buildApprovedGableRoofFixtureV1({
    caseId: "lead:12",
    snapshotId: "roof-lead-12-r1",
  });
  const snapshot = options.reviewed
    ? roofFixture.reviewedSnapshot
    : roofFixture.approvedSnapshot;
  const offerCommands: Record<string, unknown>[] = [];
  const roofCommands: Record<string, unknown>[] = [];
  const snapshots: Record<string, unknown>[] = [
    {
      snapshotId: snapshot.snapshotId,
      caseId: snapshot.subject.caseId,
      caseRevisionKey: `${snapshot.subject.caseId}:${snapshot.revision}`,
      revision: snapshot.revision,
      supersedesSnapshotId: snapshot.supersedesSnapshotId,
      snapshotHash: snapshot.snapshotHash,
      state: snapshot.state,
      measurementClass: snapshot.measurement.class,
      snapshot,
    },
  ];
  const created: Array<{ collection: string; data: Record<string, unknown> }> = [];
  const lead = {
    id: 12,
    address: "Lyngveien",
    houseNumber: "1",
    postal: "4021",
    city: "Stavanger",
    inquiryType: "takvask",
    caseRevision: 3,
    addressRevision: 2,
  };
  let raceInjected = false;
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === "leads") return lead;
      throw new Error(`Unexpected findByID: ${collection}`);
    }),
    update: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === "leads") {
        if (options.raceLatestSnapshot && !raceInjected) {
          raceInjected = true;
          const concurrent = buildApprovedGableRoofFixtureV1({
            caseId: "lead:12",
            snapshotId: "roof-lead-12-concurrent",
          }).approvedSnapshot;
          snapshots.push({
            snapshotId: concurrent.snapshotId,
            caseId: concurrent.subject.caseId,
            caseRevisionKey: `${concurrent.subject.caseId}:${concurrent.revision}`,
            revision: concurrent.revision,
            supersedesSnapshotId: concurrent.supersedesSnapshotId,
            snapshotHash: concurrent.snapshotHash,
            state: concurrent.state,
            measurementClass: concurrent.measurement.class,
            snapshot: concurrent,
          });
        }
        return { docs: [lead] };
      }
      throw new Error(`Unexpected update: ${collection}`);
    }),
    find: vi.fn(
      async ({ collection, where }: { collection: string; where?: unknown }) => {
        if (collection === "roof-fusion-offer-commands") {
          const expectedScopeKey = equalsValue(where, "idempotencyScopeKey");
          const expectedLedgerKey = equalsValue(where, "ledgerKey");
          const exact = offerCommands.find(
            (row) =>
              (expectedScopeKey !== undefined &&
                row.idempotencyScopeKey === expectedScopeKey) ||
              (expectedLedgerKey !== undefined &&
                row.ledgerKey === expectedLedgerKey),
          );
          return { docs: exact ? [exact] : [] };
        }
        if (collection === "roof-fusion-snapshots") {
          const expectedSnapshotId = equalsValue(where, "snapshotId");
          const exact = snapshots.find(
            (row) => row.snapshotId === expectedSnapshotId,
          );
          return {
            docs:
              expectedSnapshotId !== undefined
                ? exact
                  ? [exact]
                  : []
                : snapshots.slice(-1),
          };
        }
        if (collection === "roof-fusion-commands") {
          const expectedIdempotencyKey = equalsValue(
            where,
            "idempotencyKey",
          );
          const exact = roofCommands.find((row) =>
            row.idempotencyKey === expectedIdempotencyKey,
          );
          return { docs: exact ? [exact] : [] };
        }
        if (collection === "case-address-revisions") return { docs: [] };
        if (collection === "roof-measurements") return { docs: [] };
        if (collection === "price-rules") {
          return {
            docs: [
              {
                id: 21,
                version: 4,
                serviceKey: "takvask",
                unitPriceExVatOre: 10_000,
                vatBasisPoints: 2_500,
                minimumExVatOre: 0,
                toleranceBasisPoints: 1_000,
                maximumExVatOre: null,
                status: "approved",
              },
            ],
          };
        }
        throw new Error(`Unexpected find: ${collection} ${JSON.stringify(where)}`);
      },
    ),
    create: vi.fn(
      async ({
        collection,
        data,
      }: {
        collection: string;
        data: Record<string, unknown>;
      }) => {
        created.push({ collection, data });
        if (collection === "roof-measurements") return { id: 31, ...data };
        if (collection === "price-calculations") return { id: 32, ...data };
        if (collection === "roof-fusion-snapshots") {
          const row = { id: snapshots.length + 1, ...data };
          snapshots.push(row);
          return row;
        }
        if (collection === "roof-fusion-commands") {
          const row = { id: roofCommands.length + 1, ...data };
          roofCommands.push(row);
          return row;
        }
        if (collection === "roof-fusion-offer-commands") {
          offerCommands.push({ id: 61, ...data });
          return { id: 61, ...data };
        }
        if (collection === "audit-events") return { id: 71, ...data };
        throw new Error(`Unexpected create: ${collection}`);
      },
    ),
  };
  return {
    created,
    offerCommands,
    payload: payload as unknown as Payload,
    snapshot,
    snapshots,
  };
}

describe("Preview Roof Fusion offer bridge", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ADMIN_NEXT_MODE", "preview");
    vi.stubEnv("FEATURE_ROOF_FUSION_V1", "true");
    vi.stubEnv("FEATURE_ADMIN_NEXT_RF_OFFER_BRIDGE", "true");
    mocks.init.mockReset().mockResolvedValue("tx-1");
    mocks.commit.mockReset().mockResolvedValue(undefined);
    mocks.kill.mockReset().mockResolvedValue(undefined);
    mocks.createQuoteDraft.mockReset().mockResolvedValue({
      quote: { id: 41, version: 3 },
      contract: { id: 51 },
      snapshot: {},
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("commits an exact RF-bound measurement, price, offer and contract without customer contact", async () => {
    const fixture = fakePayload();
    const request = {
      schemaVersion: "roof-fusion-offer-bridge-request.v1" as const,
      caseId: "lead:12",
      expectedCaseRevision: 3,
      expectedAddressRevision: 2,
      snapshot: {
        snapshotId: fixture.snapshot.snapshotId,
        revision: fixture.snapshot.revision,
        snapshotHash: fixture.snapshot.snapshotHash,
        inputHash: fixture.snapshot.inputHash,
        renderHash: fixture.snapshot.rendererPayload.renderHash,
      },
      idempotencyKey: "offer-lead-12-r1",
    };

    const first = await executeRoofFusionOfferBridgeV1({
      payload: fixture.payload,
      request,
      actorId: 7,
      correlationId: "corr-rf-offer-test",
      now: new Date("2026-09-04T19:00:00.000Z"),
    });
    const replay = await executeRoofFusionOfferBridgeV1({
      payload: fixture.payload,
      request,
      actorId: 7,
      correlationId: "corr-rf-offer-test",
      now: new Date("2026-09-04T19:00:00.000Z"),
    });
    const bindingReplay = await executeRoofFusionOfferBridgeV1({
      payload: fixture.payload,
      request: {
        ...request,
        idempotencyKey: "offer-lead-12-r1-after-browser-refresh",
      },
      actorId: 7,
      correlationId: "corr-rf-offer-refresh",
      now: new Date("2026-09-04T19:01:00.000Z"),
    });

    expect(first).toMatchObject({
      status: "applied",
      caseId: "lead:12",
      customerSideEffects: "none",
      measurement: { id: 31, version: 1 },
      quote: { id: 41, version: 3 },
      contractId: 51,
    });
    expect(replay.status).toBe("replayed");
    expect(bindingReplay.status).toBe("replayed");
    expect(mocks.createQuoteDraft).toHaveBeenCalledWith(
      fixture.payload,
      32,
      new Date("2026-09-04T19:00:00.000Z"),
      expect.objectContaining({
        preservePrevious: true,
        req: expect.any(Object),
      }),
    );
    expect(
      fixture.created.find((entry) => entry.collection === "roof-measurements")
        ?.data,
    ).toMatchObject({
      sourceKind: "roof_fusion",
      caseRevision: 3,
      addressRevision: 2,
      rfSnapshotId: fixture.snapshot.snapshotId,
      rfSnapshotHash: fixture.snapshot.snapshotHash,
      status: "approved",
    });
    expect(
      fixture.created.filter((entry) => entry.collection === "messages"),
    ).toEqual([]);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.kill).not.toHaveBeenCalled();
    expect(fixture.offerCommands).toHaveLength(1);
  });

  it("rolls back the package if quote/contract draft creation is blocked", async () => {
    const fixture = fakePayload();
    mocks.createQuoteDraft.mockRejectedValue(
      new Error("An accepted quote requires a controlled change agreement"),
    );

    await expect(
      executeRoofFusionOfferBridgeV1({
        payload: fixture.payload,
        request: {
          schemaVersion: "roof-fusion-offer-bridge-request.v1",
          caseId: "lead:12",
          expectedCaseRevision: 3,
          expectedAddressRevision: 2,
          snapshot: {
            snapshotId: fixture.snapshot.snapshotId,
            revision: fixture.snapshot.revision,
            snapshotHash: fixture.snapshot.snapshotHash,
            inputHash: fixture.snapshot.inputHash,
            renderHash: fixture.snapshot.rendererPayload.renderHash,
          },
          idempotencyKey: "offer-lead-12-r1",
        },
        actorId: 7,
        correlationId: "corr-rf-offer-test",
      }),
    ).rejects.toMatchObject({ code: "PACKAGE_CONFLICT" });
    expect(mocks.kill).toHaveBeenCalledTimes(1);
    expect(fixture.offerCommands).toEqual([]);
  });

  it("rejects an idempotency key reused for a different exact binding", async () => {
    const fixture = fakePayload();
    const base = {
      schemaVersion: "roof-fusion-offer-bridge-request.v1" as const,
      caseId: "lead:12",
      expectedCaseRevision: 3,
      expectedAddressRevision: 2,
      snapshot: {
        snapshotId: fixture.snapshot.snapshotId,
        revision: fixture.snapshot.revision,
        snapshotHash: fixture.snapshot.snapshotHash,
        inputHash: fixture.snapshot.inputHash,
        renderHash: fixture.snapshot.rendererPayload.renderHash,
      },
      idempotencyKey: "offer-lead-12-idempotency-scope",
    };
    await executeRoofFusionOfferBridgeV1({
      payload: fixture.payload,
      request: base,
      actorId: 7,
      correlationId: "corr-rf-offer-idem-first",
    });

    await expect(
      executeRoofFusionOfferBridgeV1({
        payload: fixture.payload,
        request: { ...base, expectedAddressRevision: 3 },
        actorId: 7,
        correlationId: "corr-rf-offer-idem-conflict",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(fixture.offerCommands).toHaveLength(1);
  });

  it("revalidates the latest RF snapshot after acquiring the case lock", async () => {
    const fixture = fakePayload({ raceLatestSnapshot: true });

    await expect(
      executeRoofFusionOfferBridgeV1({
        payload: fixture.payload,
        request: {
          schemaVersion: "roof-fusion-offer-bridge-request.v1",
          caseId: "lead:12",
          expectedCaseRevision: 3,
          expectedAddressRevision: 2,
          snapshot: {
            snapshotId: fixture.snapshot.snapshotId,
            revision: fixture.snapshot.revision,
            snapshotHash: fixture.snapshot.snapshotHash,
            inputHash: fixture.snapshot.inputHash,
            renderHash: fixture.snapshot.rendererPayload.renderHash,
          },
          idempotencyKey: "offer-lead-12-rf-race",
        },
        actorId: 7,
        correlationId: "corr-rf-offer-race",
      }),
    ).rejects.toMatchObject({ code: "STALE_SNAPSHOT" });
    expect(mocks.createQuoteDraft).not.toHaveBeenCalled();
    expect(mocks.kill).toHaveBeenCalledTimes(1);
    expect(fixture.offerCommands).toEqual([]);
  });

  it("turns the reviewed exact snapshot into a new append-only approved revision before pricing", async () => {
    const fixture = fakePayload({ reviewed: true });
    const result = await executeRoofFusionOfferBridgeV1({
      payload: fixture.payload,
      request: {
        schemaVersion: "roof-fusion-offer-bridge-request.v1",
        caseId: "lead:12",
        expectedCaseRevision: 3,
        expectedAddressRevision: 2,
        snapshot: {
          snapshotId: fixture.snapshot.snapshotId,
          revision: fixture.snapshot.revision,
          snapshotHash: fixture.snapshot.snapshotHash,
          inputHash: fixture.snapshot.inputHash,
          renderHash: fixture.snapshot.rendererPayload.renderHash,
        },
        idempotencyKey: "offer-reviewed-lead-12-r1",
      },
      actorId: 7,
      actorDisplayName: "RF Reviewer",
      correlationId: "corr-rf-offer-review",
      now: new Date("2026-09-04T19:00:00.000Z"),
    });

    expect(fixture.snapshots).toHaveLength(2);
    expect(fixture.snapshots[1]).toMatchObject({
      caseId: "lead:12",
      revision: 2,
      state: "approved",
      supersedesSnapshotId: fixture.snapshot.snapshotId,
    });
    expect(result.snapshot).toMatchObject({
      snapshotId: fixture.snapshots[1].snapshotId,
      revision: 2,
    });
    expect(mocks.commit).toHaveBeenCalledTimes(2);
    expect(fixture.payload.update).toHaveBeenCalledTimes(2);
  });

  it("rejects Production before touching Payload", async () => {
    const fixture = fakePayload();
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(
      executeRoofFusionOfferBridgeV1({
        payload: fixture.payload,
        request: {} as never,
        actorId: 7,
        correlationId: "corr-rf-offer-test",
      }),
    ).rejects.toMatchObject({ code: "PREVIEW_REQUIRED" });
    expect(fixture.payload.find).not.toHaveBeenCalled();
    expect(fixture.payload.findByID).not.toHaveBeenCalled();
    expect(fixture.payload.create).not.toHaveBeenCalled();
  });
});
