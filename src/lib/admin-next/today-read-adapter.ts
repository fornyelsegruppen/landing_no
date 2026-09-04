import { createHash } from "node:crypto";
import type { Payload } from "payload";
import {
  loadAdminCaseList,
  type AdminCaseListItem,
} from "@/lib/admin-v2/case-list";
import {
  getCaseNextActionPresentation,
  type CaseNextActionCapability,
  type CaseNextActionLocale,
  type CaseNextActionOwnerParty,
  type CaseNextActionProcessStage,
} from "@/lib/admin-v2/case-next-action-presentation";
import type {
  AdminNextTaskPriority,
  AdminNextTodayAdapter,
  AdminNextTodayTask,
} from "./today-contract";
import {
  parseCanonicalWorkQueueQuery,
  parseWorkQueueCursor,
  type CanonicalWorkQueueQuery,
  type WorkQueueBlocker,
  type WorkQueueCursor,
  type WorkQueueItem,
} from "./work-queue-contract";
import {
  projectAdminCaseListWorkQueue,
  type AdminCaseListWorkQueueRow,
} from "./work-queue-read-adapter";
import {
  projectStoredNextActionBlocker,
  type StoredNextActionBlockerProjection,
} from "./stored-next-action-blocker";

export type AdminNextCanonicalTodayOptions = {
  currentUserId?: string | null;
  grantedCapabilities?: readonly CaseNextActionCapability[];
  locale?: CaseNextActionLocale;
  now?: () => Date;
  query?: CanonicalWorkQueueQuery;
};

export type TodayReadAdapterErrorCode =
  "INVALID_CURSOR_PAYLOAD" | "INVALID_PROJECTED_SOURCE";

export class TodayReadAdapterError extends Error {
  constructor(
    readonly code: TodayReadAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TodayReadAdapterError";
  }
}

export const TODAY_WORK_QUEUE_CURSOR_MAX_LENGTH = 512;
const cursorDigestPattern = /^[a-f0-9]{64}$/u;

type TodayWorkQueueCursorCore = {
  v: 3;
  o: number;
  q: string;
  s: string;
  t: string;
  u: string;
};

type TodayWorkQueueCursorPayload = TodayWorkQueueCursorCore & {
  i: string;
};

const stageCompatibility = {
  inquiry: {
    stage: "measurement",
    action: "reviewMeasurement",
    reason: "lowConfidence",
  },
  evidence: {
    stage: "measurement",
    action: "reviewMeasurement",
    reason: "lowConfidence",
  },
  commercial: {
    stage: "offer",
    action: "approveOffer",
    reason: "priceChanged",
  },
  agreement: {
    stage: "documents",
    action: "sendDocuments",
    reason: "missingSignature",
  },
  work: {
    stage: "visit",
    action: "confirmVisit",
    reason: "visitTomorrow",
  },
  completion: {
    stage: "documents",
    action: "sendDocuments",
    reason: "missingSignature",
  },
} as const satisfies Record<
  CaseNextActionProcessStage,
  Pick<AdminNextTodayTask, "stage" | "action" | "reason">
>;

function defaultQuery() {
  const result = parseCanonicalWorkQueueQuery("view=today&queue=all&limit=100");
  if (!result.ok) {
    throw new Error(`Invalid built-in Work Queue query: ${result.code}`);
  }
  return result.value;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function queryFingerprint(query: CanonicalWorkQueueQuery) {
  return sha256(
    JSON.stringify({
      actionKind: query.actionKind,
      limit: query.limit,
      ownerId: query.ownerId,
      processStage: query.processStage,
      queue: query.queue,
      view: query.view,
    }),
  );
}

function sourceSnapshotFingerprint(items: readonly AdminCaseListItem[]) {
  const latestRevision = new Map<number, number>();
  for (const item of items) {
    const existing = latestRevision.get(item.id);
    if (existing === undefined || item.revision > existing) {
      latestRevision.set(item.id, item.revision);
    }
  }

  const semanticRows = items
    .filter((item) => latestRevision.get(item.id) === item.revision)
    .map((item) =>
      JSON.stringify({
        activeContractRequestId: item.activeContractRequestId || null,
        assignedToId: item.assignedToId || null,
        assignedWorkerId: item.assignedWorkerId || null,
        blockers: item.nextActionBlockers
          .map(({ code, sourceId, sourceType }) => ({
            code,
            sourceId,
            sourceType,
          }))
          .sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right), "en"),
          ),
        caseId: `case:${item.id}`,
        currentQuoteId: item.currentQuoteId || null,
        dueAt: item.dueAt || null,
        href: item.href,
        nextAction: item.nextAction,
        nextActionTargetId: item.nextActionTargetId || null,
        recordState: item.recordState,
        revision: item.revision,
        status: item.status || null,
        storedNextActionBlocker: item.storedNextActionBlocker || null,
        wakeAt: item.wakeAt || null,
        workStatus: item.workStatus || null,
      }),
    );
  return sha256(JSON.stringify([...new Set(semanticRows)].sort()));
}

