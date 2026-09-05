import type {
  AdminCaseWorkspace,
  CaseNextActionKind,
} from "@/lib/admin-v2/case-read-model";
import {
  ADMIN_NEXT_RF_ROUTE_VERSION,
  buildAdminNextRfRoute,
  type AdminNextRfRoute,
} from "@/lib/admin-next/rf-route-contract";
import {
  parseRoofSnapshotV1,
  type RoofSnapshotV1,
} from "@/lib/roof-fusion/roof-snapshot-v1";

export type AdminNextRfCaseEntryBlockReason =
  | "address_unverified"
  | "action_not_eligible"
  | "canonical_snapshot_missing"
  | "context_mismatch"
  | "invalid_snapshot"
  | "read_unavailable"
  | "route_unavailable"
  | "snapshot_blocked"
  | "snapshot_rejected"
  | "snapshot_superseded"
  | "target_unavailable";

export type AdminNextRfCaseEntryProjection =
  | {
      state: "new";
      mode: "new";
      href: null;
      reason: "creation_not_authorized";
    }
  | {
      state: "resume";
      mode: "resume";
      href: string;
      reason: null;
    }
  | {
      state: "review";
      mode: "review";
      href: string;
      reason: null;
    }
  | {
      state: "blocked";
      mode: null;
      href: null;
      reason: AdminNextRfCaseEntryBlockReason;
    };

const rfActionKinds = new Set<CaseNextActionKind>([
  "approve_measurement",
  "measurement_required",
]);

function blocked(
  reason: AdminNextRfCaseEntryBlockReason,
): AdminNextRfCaseEntryProjection {
  return { state: "blocked", mode: null, href: null, reason };
}

function buildPinnedRoute(
  value: AdminCaseWorkspace,
  snapshot: RoofSnapshotV1,
  mode: "resume" | "review",
): AdminNextRfCaseEntryProjection {
  const reference = `TF-${value.lead.id}` as `TF-${number}`;
  const route: AdminNextRfRoute = {
    version: ADMIN_NEXT_RF_ROUTE_VERSION,
    mode,
    case: {
      id: value.lead.id,
      reference,
      revision: value.lead.revision,
    },
    measurement: {
      id: snapshot.snapshotId,
      revision: snapshot.revision,
    },
    snapshot: {
      id: snapshot.snapshotId,
      revision: snapshot.revision,
      hash: snapshot.snapshotHash,
    },
    blocker:
      snapshot.state === "review_required"
        ? "measurement.review_required"
        : null,
    evidence: [],
    returnTo: `/admin-next-preview/cases/${reference}?tab=evidence#case-evidence-title`,
  };

  try {
    const href = buildAdminNextRfRoute(route);
    return mode === "resume"
      ? { state: "resume", mode: "resume", href, reason: null }
      : { state: "review", mode: "review", href, reason: null };
  } catch {
    return blocked("route_unavailable");
  }
}

/**
 * Projects the canonical Case -> RF entry without inventing a writable route.
 * A missing measurement is discoverable as `new`, but remains read-only until
 * RF owns an authorized create command. Every mismatch fails closed.
 */
export function projectAdminNextRfCaseEntry(
  value: AdminCaseWorkspace,
  rawSnapshot: unknown | null,
): AdminNextRfCaseEntryProjection {
  if (value.lead.addressVerificationStatus !== "verified") {
    return blocked("address_unverified");
  }
  const measurement = value.measurement;

  if (!measurement) {
    return rawSnapshot === null && value.nextAction.kind === "prepare_package"
      ? {
          state: "new",
          mode: "new",
          href: null,
          reason: "creation_not_authorized",
        }
      : blocked("target_unavailable");
  }
  if (!rfActionKinds.has(value.nextAction.kind)) {
    return blocked("action_not_eligible");
  }
  if (value.nextAction.targetId !== measurement.id) {
    return blocked("target_unavailable");
  }
  if (rawSnapshot === null) return blocked("canonical_snapshot_missing");

  let snapshot: RoofSnapshotV1;
  try {
    snapshot = parseRoofSnapshotV1(rawSnapshot);
  } catch {
    return blocked("invalid_snapshot");
  }

  const expectedCaseId = `lead:${value.lead.id}`;
  if (
    snapshot.subject.caseId !== expectedCaseId ||
    (snapshot.subject.legacyMeasurementId !== undefined &&
      String(snapshot.subject.legacyMeasurementId) !== String(measurement.id))
  ) {
    return blocked("context_mismatch");
  }

  if (value.nextAction.kind === "measurement_required") {
    return blocked("snapshot_blocked");
  }
  if (snapshot.state === "blocked") return blocked("snapshot_blocked");
  if (snapshot.state === "rejected") return blocked("snapshot_rejected");
  if (snapshot.state === "superseded") return blocked("snapshot_superseded");
  if (snapshot.state === "draft") {
    return buildPinnedRoute(value, snapshot, "resume");
  }
  return buildPinnedRoute(value, snapshot, "review");
}

export function unavailableAdminNextRfCaseEntry(): AdminNextRfCaseEntryProjection {
  return blocked("read_unavailable");
}

export const ADMIN_NEXT_RF_DISCOVERABILITY_TELEMETRY_VERSION =
  "admin-next-rf-discoverability-telemetry.v1" as const;

export type AdminNextRfDiscoverabilityEventKind =
  "entry_impression" | "entry_activation" | "return_activation";

export type AdminNextRfDiscoverabilityElapsedBucket =
  | "not_measured"
  | "under_150ms"
  | "150_to_499ms"
  | "500_to_1999ms"
  | "2000ms_or_more";

function elapsedBucket(
  elapsedMs: number | undefined,
): AdminNextRfDiscoverabilityElapsedBucket {
  if (elapsedMs === undefined || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return "not_measured";
  }
  if (elapsedMs < 150) return "under_150ms";
  if (elapsedMs < 500) return "150_to_499ms";
  if (elapsedMs < 2_000) return "500_to_1999ms";
  return "2000ms_or_more";
}

/**
 * Produces a closed, privacy-safe event envelope only. No raw case, snapshot,
 * measurement or actor identifier can enter the returned payload, and this
 * module deliberately performs no external send.
 */
export function projectAdminNextRfDiscoverabilityEvent(input: {
  kind: AdminNextRfDiscoverabilityEventKind;
  entry: AdminNextRfCaseEntryProjection;
  elapsedMs?: number;
}) {
  return {
    schemaVersion: ADMIN_NEXT_RF_DISCOVERABILITY_TELEMETRY_VERSION,
    event: input.kind,
    entryState: input.entry.state,
    routeMode: input.entry.mode,
    availability: input.entry.href
      ? ("available" as const)
      : ("blocked" as const),
    reasonCode: input.entry.reason,
    elapsedBucket: elapsedBucket(input.elapsedMs),
  };
}
