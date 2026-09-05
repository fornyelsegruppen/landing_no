import type { AdminCaseListItem } from "@/lib/admin-v2/case-list";
import {
  getCaseNextActionPresentation,
  type CaseNextActionLocale,
} from "@/lib/admin-v2/case-next-action-presentation";
import {
  rankTodayItems,
  type TodayHardStop,
  type TodayRecovery,
} from "./today-priority";
import {
  createWorkQueueItem,
  createWorkQueuePage,
  deriveWorkQueueFacets,
  type CanonicalWorkQueueQuery,
  type WorkQueueBlocker,
  type WorkQueueCursor,
  type WorkQueueExactTarget,
  type WorkQueueInteraction,
  type WorkQueueItem,
  type WorkQueuePage,
  type WorkQueueSourceTruth,
} from "./work-queue-contract";

export type AdminCaseListWorkQueueRow = {
  item: AdminCaseListItem;
  caseRevision: number | null;
  exactTarget?: WorkQueueExactTarget | null;
  /** False when no operator route consumes the derived sub-entity identity. */
  exactTargetAvailable?: boolean;
  ownerId: string | null;
  wakeAt?: string | null;
  blockers?: readonly WorkQueueBlocker[];
  capabilityGranted: boolean;
  diagnosticBlocker?: string | null;
  prioritySignals?: {
    hardStop?: TodayHardStop | null;
    recovery?: TodayRecovery | null;
    transitionBlocked?: boolean;
  };
};

export type ProjectAdminCaseListWorkQueueInput = {
  rows: readonly AdminCaseListWorkQueueRow[];
  locale: CaseNextActionLocale;
  now: Date;
  query: CanonicalWorkQueueQuery;
  sourceKind: WorkQueueSourceTruth["kind"];
  currentUserId?: string | null;
  offset?: number;
  nextCursor?: WorkQueueCursor | null;
};

export type WorkQueueReadAdapterErrorCode =
  | "DUPLICATE_REVISION_CONFLICT"
  | "INACTIVE_CASE"
  | "INVALID_NOW"
  | "INVALID_OFFSET"
  | "INVALID_SOURCE_CASE"
  | "MISSING_CASE_REVISION"
  | "MISSING_CURRENT_USER"
  | "MISSING_EXACT_TARGET"
  | "MISSING_NEXT_CURSOR"
  | "MISSING_OWNER_ID";

export class WorkQueueReadAdapterError extends Error {
  constructor(
    readonly code: WorkQueueReadAdapterErrorCode,
    readonly caseId: string | null,
    message: string,
  ) {
    super(message);
    this.name = "WorkQueueReadAdapterError";
  }
}

function adapterError(
  code: WorkQueueReadAdapterErrorCode,
  caseId: string | null,
  message: string,
): never {
  throw new WorkQueueReadAdapterError(code, caseId, message);
}

function stableCaseId(item: AdminCaseListItem) {
  if (!Number.isInteger(item.id) || item.id <= 0) {
    adapterError(
      "INVALID_SOURCE_CASE",
      null,
      "Case list item has no stable ID",
    );
  }
  return `case:${item.id}`;
}

function canonicalCustomerName(item: AdminCaseListItem) {
  const value = item.customer.trim();
  return value && value !== `#${item.id}` ? value : null;
}

function exactTarget(
  row: AdminCaseListWorkQueueRow,
  caseId: string,
  caseRevision: number,
) {
  if (row.exactTarget) return row.exactTarget;
  if (row.exactTargetAvailable === false) {
    return {
      availability: "case_recovery",
      entity: "case",
      id: caseId,
      version: `r${caseRevision}`,
      href: row.item.href,
    } as const;
  }
  const presentation = getCaseNextActionPresentation(row.item.nextAction, "en");
  if (presentation.target.entity !== "case") {
    adapterError(
      "MISSING_EXACT_TARGET",
      caseId,
      `Action ${row.item.nextAction} requires an exact ${presentation.target.entity} target`,
    );
  }
  return {
    availability: "exact",
    entity: "case",
    id: caseId,
    version: `r${caseRevision}`,
    href: row.item.href,
  } as const;
}

function resolvedOwnerId(row: AdminCaseListWorkQueueRow, caseId: string) {
  const presentation = getCaseNextActionPresentation(row.item.nextAction, "en");
  if (presentation.owner.party === "none") return null;
  if (
    ["customer", "worker", "system"].includes(presentation.owner.party) &&
    !row.ownerId
  ) {
    adapterError(
      "MISSING_OWNER_ID",
      caseId,
      `Action ${row.item.nextAction} requires a stable ${presentation.owner.party} owner`,
    );
  }
  return row.ownerId;
}

function interactionFor(
  row: AdminCaseListWorkQueueRow,
  sourceKind: WorkQueueSourceTruth["kind"],
): WorkQueueInteraction {
  const presentation = getCaseNextActionPresentation(row.item.nextAction, "en");
  if (row.diagnosticBlocker) {
    return { mode: "read_only", reason: "diagnostic_blocker" };
  }
  if (presentation.reviewMode === "waiting") {
    const party = presentation.owner.party;
    if (party !== "customer" && party !== "worker" && party !== "system") {
      adapterError(
        "INVALID_SOURCE_CASE",
        `case:${row.item.id}`,
        "Waiting action has no supported waiting party",
      );
    }
    return { mode: "waiting", waitingParty: party };
  }
  if (presentation.reviewMode === "none") {
    return { mode: "read_only", reason: "no_action" };
  }
  if (sourceKind === "shadow_read") {
    return { mode: "read_only", reason: "source_not_canonical" };
  }
  if (row.exactTargetAvailable === false) {
    return { mode: "read_only", reason: "target_unavailable" };
  }
  if (!row.capabilityGranted) {
    return { mode: "read_only", reason: "capability_denied" };
  }
  return { mode: "executable", activation: { kind: "open_workbench" } };
}