function viewerScopeFingerprint(currentUserId: string | null) {
  return sha256(currentUserId || "unassigned-viewer");
}

function cursorIntegrity(core: TodayWorkQueueCursorCore) {
  return sha256(JSON.stringify(core));
}

function encodeCursor(
  offset: number,
  query: CanonicalWorkQueueQuery,
  snapshotFingerprint: string,
  projectionTime: Date,
  currentUserId: string | null,
) {
  const core: TodayWorkQueueCursorCore = {
    v: 3,
    o: offset,
    q: queryFingerprint(query),
    s: snapshotFingerprint,
    t: projectionTime.toISOString(),
    u: viewerScopeFingerprint(currentUserId),
  };
  const encoded = Buffer.from(
    JSON.stringify({ ...core, i: cursorIntegrity(core) }),
  ).toString("base64url");
  const cursor = `wq1_${encoded}`;
  if (cursor.length > TODAY_WORK_QUEUE_CURSOR_MAX_LENGTH) {
    throw new TodayReadAdapterError(
      "INVALID_CURSOR_PAYLOAD",
      "Work Queue cursor exceeds its maximum length",
    );
  }
  return parseWorkQueueCursor(cursor);
}

function cursorPayload(value: unknown): TodayWorkQueueCursorPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !==
    JSON.stringify(["i", "o", "q", "s", "t", "u", "v"])
  ) {
    return null;
  }
  if (
    record.v !== 3 ||
    !Number.isInteger(record.o) ||
    Number(record.o) < 0 ||
    typeof record.q !== "string" ||
    !cursorDigestPattern.test(record.q) ||
    typeof record.s !== "string" ||
    !cursorDigestPattern.test(record.s) ||
    typeof record.t !== "string" ||
    !Number.isFinite(Date.parse(record.t)) ||
    new Date(record.t).toISOString() !== record.t ||
    typeof record.u !== "string" ||
    !cursorDigestPattern.test(record.u) ||
    typeof record.i !== "string" ||
    !cursorDigestPattern.test(record.i)
  ) {
    return null;
  }
  return record as TodayWorkQueueCursorPayload;
}

/**
 * The cursor checksum detects stale or accidentally changed continuation state.
 * It is not a signature or authorization token; every page read is authorized
 * independently by the canonical loader.
 */
function decodeCursor(
  cursor: WorkQueueCursor | null,
  query: CanonicalWorkQueueQuery,
  snapshotFingerprint: string,
  initialProjectionTime: Date,
  currentUserId: string | null,
) {
  if (!cursor) {
    return { offset: 0, projectionTime: initialProjectionTime };
  }
  try {
    if (cursor.length > TODAY_WORK_QUEUE_CURSOR_MAX_LENGTH) {
      throw new Error("Cursor is too long");
    }
    const decoded = cursorPayload(
      JSON.parse(
        Buffer.from(cursor.slice("wq1_".length), "base64url").toString("utf8"),
      ),
    );
    if (
      !decoded ||
      decoded.i !==
        cursorIntegrity({
          v: decoded.v,
          o: decoded.o,
          q: decoded.q,
          s: decoded.s,
          t: decoded.t,
          u: decoded.u,
        }) ||
      decoded.q !== queryFingerprint(query) ||
      decoded.s !== snapshotFingerprint ||
      decoded.u !== viewerScopeFingerprint(currentUserId)
    ) {
      throw new Error("Cursor binding mismatch");
    }
    return {
      offset: decoded.o,
      projectionTime: new Date(decoded.t),
    };
  } catch {
    throw new TodayReadAdapterError(
      "INVALID_CURSOR_PAYLOAD",
      "Work Queue cursor payload is invalid",
    );
  }
}

