import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";
import type { CaseNextActionProcessStage } from "@/lib/admin-v2/case-next-action-presentation";
import {
  canonicalWorkQueueUrl,
  parseCanonicalWorkQueueQuery,
  type WorkQueueView,
} from "./work-queue-contract";

export const workQueueSavedViewContractVersion = "ua-f2-004-v1" as const;

export const workQueueSavedViewCapabilityIds = [
  "work_queue.saved_view.read",
  "work_queue.saved_view.share",
  "work_queue.saved_view.manage",
] as const;

export type WorkQueueSavedViewCapability =
  (typeof workQueueSavedViewCapabilityIds)[number];

export const workQueueSavedViewRequiredCapabilities = {
  read: "work_queue.saved_view.read",
  share: "work_queue.saved_view.share",
  manage: "work_queue.saved_view.manage",
} as const satisfies Record<
  "read" | "share" | "manage",
  WorkQueueSavedViewCapability
>;

export type WorkQueueSavedViewQuery = {
  view: "today";
  queue: WorkQueueView;
  processStage: CaseNextActionProcessStage | null;
  actionKind: CaseNextActionKind | null;
  ownerId: string | null;
  limit: number;
};

export type WorkQueueSavedViewState =
  | { kind: "active" }
  | {
      kind: "stale";
      reason: "query_contract_changed" | "source_revision_changed";
    }
  | { kind: "deleted"; reason: "deleted_by_owner" | "deleted_by_manager" }
  | {
      kind: "unavailable";
      reason: "capability_changed" | "owner_unavailable" | "source_unavailable";
    };

export type WorkQueueSavedView = {
  contractVersion: typeof workQueueSavedViewContractVersion;
  id: string;
  revision: number;
  name: string;
  scope: "personal" | "team";
  ownerId: string;
  query: WorkQueueSavedViewQuery;
  requiredCapabilities: typeof workQueueSavedViewRequiredCapabilities;
  state: WorkQueueSavedViewState;
};

export type WorkQueueSavedViewIntent = "read" | "share" | "manage";

export type WorkQueueSavedViewActor = {
  id: string;
  teamIds: readonly string[];
  capabilities: readonly WorkQueueSavedViewCapability[];
};

export type ValidateWorkQueueSavedViewContext = {
  actor: WorkQueueSavedViewActor;
  intent: WorkQueueSavedViewIntent;
};

export type WorkQueueSavedViewUrlResult = {
  kind: "applied" | "reset" | "stale" | "deleted" | "unavailable";
  viewId: string | null;
  revision: number | null;
  url: string;
  resetUrl: string;
};

export type WorkQueueSavedViewErrorCode =
  | "CAPABILITY_CONTRACT_MISMATCH"
  | "CAPABILITY_DENIED"
  | "CURSOR_FORBIDDEN"
  | "DUPLICATE_ID_REVISION_CONFLICT"
  | "DUPLICATE_VIEW_ID"
  | "INACTIVE_VIEW_OPERATION"
  | "INVALID_ACTOR"
  | "INVALID_ID"
  | "INVALID_NAME"
  | "INVALID_QUERY"
  | "INVALID_REVISION"
  | "INVALID_SCOPE"
  | "INVALID_STATE"
  | "INVALID_VIEW"
  | "PERSONAL_SHARE_FORBIDDEN"
  | "SCOPE_OWNER_MISMATCH"
  | "SELECTED_FORBIDDEN"
  | "TEAM_SHARE_FORBIDDEN"
  | "UNKNOWN_QUERY_KEY";

export class WorkQueueSavedViewError extends Error {
  constructor(
    readonly code: WorkQueueSavedViewErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkQueueSavedViewError";
  }
}