function projectRow(
  row: AdminCaseListWorkQueueRow,
  input: ProjectAdminCaseListWorkQueueInput,
): WorkQueueItem {
  const caseId = stableCaseId(row.item);
  if (row.item.recordState !== "active") {
    adapterError(
      "INACTIVE_CASE",
      caseId,
      "Today work queue accepts active cases only",
    );
  }
  if (
    row.caseRevision === null ||
    !Number.isInteger(row.caseRevision) ||
    row.caseRevision < 1
  ) {
    adapterError(
      "MISSING_CASE_REVISION",
      caseId,
      "Canonical case revision is required",
    );
  }
  const presentation = getCaseNextActionPresentation(
    row.item.nextAction,
    input.locale,
  );
  const ownerId = resolvedOwnerId(row, caseId);
  return createWorkQueueItem(
    {
      case: {
        customerName: canonicalCustomerName(row.item),
        id: caseId,
        postalAddress: row.item.postalAddress,
        revision: row.caseRevision,
        reference: `TF-${row.item.id}`,
        href: row.item.href,
      },
      locale: input.locale,
      actionKind: row.item.nextAction,
      owner: { id: ownerId, party: presentation.owner.party },
      timing: { dueAt: row.item.dueAt, wakeAt: row.wakeAt },
      prioritySignals: row.prioritySignals,
      blockers: row.blockers || [],
      capabilityGranted: row.capabilityGranted,
      target: exactTarget(row, caseId, row.caseRevision),
      sourceTruth: {
        kind: input.sourceKind,
        resolver: "deriveCaseNextAction",
        contractVersion: "f2-v1",
        derivedAt: input.now.toISOString(),
      },
      interaction: interactionFor(row, input.sourceKind),
    },
    input.now,
  );
}

function itemFingerprint(item: WorkQueueItem) {
  return JSON.stringify({
    case: {
      customerName: item.case.customerName,
      postalAddress: item.case.postalAddress,
      revision: item.case.revision,
    },
    kind: item.action.kind,
    owner: item.owner,
    timing: item.timing,
    blockers: item.blockers,
    target: item.target,
    sourceKind: item.sourceTruth.kind,
    interaction: item.interaction,
  });
}

function dedupeNewest(items: readonly WorkQueueItem[]) {
  const result = new Map<string, WorkQueueItem>();
  for (const item of items) {
    const existing = result.get(item.case.id);
    if (!existing || item.case.revision > existing.case.revision) {
      result.set(item.case.id, item);
      continue;
    }
    if (item.case.revision < existing.case.revision) continue;
    if (itemFingerprint(item) !== itemFingerprint(existing)) {
      adapterError(
        "DUPLICATE_REVISION_CONFLICT",
        item.case.id,
        "The same case revision produced different queue items",
      );
    }
  }
  return [...result.values()];
}

function sortedItems(items: readonly WorkQueueItem[], now: Date) {
  return rankTodayItems(
    items.map((item) => ({
      caseId: item.case.id,
      dueAt: item.timing.dueAt,
      hardStop: item.priority.hardStop,
      ownerId: item.owner.id,
      recovery: item.priority.recovery,
      transitionBlocked: item.priority.transitionBlocked,
      waitingParty: item.priority.waitingParty,
      wakeAt: item.timing.wakeAt,
      item,
    })),
    now,
  ).map(({ item }) => item);
}

function matchesQuery(
  item: WorkQueueItem,
  input: ProjectAdminCaseListWorkQueueInput,
) {
  const { query } = input;
  if (
    query.processStage &&
    item.action.presentation.processStage !== query.processStage
  ) {
    return false;
  }
  if (query.actionKind && item.action.kind !== query.actionKind) return false;
  if (query.ownerId && item.owner.id !== query.ownerId) return false;
  if (query.queue === "mine") {
    if (!input.currentUserId) {
      adapterError(
        "MISSING_CURRENT_USER",
        null,
        "The mine queue requires a current user ID",
      );
    }
    return item.owner.id === input.currentUserId;
  }
  if (query.queue === "overdue") return item.priority.slaBand === "overdue";
  if (query.queue === "waiting") return item.interaction.mode === "waiting";
  if (query.queue === "blocked") return item.priority.transitionBlocked;
  if (query.queue === "unassigned") return item.priority.assignmentGap;
  return true;
}

/**
 * Pure read projection over an already-loaded AdminCaseListItem batch.
 * It never emits inline commands: authorized work only opens its exact workbench.
 */
export function projectAdminCaseListWorkQueue(
  input: ProjectAdminCaseListWorkQueueInput,
): WorkQueuePage {
  if (!Number.isFinite(input.now.getTime())) {
    adapterError("INVALID_NOW", null, "A valid projection time is required");
  }
  const offset = input.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    adapterError(
      "INVALID_OFFSET",
      null,
      "A non-negative cursor offset is required",
    );
  }
  const projected = input.rows.map((row) => projectRow(row, input));
  const filtered = sortedItems(dedupeNewest(projected), input.now).filter(
    (item) => matchesQuery(item, input),
  );
  const hasMore = filtered.length > offset + input.query.limit;
  if (hasMore && !input.nextCursor) {
    adapterError(
      "MISSING_NEXT_CURSOR",
      null,
      "A truncated batch requires an opaque next cursor",
    );
  }
  return createWorkQueuePage({
    query: input.query,
    items: filtered.slice(offset, offset + input.query.limit),
    nextCursor: hasMore ? input.nextCursor || null : null,
    totalItems: filtered.length,
    facets: deriveWorkQueueFacets(filtered),
  });
}
