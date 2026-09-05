import { describe, expect, it } from "vitest";
import type { AdminCaseWorkspace } from "@/lib/admin-v2/case-read-model";
import {
  projectAdminNextRfCaseEntry,
  projectAdminNextRfDiscoverabilityEvent,
} from "@/lib/admin-next/rf-case-entry-projection";
import { parseAdminNextRfRoute } from "@/lib/admin-next/rf-route-contract";
import { buildRoofFusionPreviewUatGoldenPlanV1 } from "@/lib/roof-fusion/preview-uat-golden-v1";
import {
  buildRoofSnapshotV1,
  type RoofSnapshotSeedV1,
  type RoofSnapshotV1,
} from "@/lib/roof-fusion/roof-snapshot-v1";

function workspace(
  overrides: Partial<AdminCaseWorkspace> = {},
): AdminCaseWorkspace {
  return {
    lead: {
      id: 13,
      addressVerificationStatus: "verified",
      name: "Canonical customer",
      recordState: "active",
      revision: 7,
    },
    measurement: {
      id: 31,
      reference: "R4-31",
      status: "review_required",
      href: "/admin/collections/roof-measurements/31",
    },
    nextAction: { kind: "approve_measurement", targetId: 31 },
    documents: [],
    timeline: [],
    ...overrides,
  } as unknown as AdminCaseWorkspace;
}

function withLifecycle(
  snapshot: RoofSnapshotV1,
  state: "draft" | "blocked" | "rejected" | "superseded",
) {
  const {
    quality: _quality,
    rendererPayload: _rendererPayload,
    snapshotHash: _snapshotHash,
    totals: _totals,
    ...seed
  } = structuredClone(snapshot);
  void _quality;
  void _rendererPayload;
  void _snapshotHash;
  void _totals;
  const input: RoofSnapshotSeedV1 = {
    ...seed,
    state,
    approval: { status: state === "rejected" ? "rejected" : "not_requested" },
  };
  return buildRoofSnapshotV1(input);
}

