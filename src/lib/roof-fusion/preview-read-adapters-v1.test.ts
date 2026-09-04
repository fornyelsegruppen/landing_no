import type { Payload, PayloadRequest } from "payload";
import { describe, expect, it, vi } from "vitest";
import { FeatureUnavailableError } from "@/lib/platform/features";
import { buildApprovedGableRoofFixtureV1 } from "./gable-roof-fixture-v1";
import {
  AdminRoofFusionPreviewReadAdapterV1,
  PayloadRoofFusionCaseAuthorizationV1,
  RoofFusionPreviewReadErrorV1,
  WorkerRoofFusionPreviewRendererAdapterV1,
  roofFusionCaseIdForLeadV1,
  type RoofFusionCaseAuthorizationV1,
} from "./preview-read-adapters-v1";
import type { RoofSnapshotAppendOnlyRepositoryV1 } from "./repository-contract-v1";

const previewEnvironment = {
  FEATURE_ROOF_FUSION_V1: "true",
  VERCEL_ENV: "preview",
} as const;

function approvedRepository() {
  const snapshot = buildApprovedGableRoofFixtureV1().approvedSnapshot;
  const repository: RoofSnapshotAppendOnlyRepositoryV1 = {
    contractVersion: "roof-snapshot-repository.v1",
    readSnapshot: vi.fn(async (snapshotId: string) =>
      snapshotId === snapshot.snapshotId ? structuredClone(snapshot) : null,
    ),
    readLatestSnapshot: vi.fn(async (caseId: string) =>
      caseId === snapshot.subject.caseId ? structuredClone(snapshot) : null,
    ),
    readCommand: vi.fn(async () => null),
    isSnapshotInvalidated: vi.fn(async () => false),
    appendAtomically: vi.fn(async () => undefined),
  };
  return { repository, snapshot };
}

function allowedAuthorization(): RoofFusionCaseAuthorizationV1 {
  return {
    assertAdminCaseAccess: vi.fn(async () => undefined),
    assertAssignedWorkerCaseAccess: vi.fn(async () => undefined),
  };
}

const admin = {
  id: 1,
  role: "admin",
  active: true,
} as PayloadRequest["user"];
const worker = {
  id: 2,
  role: "worker",
  active: true,
} as PayloadRequest["user"];