const viewIdPattern = /^wqsv_[A-Za-z0-9_-]{16,96}$/u;
const stableIdPattern = /^(?:user|team):[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const personalOwnerPattern = /^user:/u;
const teamOwnerPattern = /^team:/u;
const safeNameEmailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u;
const safeNamePhonePattern = /(?:\+?\d[\s().-]*){7,}/u;
const safeNameUrlPattern = /(?:https?:\/\/|www\.)/iu;

const viewKeys = new Set([
  "contractVersion",
  "id",
  "revision",
  "name",
  "scope",
  "ownerId",
  "query",
  "requiredCapabilities",
  "state",
]);
const queryKeys = new Set([
  "view",
  "queue",
  "processStage",
  "actionKind",
  "ownerId",
  "limit",
]);
const selectedQueryKeys = new Set(["selected", "selectedCaseId", "selectedId"]);
const capabilityKeys = new Set(["read", "share", "manage"]);
const stateKeys = new Set(["kind", "reason"]);

function savedViewError(
  code: WorkQueueSavedViewErrorCode,
  message: string,
): never {
  throw new WorkQueueSavedViewError(code, message);
}

function plainRecord(value: unknown, code: WorkQueueSavedViewErrorCode) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    savedViewError(code, "Expected a plain JSON object");
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  code: WorkQueueSavedViewErrorCode,
) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) savedViewError(code, `Unknown field: ${key}`);
  }
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") {
    savedViewError("INVALID_NAME", "Saved view name must be a string");
  }
  const name = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (
    name.length < 1 ||
    name.length > 64 ||
    /[\u0000-\u001F\u007F]/u.test(name) ||
    safeNameEmailPattern.test(name) ||
    safeNamePhonePattern.test(name) ||
    safeNameUrlPattern.test(name)
  ) {
    savedViewError(
      "INVALID_NAME",
      "Saved view name must be short and contain no contact information",
    );
  }
  return name;
}

function normalizeQuery(value: unknown): WorkQueueSavedViewQuery {
  const query = plainRecord(value, "INVALID_QUERY");
  for (const key of Object.keys(query)) {
    if (key === "cursor") {
      savedViewError("CURSOR_FORBIDDEN", "Saved views cannot persist cursors");
    }
    if (selectedQueryKeys.has(key)) {
      savedViewError(
        "SELECTED_FORBIDDEN",
        "Saved views cannot persist selected UI state",
      );
    }
    if (!queryKeys.has(key)) {
      savedViewError("UNKNOWN_QUERY_KEY", `Unknown saved query key: ${key}`);
    }
  }
  if (
    query.view !== "today" ||
    typeof query.queue !== "string" ||
    !(query.processStage === null || typeof query.processStage === "string") ||
    !(query.actionKind === null || typeof query.actionKind === "string") ||
    !(query.ownerId === null || typeof query.ownerId === "string") ||
    !Number.isInteger(query.limit)
  ) {
    savedViewError("INVALID_QUERY", "Saved query has invalid value types");
  }
  const params = new URLSearchParams();
  params.set("view", query.view);
  params.set("queue", query.queue);
  if (query.processStage) params.set("stage", query.processStage);
  if (query.actionKind) params.set("action", query.actionKind);
  if (query.ownerId) params.set("ownerId", query.ownerId);
  params.set("limit", String(query.limit));
  const parsed = parseCanonicalWorkQueueQuery(params);
  if (!parsed.ok || parsed.value.cursor !== null) {
    savedViewError(
      "INVALID_QUERY",
      `Saved query is not canonical${parsed.ok ? "" : `: ${parsed.code}`}`,
    );
  }
  return {
    view: "today",
    queue: parsed.value.queue,
    processStage: parsed.value.processStage,
    actionKind: parsed.value.actionKind,
    ownerId: parsed.value.ownerId,
    limit: parsed.value.limit,
  };
}

function normalizeCapabilities(value: unknown) {
  const capabilities = plainRecord(value, "CAPABILITY_CONTRACT_MISMATCH");
  assertExactKeys(capabilities, capabilityKeys, "CAPABILITY_CONTRACT_MISMATCH");
  for (const intent of ["read", "share", "manage"] as const) {
    if (
      capabilities[intent] !== workQueueSavedViewRequiredCapabilities[intent]
    ) {
      savedViewError(
        "CAPABILITY_CONTRACT_MISMATCH",
        `Saved view cannot redefine ${intent} capability`,
      );
    }
  }
  return { ...workQueueSavedViewRequiredCapabilities };
}

