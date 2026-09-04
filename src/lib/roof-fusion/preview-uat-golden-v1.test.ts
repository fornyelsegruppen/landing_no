import { describe, expect, it, vi } from "vitest";
import { FeatureUnavailableError } from "@/lib/platform/features";
import {
  executeRoofRepositoryCommandV1,
  InMemoryRoofSnapshotRepositoryV1,
} from "./repository-contract-v1";
import {
  buildRoofFusionPreviewUatGoldenPlanV1,
  prepareRoofFusionPreviewUatGoldenV1,
  RoofFusionPreviewUatConflictErrorV1,
} from "./preview-uat-golden-v1";

const preview = {
  FEATURE_ROOF_FUSION_V1: "true",
  VERCEL_ENV: "preview",
} as const;

describe("Roof Fusion Preview UAT golden harness v1", () => {
  it("prepares one deterministic lifecycle and replays idempotently", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    const first = await prepareRoofFusionPreviewUatGoldenV1({
      repository,
      leadId: 13,
      environment: preview,
    });
    const second = await prepareRoofFusionPreviewUatGoldenV1({
      repository,
      leadId: 13,
      environment: preview,
    });

    expect(first).toMatchObject({
      status: "prepared",
      snapshot: {
        snapshotId: "rf-uat-lead-13-r3-approved",
        revision: 3,
        state: "approved",
      },
    });
    expect(second).toEqual({ ...first, status: "already_prepared" });
    expect(await repository.readLatestSnapshot("lead:13")).toMatchObject({
      snapshotId: first.snapshot.snapshotId,
      snapshotHash: first.snapshot.snapshotHash,
    });
    expect(
      await repository.readCommand("lead:13", "roof-uat:lead-13:approve-r2"),
    ).not.toBeNull();
  });

  it("denies Production and cannot be enabled by legacy roof flags", async () => {
    const repository = {
      contractVersion: "roof-snapshot-repository.v1" as const,
      readSnapshot: vi.fn(),
      readLatestSnapshot: vi.fn(),
      readCommand: vi.fn(),
      isSnapshotInvalidated: vi.fn(async () => false),
      appendAtomically: vi.fn(),
    };
    await expect(
      prepareRoofFusionPreviewUatGoldenV1({
        repository,
        leadId: 13,
        environment: {
          FEATURE_ROOF_FUSION_V1: "true",
          VERCEL_ENV: "production",
        },
      }),
    ).rejects.toMatchObject({ code: "PREVIEW_REQUIRED" });
    await expect(
      prepareRoofFusionPreviewUatGoldenV1({
        repository,
        leadId: 13,
        environment: {
          FEATURE_MEASUREMENT_EVIDENCE_V2: "true",
          FEATURE_ROOF_MEASUREMENT: "true",
          VERCEL_ENV: "preview",
        },
      }),
    ).rejects.toEqual(new FeatureUnavailableError("roofFusionV1", "disabled"));
    expect(repository.readLatestSnapshot).not.toHaveBeenCalled();
  });

  it("resumes its exact partial lifecycle without duplicating revisions", async () => {
    const repository = new InMemoryRoofSnapshotRepositoryV1();
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
    await executeRoofRepositoryCommandV1(repository, plan.commands[0]);

    await expect(
      prepareRoofFusionPreviewUatGoldenV1({
        repository,
        leadId: 13,
        environment: preview,
      }),
    ).resolves.toMatchObject({
      status: "prepared",
      snapshot: { revision: 3, state: "approved" },
    });
    expect(await repository.readLatestSnapshot("lead:13")).toMatchObject({
      revision: 3,
      state: "approved",
    });
  });

  it("refuses to overwrite a different canonical case lifecycle", async () => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
    const repository = {
      contractVersion: "roof-snapshot-repository.v1" as const,
      readSnapshot: vi.fn(),
      readLatestSnapshot: vi.fn().mockResolvedValue({
        ...plan.snapshots[0],
        snapshotId: "different-canonical-snapshot",
      }),
      readCommand: vi.fn(),
      isSnapshotInvalidated: vi.fn(async () => false),
      appendAtomically: vi.fn(),
    };

    await expect(
      prepareRoofFusionPreviewUatGoldenV1({
        repository,
        leadId: 13,
        environment: preview,
      }),
    ).rejects.toBeInstanceOf(RoofFusionPreviewUatConflictErrorV1);
    expect(repository.appendAtomically).not.toHaveBeenCalled();
  });
});