describe("Roof Fusion Preview read adapters v1", () => {
  it("gives authorized administrators the full snapshot and evidence", async () => {
    const { repository, snapshot } = approvedRepository();
    const adapter = new AdminRoofFusionPreviewReadAdapterV1(
      repository,
      allowedAuthorization(),
      previewEnvironment,
    );

    await expect(
      adapter.readSnapshot(snapshot.subject.caseId, snapshot.snapshotId, admin),
    ).resolves.toEqual(snapshot);
    await expect(
      adapter.readEvidence(snapshot.subject.caseId, snapshot.snapshotId, admin),
    ).resolves.toMatchObject({
      schemaVersion: "roof-fusion-preview-read.v1",
      snapshotId: snapshot.snapshotId,
      snapshotHash: snapshot.snapshotHash,
      provenance: snapshot.provenance,
    });
  });

  it("returns only the approved renderer envelope to an assigned worker", async () => {
    const { repository, snapshot } = approvedRepository();
    const adapter = new WorkerRoofFusionPreviewRendererAdapterV1(
      repository,
      allowedAuthorization(),
      previewEnvironment,
    );
    const envelope = await adapter.readApprovedRenderer(
      {
        schemaVersion: "roof-renderer-read-binding.v1",
        caseId: snapshot.subject.caseId,
        snapshotId: snapshot.snapshotId,
        revision: snapshot.revision,
        snapshotHash: snapshot.snapshotHash,
        renderHash: snapshot.rendererPayload.renderHash,
      },
      worker,
    );

    expect(envelope.schemaVersion).toBe("approved-roof-renderer-envelope.v1");
    expect(Object.keys(envelope).sort()).toEqual([
      "approval",
      "payload",
      "schemaVersion",
      "snapshotId",
      "snapshotRevision",
      "sourceSnapshotHash",
    ]);
    expect(JSON.stringify(envelope)).not.toContain("provenance");
    expect(JSON.stringify(envelope)).not.toContain("rawContentHash");
  });

  it("rejects an exact RF snapshot invalidated by a case address correction", async () => {
    const { repository, snapshot } = approvedRepository();
    repository.isSnapshotInvalidated = vi.fn(async () => true);
    const adapter = new AdminRoofFusionPreviewReadAdapterV1(
      repository,
      allowedAuthorization(),
      previewEnvironment,
    );

    await expect(
      adapter.readLatestSnapshot(snapshot.subject.caseId, admin),
    ).rejects.toMatchObject({ code: "SOURCE_INVALIDATED" });
    await expect(
      adapter.readSnapshot(snapshot.subject.caseId, snapshot.snapshotId, admin),
    ).rejects.toMatchObject({ code: "SOURCE_INVALIDATED" });
    await expect(
      adapter.readEvidence(snapshot.subject.caseId, snapshot.snapshotId, admin),
    ).rejects.toMatchObject({ code: "SOURCE_INVALIDATED" });
    expect(repository.isSnapshotInvalidated).toHaveBeenCalledTimes(3);
  });

  it("cannot be enabled by either legacy roof flag", async () => {
    const { repository, snapshot } = approvedRepository();
    const adapter = new AdminRoofFusionPreviewReadAdapterV1(
      repository,
      allowedAuthorization(),
      {
        VERCEL_ENV: "preview",
        FEATURE_ROOF_MEASUREMENT: "true",
        FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
        BLOB_READ_WRITE_TOKEN: "configured",
      },
    );

    await expect(
      adapter.readSnapshot(snapshot.subject.caseId, snapshot.snapshotId, admin),
    ).rejects.toEqual(new FeatureUnavailableError("roofFusionV1", "disabled"));
  });

  it("fails closed outside Preview even with the independent flag enabled", async () => {
    const { repository, snapshot } = approvedRepository();
    const adapter = new AdminRoofFusionPreviewReadAdapterV1(
      repository,
      allowedAuthorization(),
      { FEATURE_ROOF_FUSION_V1: "true", VERCEL_ENV: "production" },
    );

    await expect(
      adapter.readSnapshot(snapshot.subject.caseId, snapshot.snapshotId, admin),
    ).rejects.toMatchObject({ code: "PREVIEW_REQUIRED" });
  });

  it("checks case authorization before any repository read", async () => {
    const { repository, snapshot } = approvedRepository();
    const authorization: RoofFusionCaseAuthorizationV1 = {
      assertAdminCaseAccess: vi.fn(async () => {
        throw new RoofFusionPreviewReadErrorV1("CASE_ACCESS_DENIED", "denied");
      }),
      assertAssignedWorkerCaseAccess: vi.fn(async () => {
        throw new RoofFusionPreviewReadErrorV1("CASE_ACCESS_DENIED", "denied");
      }),
    };
    const adminAdapter = new AdminRoofFusionPreviewReadAdapterV1(
      repository,
      authorization,
      previewEnvironment,
    );
    const workerAdapter = new WorkerRoofFusionPreviewRendererAdapterV1(
      repository,
      authorization,
      previewEnvironment,
    );

    await expect(
      adminAdapter.readSnapshot(
        snapshot.subject.caseId,
        snapshot.snapshotId,
        admin,
      ),
    ).rejects.toMatchObject({ code: "CASE_ACCESS_DENIED" });
    await expect(
      workerAdapter.readApprovedRenderer(
        {
          schemaVersion: "roof-renderer-read-binding.v1",
          caseId: snapshot.subject.caseId,
          snapshotId: snapshot.snapshotId,
          revision: snapshot.revision,
          snapshotHash: snapshot.snapshotHash,
          renderHash: snapshot.rendererPayload.renderHash,
        },
        worker,
      ),
    ).rejects.toMatchObject({ code: "CASE_ACCESS_DENIED" });
    expect(repository.readSnapshot).not.toHaveBeenCalled();
  });
});

describe("Payload Roof Fusion case authorization v1", () => {
  it("uses explicit lead linkage and assigned work-order scope", async () => {
    const findByID = vi.fn(async () => ({ id: 12 }));
    const find = vi.fn(async () => ({ docs: [{ id: 7 }] }));
    const authorization = new PayloadRoofFusionCaseAuthorizationV1({
      find,
      findByID,
    } as unknown as Payload);

    expect(roofFusionCaseIdForLeadV1(12)).toBe("lead:12");
    await expect(
      authorization.assertAdminCaseAccess("lead:12", admin),
    ).resolves.toBeUndefined();
    await expect(
      authorization.assertAssignedWorkerCaseAccess("lead:12", worker),
    ).resolves.toBeUndefined();
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "leads", id: 12 }),
    );
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "work-orders",
        where: {
          and: [{ lead: { equals: 12 } }, { assignedWorker: { equals: 2 } }],
        },
      }),
    );
  });

  it("rejects wrong roles and unassigned workers", async () => {
    const authorization = new PayloadRoofFusionCaseAuthorizationV1({
      find: vi.fn(async () => ({ docs: [] })),
      findByID: vi.fn(async () => ({ id: 12 })),
    } as unknown as Payload);

    await expect(
      authorization.assertAdminCaseAccess("lead:12", worker),
    ).rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
    await expect(
      authorization.assertAssignedWorkerCaseAccess("lead:12", worker),
    ).rejects.toMatchObject({ code: "CASE_ACCESS_DENIED" });
    await expect(
      authorization.assertAdminCaseAccess("case-12", admin),
    ).rejects.toMatchObject({ code: "CASE_NOT_FOUND" });
  });
});