function normalizeState(value: unknown): WorkQueueSavedViewState {
  const state = plainRecord(value, "INVALID_STATE");
  assertExactKeys(state, stateKeys, "INVALID_STATE");
  if (state.kind === "active" && state.reason === undefined) {
    return { kind: "active" };
  }
  if (
    state.kind === "stale" &&
    (state.reason === "query_contract_changed" ||
      state.reason === "source_revision_changed")
  ) {
    return { kind: "stale", reason: state.reason };
  }
  if (
    state.kind === "deleted" &&
    (state.reason === "deleted_by_owner" ||
      state.reason === "deleted_by_manager")
  ) {
    return { kind: "deleted", reason: state.reason };
  }
  if (
    state.kind === "unavailable" &&
    (state.reason === "capability_changed" ||
      state.reason === "owner_unavailable" ||
      state.reason === "source_unavailable")
  ) {
    return { kind: "unavailable", reason: state.reason };
  }
  savedViewError("INVALID_STATE", "Unknown saved view lifecycle state");
}

function assertActor(actor: WorkQueueSavedViewActor) {
  if (!stableIdPattern.test(actor.id) || !personalOwnerPattern.test(actor.id)) {
    savedViewError(
      "INVALID_ACTOR",
      "Saved view actor must have a stable user ID",
    );
  }
  if (
    actor.teamIds.some(
      (teamId) =>
        !stableIdPattern.test(teamId) || !teamOwnerPattern.test(teamId),
    )
  ) {
    savedViewError("INVALID_ACTOR", "Actor team IDs must be stable team IDs");
  }
}

function assertAccess(
  view: WorkQueueSavedView,
  context: ValidateWorkQueueSavedViewContext,
) {
  const { actor, intent } = context;
  assertActor(actor);
  if (view.scope === "personal" && view.ownerId !== actor.id) {
    savedViewError(
      "SCOPE_OWNER_MISMATCH",
      "Personal saved view owner must match the actor",
    );
  }
  if (view.scope === "team" && !actor.teamIds.includes(view.ownerId)) {
    savedViewError(
      "SCOPE_OWNER_MISMATCH",
      "Team saved view owner must be one of the actor teams",
    );
  }
  if (intent === "share" && view.scope === "personal") {
    savedViewError(
      "PERSONAL_SHARE_FORBIDDEN",
      "A personal saved view cannot be shared as a team view",
    );
  }
  if (
    intent === "share" &&
    view.scope === "team" &&
    !actor.capabilities.includes(workQueueSavedViewRequiredCapabilities.share)
  ) {
    savedViewError(
      "TEAM_SHARE_FORBIDDEN",
      "Team share requires the saved-view share capability",
    );
  }
  if (
    !actor.capabilities.includes(workQueueSavedViewRequiredCapabilities.read)
  ) {
    savedViewError(
      "CAPABILITY_DENIED",
      "Saved view read capability is required for every operation",
    );
  }
  const required = view.requiredCapabilities[intent];
  if (!actor.capabilities.includes(required)) {
    savedViewError(
      "CAPABILITY_DENIED",
      `Saved view ${intent} capability is required`,
    );
  }
  if (intent !== "read" && view.state.kind !== "active") {
    savedViewError(
      "INACTIVE_VIEW_OPERATION",
      "Only active saved views can be shared or managed",
    );
  }
}