function stablePartyOwnerId(
  item: AdminCaseListItem,
  party: CaseNextActionOwnerParty,
) {
  if (party === "administrator") {
    return item.assignedToId ? `user:${item.assignedToId}` : null;
  }
  if (party === "worker") {
    return item.assignedWorkerId ? `user:${item.assignedWorkerId}` : null;
  }
  if (party === "customer") return `case:${item.id}:customer`;
  if (party === "system") return "system:workflow";
  return null;
}

function blockerCode(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 128);
  return normalized.length >= 3 ? normalized : "UNKNOWN_BLOCKER";
}

function blockersFor(
  item: AdminCaseListItem,
  party: CaseNextActionOwnerParty,
  ownerId: string | null,
  locale: CaseNextActionLocale,
  storedBlocker: StoredNextActionBlockerProjection,
): readonly WorkQueueBlocker[] {
  const resolution = getCaseNextActionPresentation(item.nextAction, locale).copy
    .reason;
  const blockers: WorkQueueBlocker[] = item.nextActionBlockers.map(
    (blocker) => ({
      code: blockerCode(blocker.code),
      source: {
        type: blocker.sourceType,
        id: `${blocker.sourceType}:${blocker.sourceId}`,
      },
      owner: { id: ownerId, party },
      resolution,
    }),
  );
  if (
    storedBlocker.status !== "none" &&
    !blockers.some(({ code }) => code === storedBlocker.code)
  ) {
    const mappedSource =
      storedBlocker.status === "mapped" && item.nextActionTargetId
        ? item.nextAction === "retry_message" ||
          item.nextAction === "prepare_question_reply"
          ? {
              type: "message" as const,
              id: `message:${item.nextActionTargetId}`,
            }
          : item.nextAction === "review_completion" ||
              item.nextAction === "resolve_work_block"
            ? {
                type: "work_order" as const,
                id: `work_order:${item.nextActionTargetId}`,
              }
            : item.nextAction === "review_cancellation"
              ? {
                  type: "contract_request" as const,
                  id: `contract_request:${item.nextActionTargetId}`,
                }
              : null
        : null;
    blockers.push({
      code: storedBlocker.code,
      source: mappedSource || { type: "case", id: `case:${item.id}` },
      owner: {
        id: item.assignedToId ? `user:${item.assignedToId}` : null,
        party: "administrator",
      },
      resolution,
    });
  }
  return blockers;
}

function prioritySignalsFor(
  item: AdminCaseListItem,
  diagnosticBlocker?: string | null,
): AdminCaseListWorkQueueRow["prioritySignals"] {
  if (diagnosticBlocker) {
    return { hardStop: "integrity", transitionBlocked: true };
  }
  if (item.nextAction === "review_cancellation") return { hardStop: "legal" };
  if (item.nextAction === "measurement_required") {
    return { hardStop: "integrity", transitionBlocked: true };
  }
  if (item.nextAction === "resolve_work_block") {
    const safety = item.nextActionBlockers.some(({ code }) =>
      /(?:HMS|SAFETY|SIKKER)/iu.test(code),
    );
    return {
      hardStop: safety ? "safety" : "integrity",
      transitionBlocked: true,
    };
  }
  if (item.nextAction === "retry_message") {
    return { recovery: "delivery_failure" };
  }
  return undefined;
}

function workQueueRow(
  item: AdminCaseListItem,
  locale: CaseNextActionLocale,
  capabilities: ReadonlySet<CaseNextActionCapability>,
): AdminCaseListWorkQueueRow {
  const presentation = getCaseNextActionPresentation(item.nextAction, locale);
  const storedBlocker = projectStoredNextActionBlocker({
    actionKind: item.nextAction,
    actionTargetId: item.nextActionTargetId,
    storedBlocker: item.storedNextActionBlocker,
  });
  const diagnosticBlocker =
    storedBlocker.status === "diagnostic" ? storedBlocker.code : null;
  const ownerId = stablePartyOwnerId(item, presentation.owner.party);
  const waiting = presentation.reviewMode === "waiting";
  return {
    item: waiting ? { ...item, dueAt: undefined } : item,
    caseRevision: item.revision,
    exactTargetAvailable:
      !diagnosticBlocker && presentation.target.entity === "case",
    ownerId,
    diagnosticBlocker,
    wakeAt: waiting ? item.wakeAt || item.dueAt : item.wakeAt,
    blockers: blockersFor(
      item,
      presentation.owner.party,
      ownerId,
      locale,
      storedBlocker,
    ),
    capabilityGranted: capabilities.has(presentation.requiredCapability),
    prioritySignals: prioritySignalsFor(item, diagnosticBlocker),
  };
}