describe("Admin Next Case to RF entry projection", () => {
  it("blocks every RF entry for a manual or unverified case address", () => {
    const current = workspace();
    const value = workspace({
      lead: {
        ...current.lead,
        addressVerificationStatus: "manual",
      },
    });

    expect(projectAdminNextRfCaseEntry(value, null)).toEqual({
      state: "blocked",
      mode: null,
      href: null,
      reason: "address_unverified",
    });
  });

  it("projects a canonical draft as a pinned resume route", async () => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
    const draft = withLifecycle(plan.snapshots[0], "draft");
    const result = projectAdminNextRfCaseEntry(workspace(), draft);

    expect(result).toMatchObject({
      state: "resume",
      mode: "resume",
      reason: null,
    });
    if (result.state !== "resume") throw new Error("expected resume entry");
    const parsed = parseAdminNextRfRoute(result.href);
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        mode: "resume",
        case: { id: 13, reference: "TF-13", revision: 7 },
        measurement: {
          id: draft.snapshotId,
          revision: draft.revision,
        },
        snapshot: {
          id: draft.snapshotId,
          revision: draft.revision,
          hash: draft.snapshotHash,
        },
      },
    });
  });

  it.each(["review_required", "approved"] as const)(
    "projects %s as an exact pinned review route",
    async (state) => {
      const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
      const snapshot =
        state === "approved" ? plan.finalSnapshot : plan.snapshots[0];
      const result = projectAdminNextRfCaseEntry(workspace(), snapshot);

      expect(result).toMatchObject({
        state: "review",
        mode: "review",
        reason: null,
      });
      if (result.state !== "review") throw new Error("expected review entry");
      const parsed = parseAdminNextRfRoute(result.href);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok || parsed.value.mode !== "review") {
        throw new Error("expected a valid review route");
      }
      expect(parsed.value.snapshot.hash).toBe(snapshot.snapshotHash);
      expect(parsed.value.blocker).toBe(
        state === "review_required" ? "measurement.review_required" : null,
      );
    },
  );

  it.each([
    ["blocked", "snapshot_blocked"],
    ["rejected", "snapshot_rejected"],
    ["superseded", "snapshot_superseded"],
  ] as const)("fails closed for a %s snapshot", async (state, reason) => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
    const snapshot = withLifecycle(plan.snapshots[0], state);

    expect(projectAdminNextRfCaseEntry(workspace(), snapshot)).toEqual({
      state: "blocked",
      mode: null,
      href: null,
      reason,
    });
  });

  it("fails closed for the canonical blocked action even if RF still has a draft", async () => {
    const plan = await buildRoofFusionPreviewUatGoldenPlanV1(13);
    const snapshot = withLifecycle(plan.snapshots[0], "draft");
    const result = projectAdminNextRfCaseEntry(
      workspace({
        nextAction: { kind: "measurement_required", targetId: 31 },
      }),
      snapshot,
    );

    expect(result).toEqual({
      state: "blocked",
      mode: null,
      href: null,
      reason: "snapshot_blocked",
    });
  });

  it("recognizes new work without inventing an authorized create CTA", () => {
    const result = projectAdminNextRfCaseEntry(
      workspace({
        measurement: undefined,
        nextAction: { kind: "prepare_package" },
      }),
      null,
    );

    expect(result).toEqual({
      state: "new",
      mode: "new",
      href: null,
      reason: "creation_not_authorized",
    });
  });

  it.each([
    [
      "missing target id",
      workspace({ nextAction: { kind: "approve_measurement" } }),
      "target_unavailable",
    ],
    [
      "wrong target id",
      workspace({
        nextAction: { kind: "approve_measurement", targetId: 99 },
      }),
      "target_unavailable",
    ],
    [
      "unrelated action",
      workspace({ nextAction: { kind: "calculate_price", targetId: 31 } }),
      "action_not_eligible",
    ],
  ] as const)("fails closed for %s", async (_name, value, reason) => {
    const snapshot = (
      await buildRoofFusionPreviewUatGoldenPlanV1(value.lead.id)
    ).finalSnapshot;

    expect(projectAdminNextRfCaseEntry(value, snapshot)).toEqual({
      state: "blocked",
      mode: null,
      href: null,
      reason,
    });
  });

  it("fails closed when snapshot identity belongs to another case", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(14))
      .finalSnapshot;

    expect(projectAdminNextRfCaseEntry(workspace(), snapshot)).toEqual({
      state: "blocked",
      mode: null,
      href: null,
      reason: "context_mismatch",
    });
  });
});

describe("RF discoverability telemetry projection", () => {
  it("emits only closed, privacy-safe dimensions and buckets elapsed time", async () => {
    const snapshot = (await buildRoofFusionPreviewUatGoldenPlanV1(13))
      .finalSnapshot;
    const entry = projectAdminNextRfCaseEntry(workspace(), snapshot);
    const event = projectAdminNextRfDiscoverabilityEvent({
      kind: "entry_activation",
      entry,
      elapsedMs: 151,
    });

    expect(event).toEqual({
      schemaVersion: "admin-next-rf-discoverability-telemetry.v1",
      event: "entry_activation",
      entryState: "review",
      routeMode: "review",
      availability: "available",
      reasonCode: null,
      elapsedBucket: "150_to_499ms",
    });
    expect(Object.keys(event)).toEqual([
      "schemaVersion",
      "event",
      "entryState",
      "routeMode",
      "availability",
      "reasonCode",
      "elapsedBucket",
    ]);
    expect(JSON.stringify(event)).not.toMatch(
      /TF-13|lead:13|rf-uat|Canonical customer|admin@example\.invalid/u,
    );
  });

  it("records blocked impressions without identifiers or raw timing", () => {
    const entry = projectAdminNextRfCaseEntry(
      workspace({ nextAction: { kind: "approve_measurement" } }),
      null,
    );

    expect(
      projectAdminNextRfDiscoverabilityEvent({
        kind: "entry_impression",
        entry,
        elapsedMs: 2_100,
      }),
    ).toEqual({
      schemaVersion: "admin-next-rf-discoverability-telemetry.v1",
      event: "entry_impression",
      entryState: "blocked",
      routeMode: null,
      availability: "blocked",
      reasonCode: "target_unavailable",
      elapsedBucket: "2000ms_or_more",
    });
  });
});
