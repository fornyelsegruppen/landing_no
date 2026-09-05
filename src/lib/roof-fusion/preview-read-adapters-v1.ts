import type { Payload, PayloadRequest } from "payload";
import { assertFeatureReady, type Environment } from "@/lib/platform/features";
import { userIsAdmin, userIsWorker } from "@/payload/access/roles";
import { roofFusionCapabilityAllowsActorV1 } from "./capability-contract-v1";
import {
  readBoundApprovedRoofRendererV1,
  type RoofRendererReadBindingV1,
  type RoofSnapshotAppendOnlyRepositoryV1,
} from "./repository-contract-v1";
import type { RoofSnapshotV1 } from "./roof-snapshot-v1";

export const ROOF_FUSION_PREVIEW_READ_VERSION =
  "roof-fusion-preview-read.v1" as const;

export type RoofFusionPreviewReadErrorCodeV1 =
  | "PREVIEW_REQUIRED"
  | "CAPABILITY_DENIED"
  | "CASE_ACCESS_DENIED"
  | "CASE_NOT_FOUND"
  | "SOURCE_INVALIDATED";

export class RoofFusionPreviewReadErrorV1 extends Error {
  constructor(
    readonly code: RoofFusionPreviewReadErrorCodeV1,
    message: string,
  ) {
    super(message);
    this.name = "RoofFusionPreviewReadErrorV1";
  }
}

export function assertRoofFusionPreviewReadEnabledV1(
  environment: Environment = process.env,
) {
  assertFeatureReady("roofFusionV1", environment);
  if (environment.VERCEL_ENV !== "preview") {
    throw new RoofFusionPreviewReadErrorV1(
      "PREVIEW_REQUIRED",
      "Roof Fusion v1 reads are restricted to the Preview environment",
    );
  }
}

export const assertRoofFusionPreviewEnabledV1 =
  assertRoofFusionPreviewReadEnabledV1;

export function roofFusionCaseIdForLeadV1(leadId: string | number) {
  const normalized = String(leadId);
  if (!/^[1-9]\d*$/u.test(normalized)) {
    throw new RoofFusionPreviewReadErrorV1(
      "CASE_NOT_FOUND",
      "Roof Fusion case linkage is invalid",
    );
  }
  return `lead:${normalized}`;
}

function leadIdForRoofFusionCaseV1(caseId: string) {
  const match = /^lead:([1-9]\d*)$/u.exec(caseId);
  if (!match) {
    throw new RoofFusionPreviewReadErrorV1(
      "CASE_NOT_FOUND",
      "Roof Fusion case linkage is invalid",
    );
  }
  const leadId = Number(match[1]);
  if (!Number.isSafeInteger(leadId)) {
    throw new RoofFusionPreviewReadErrorV1(
      "CASE_NOT_FOUND",
      "Roof Fusion case linkage is invalid",
    );
  }
  return leadId;
}

export interface RoofFusionCaseAuthorizationV1 {
  assertAdminCaseAccess(
    caseId: string,
    user: PayloadRequest["user"],
  ): Promise<void>;
  assertAssignedWorkerCaseAccess(
    caseId: string,
    user: PayloadRequest["user"],
  ): Promise<void>;
}

export class PayloadRoofFusionCaseAuthorizationV1 implements RoofFusionCaseAuthorizationV1 {
  constructor(private readonly payload: Payload) {}

  async assertAdminCaseAccess(caseId: string, user: PayloadRequest["user"]) {
    if (!userIsAdmin(user)) {
      throw new RoofFusionPreviewReadErrorV1(
        "CAPABILITY_DENIED",
        "Administrator Roof Fusion capability is required",
      );
    }
    const leadId = leadIdForRoofFusionCaseV1(caseId);
    const lead = await this.payload
      .findByID({
        collection: "leads",
        id: leadId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null);
    if (!lead) {
      throw new RoofFusionPreviewReadErrorV1(
        "CASE_NOT_FOUND",
        "Roof Fusion case does not exist",
      );
    }
  }

  async assertAssignedWorkerCaseAccess(
    caseId: string,
    user: PayloadRequest["user"],
  ) {
    if (!userIsWorker(user) || user?.id === undefined) {
      throw new RoofFusionPreviewReadErrorV1(
        "CAPABILITY_DENIED",
        "Assigned-worker Roof Fusion capability is required",
      );
    }
    const leadId = leadIdForRoofFusionCaseV1(caseId);
    const workOrders = await this.payload.find({
      collection: "work-orders",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: {
        and: [
          { lead: { equals: leadId } },
          { assignedWorker: { equals: user.id } },
        ],
      },
    });
    if (workOrders.docs.length === 0) {
      throw new RoofFusionPreviewReadErrorV1(
        "CASE_ACCESS_DENIED",
        "Worker is not assigned to the Roof Fusion case",
      );
    }
  }
}

function assertCapability(
  capability:
    | "roof_fusion.snapshot.read"
    | "roof_fusion.evidence.read"
    | "roof_fusion.renderer.read_approved",
  actor: "administrator" | "assigned_worker",
) {
  if (!roofFusionCapabilityAllowsActorV1(capability, actor)) {
    throw new RoofFusionPreviewReadErrorV1(
      "CAPABILITY_DENIED",
      `Actor cannot use ${capability}`,
    );
  }
}

function assertSnapshotCase(snapshot: RoofSnapshotV1, caseId: string) {
  if (snapshot.subject.caseId !== caseId) {
    throw new RoofFusionPreviewReadErrorV1(
      "CASE_ACCESS_DENIED",
      "Roof Fusion snapshot is outside the authorized case",
    );
  }
}

export class AdminRoofFusionPreviewReadAdapterV1 {
  readonly contractVersion = ROOF_FUSION_PREVIEW_READ_VERSION;