function legacyPriority(item: WorkQueueItem): AdminNextTaskPriority {
  if (
    item.priority.hardStop ||
    item.priority.recovery ||
    item.priority.transitionBlocked ||
    item.priority.slaBand === "overdue"
  ) {
    return "critical";
  }
  if (item.interaction.mode === "waiting") return "waiting";
  if (item.priority.slaBand === "due_today") return "today";
  return "scheduled";
}

function ownerLabel(
  source: AdminCaseListItem,
  item: WorkQueueItem,
  currentUserName: string,
) {
  if (item.owner.party === "customer") return source.customer;
  if (item.owner.party === "worker") return source.assignedWorker || "Worker";
  if (item.owner.party === "system") return "System";
  if (item.owner.party === "none") return "Team";
  return source.assignedWorker || currentUserName || "Team";
}

function compatibilityTask(
  item: WorkQueueItem,
  source: AdminCaseListItem,
  currentUserId: string | null,
  currentUserName: string,
): AdminNextTodayTask {
  const owner = ownerLabel(source, item, currentUserName);
  return {
    id: item.case.reference,
    customer: source.customer,
    address: source.postalAddress || "—",
    ...stageCompatibility[item.action.presentation.processStage],
    due: item.timing.dueAt || item.timing.wakeAt || "—",
    owner,
    ownedByCurrentUser: currentUserId
      ? item.owner.id === currentUserId
      : Boolean(
          currentUserName &&
          owner.toLocaleLowerCase() === currentUserName.toLocaleLowerCase(),
        ),
    priority: legacyPriority(item),
    href: item.target.href,
    workQueueItem: item,
  };
}

/**
 * Canonical Today read: one CaseList batch is projected through the F2 Work Queue.
 * The returned `value` is only a compatibility view for the current Today UI.
 */
export function createAdminNextCanonicalTodayAdapter(
  payload: Pick<Payload, "find">,
  currentUserName = "",
  options: AdminNextCanonicalTodayOptions = {},
): AdminNextTodayAdapter {
  const configuredQuery = options.query || defaultQuery();
  return {
    async load(queryOverride) {
      const query = queryOverride || configuredQuery;
      const requestedProjectionTime = options.now?.() || new Date();
      const locale = options.locale || "nb";
      const currentUserId = options.currentUserId || null;
      const capabilities = new Set(options.grantedCapabilities || []);
      const result = await loadAdminCaseList(payload, {
        recordState: "active",
        status: "open",
      });
      const snapshotFingerprint = sourceSnapshotFingerprint(result.items);
      const continuation = decodeCursor(
        query.cursor,
        query,
        snapshotFingerprint,
        requestedProjectionTime,
        currentUserId,
      );
      const now = continuation.projectionTime;
      const workQueue = projectAdminCaseListWorkQueue({
        rows: result.items.map((item) =>
          workQueueRow(item, locale, capabilities),
        ),
        locale,
        now,
        query,
        sourceKind: "canonical",
        currentUserId,
        offset: continuation.offset,
        nextCursor: encodeCursor(
          continuation.offset + query.limit,
          query,
          snapshotFingerprint,
          now,
          currentUserId,
        ),
      });
      const sourceByCaseRevision = new Map<string, AdminCaseListItem>(
        result.items.map(
          (item) => [`case:${item.id}:r${item.revision}`, item] as const,
        ),
      );
      const value = workQueue.items.map((item) => {
        const source = sourceByCaseRevision.get(
          `${item.case.id}:r${item.case.revision}`,
        );
        if (!source) {
          throw new TodayReadAdapterError(
            "INVALID_PROJECTED_SOURCE",
            `Projected case ${item.case.id} has no source row`,
          );
        }
        return compatibilityTask(item, source, currentUserId, currentUserName);
      });
      return { status: "ready", source: "canonical", value, workQueue };
    },
  };
}