/** Validates and normalizes one untrusted, read-only saved-view record. */
export function validateWorkQueueSavedView(
  input: unknown,
  context: ValidateWorkQueueSavedViewContext,
): WorkQueueSavedView {
  const value = plainRecord(input, "INVALID_VIEW");
  assertExactKeys(value, viewKeys, "INVALID_VIEW");
  if (value.contractVersion !== workQueueSavedViewContractVersion) {
    savedViewError("INVALID_VIEW", "Unknown saved-view contract version");
  }
  if (typeof value.id !== "string" || !viewIdPattern.test(value.id)) {
    savedViewError("INVALID_ID", "Saved view requires a stable wqsv_ ID");
  }
  if (!Number.isInteger(value.revision) || Number(value.revision) < 1) {
    savedViewError("INVALID_REVISION", "Saved view revision must be positive");
  }
  if (value.scope !== "personal" && value.scope !== "team") {
    savedViewError(
      "INVALID_SCOPE",
      "Saved view scope must be personal or team",
    );
  }
  if (
    typeof value.ownerId !== "string" ||
    !stableIdPattern.test(value.ownerId)
  ) {
    savedViewError("SCOPE_OWNER_MISMATCH", "Saved view owner ID is invalid");
  }
  if (
    (value.scope === "personal" && !personalOwnerPattern.test(value.ownerId)) ||
    (value.scope === "team" && !teamOwnerPattern.test(value.ownerId))
  ) {
    savedViewError(
      "SCOPE_OWNER_MISMATCH",
      "Saved view scope and owner ID kind do not match",
    );
  }
  const view: WorkQueueSavedView = {
    contractVersion: workQueueSavedViewContractVersion,
    id: value.id,
    revision: Number(value.revision),
    name: normalizeName(value.name),
    scope: value.scope,
    ownerId: value.ownerId,
    query: normalizeQuery(value.query),
    requiredCapabilities: normalizeCapabilities(value.requiredCapabilities),
    state: normalizeState(value.state),
  };
  assertAccess(view, context);
  JSON.stringify(view);
  return view;
}

/** Validates a current-view catalog and rejects every duplicate ID fail-closed. */
export function validateWorkQueueSavedViewCatalog(
  input: readonly unknown[],
  context: ValidateWorkQueueSavedViewContext,
) {
  const views = input.map((item) => validateWorkQueueSavedView(item, context));
  const byId = new Map<string, WorkQueueSavedView>();
  for (const view of views) {
    const existing = byId.get(view.id);
    if (!existing) {
      byId.set(view.id, view);
      continue;
    }
    if (
      existing.revision !== view.revision ||
      JSON.stringify(existing) !== JSON.stringify(view)
    ) {
      savedViewError(
        "DUPLICATE_ID_REVISION_CONFLICT",
        "Duplicate saved-view ID has a revision or payload conflict",
      );
    }
    savedViewError("DUPLICATE_VIEW_ID", "Duplicate saved-view ID is forbidden");
  }
  return [...byId.values()].sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true }),
  );
}

const resetQuery: WorkQueueSavedViewQuery = {
  view: "today",
  queue: "all",
  processStage: null,
  actionKind: null,
  ownerId: null,
  limit: 25,
};

function queryUrl(query: WorkQueueSavedViewQuery) {
  return canonicalWorkQueueUrl({ ...query, cursor: null });
}

/** Returns the canonical Today URL with all saved-view and selected state reset. */
export function resetWorkQueueSavedView(): WorkQueueSavedViewUrlResult {
  const url = queryUrl(resetQuery);
  return {
    kind: "reset",
    viewId: null,
    revision: null,
    url,
    resetUrl: url,
  };
}

/**
 * Applies an active validated view. Stale/deleted/unavailable records resolve to
 * the deterministic reset URL and never revive their persisted query.
 */
export function applyWorkQueueSavedView(
  input: unknown,
  actor: WorkQueueSavedViewActor,
): WorkQueueSavedViewUrlResult {
  const view = validateWorkQueueSavedView(input, { actor, intent: "read" });
  const reset = resetWorkQueueSavedView();
  if (view.state.kind !== "active") {
    return {
      kind: view.state.kind,
      viewId: view.id,
      revision: view.revision,
      url: reset.url,
      resetUrl: reset.url,
    };
  }
  return {
    kind: "applied",
    viewId: view.id,
    revision: view.revision,
    url: queryUrl(view.query),
    resetUrl: reset.url,
  };
}