  constructor(
    private readonly repository: RoofSnapshotAppendOnlyRepositoryV1,
    private readonly authorization: RoofFusionCaseAuthorizationV1,
    private readonly environment: Environment = process.env,
  ) {}

  private async authorize(
    capability: "roof_fusion.snapshot.read" | "roof_fusion.evidence.read",
    caseId: string,
    user: PayloadRequest["user"],
  ) {
    assertRoofFusionPreviewReadEnabledV1(this.environment);
    assertCapability(capability, "administrator");
    await this.authorization.assertAdminCaseAccess(caseId, user);
  }

  async readSnapshot(
    caseId: string,
    snapshotId: string,
    user: PayloadRequest["user"],
  ) {
    await this.authorize("roof_fusion.snapshot.read", caseId, user);
    const snapshot = await this.repository.readSnapshot(snapshotId);
    if (!snapshot) return null;
    assertSnapshotCase(snapshot, caseId);
    if (await this.repository.isSnapshotInvalidated(snapshot)) {
      throw new RoofFusionPreviewReadErrorV1(
        "SOURCE_INVALIDATED",
        "Roof Fusion source was invalidated by a case address correction",
      );
    }
    return snapshot;
  }

  async readLatestSnapshot(caseId: string, user: PayloadRequest["user"]) {
    await this.authorize("roof_fusion.snapshot.read", caseId, user);
    const snapshot = await this.repository.readLatestSnapshot(caseId);
    if (!snapshot) return null;
    assertSnapshotCase(snapshot, caseId);
    if (await this.repository.isSnapshotInvalidated(snapshot)) {
      throw new RoofFusionPreviewReadErrorV1(
        "SOURCE_INVALIDATED",
        "Roof Fusion source was invalidated by a case address correction",
      );
    }
    return snapshot;
  }

  async readEvidence(
    caseId: string,
    snapshotId: string,
    user: PayloadRequest["user"],
  ) {
    await this.authorize("roof_fusion.evidence.read", caseId, user);
    const snapshot = await this.repository.readSnapshot(snapshotId);
    if (!snapshot) return null;
    assertSnapshotCase(snapshot, caseId);
    if (await this.repository.isSnapshotInvalidated(snapshot)) {
      throw new RoofFusionPreviewReadErrorV1(
        "SOURCE_INVALIDATED",
        "Roof Fusion source was invalidated by a case address correction",
      );
    }
    return {
      schemaVersion: ROOF_FUSION_PREVIEW_READ_VERSION,
      caseId,
      snapshotId: snapshot.snapshotId,
      revision: snapshot.revision,
      snapshotHash: snapshot.snapshotHash,
      provenance: structuredClone(snapshot.provenance),
    } as const;
  }
}

export class WorkerRoofFusionPreviewRendererAdapterV1 {
  readonly contractVersion = ROOF_FUSION_PREVIEW_READ_VERSION;

  constructor(
    private readonly repository: RoofSnapshotAppendOnlyRepositoryV1,
    private readonly authorization: RoofFusionCaseAuthorizationV1,
    private readonly environment: Environment = process.env,
  ) {}

  async readApprovedRenderer(
    binding: RoofRendererReadBindingV1,
    user: PayloadRequest["user"],
  ) {
    assertRoofFusionPreviewReadEnabledV1(this.environment);
    assertCapability("roof_fusion.renderer.read_approved", "assigned_worker");
    await this.authorization.assertAssignedWorkerCaseAccess(
      binding.caseId,
      user,
    );
    return readBoundApprovedRoofRendererV1(this.repository, binding);
  }
}
