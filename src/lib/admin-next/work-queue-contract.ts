import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";
import {
  caseNextActionPresentationKinds,
  getCaseNextActionPresentation,
  type CaseNextActionCapability,
  type CaseNextActionLocale,
  type CaseNextActionOwnerParty,
  type CaseNextActionProcessStage,
  type CaseNextActionTargetEntity,
  type LocalizedCaseNextActionPresentation,
} from "@/lib/admin-v2/case-next-action-presentation";
import {
  deriveTodayPriority,
  type TodayHardStop,
  type TodayPriorityDimensions,
  type TodayRecovery,
  type TodayWaitingParty,
} from "./today-priority";

export const canonicalWorkQueuePath = "/admin-v2" as const;
export const workQueueContractVersion = "f2-v1" as const;

export type WorkQueueView =
  "all" | "mine" | "overdue" | "waiting" | "blocked" | "unassigned";

declare const workQueueCursorBrand: unique symbol;
export type WorkQueueCursor = string & {
  readonly [workQueueCursorBrand]: true;
};

export type CanonicalWorkQueueQuery = {
  view: "today";
  queue: WorkQueueView;
  processStage: CaseNextActionProcessStage | null;
  actionKind: CaseNextActionKind | null;
  ownerId: string | null;
  cursor: WorkQueueCursor | null;
  limit: number;
};

export type WorkQueueQueryErrorCode =
  | "DUPLICATE_QUERY_VALUE"
  | "INVALID_ACTION_KIND"
  | "INVALID_CURSOR"
  | "INVALID_LIMIT"
  | "INVALID_OWNER_ID"
  | "INVALID_QUEUE"
  | "INVALID_STAGE"
  | "INVALID_VIEW"
  | "UNKNOWN_QUERY_KEY";

export type ParseWorkQueueQueryResult =
  | { ok: true; value: CanonicalWorkQueueQuery }
  | { ok: false; code: WorkQueueQueryErrorCode; key: string };

export type WorkQueueBlocker = {
  code: string;
  source: {
    type:
      | "case"
      | "message"
      | "measurement"
      | "quote"
      | "contract_request"
      | "work_order";
    id: string;
  };
  owner: {
    id: string | null;
    party: CaseNextActionOwnerParty;
  };
  resolution: string;
};

export type WorkQueueExactTarget = {
  /** Omitted by v1 exact targets; case_recovery is never an executable target. */
  availability?: "exact" | "case_recovery";
  entity: CaseNextActionTargetEntity;
  id: string;
  version: string | null;
  href: string;
};

export type WorkQueueSourceTruth = {
  kind: "canonical" | "shadow_read";
  resolver: "deriveCaseNextAction";
  contractVersion: typeof workQueueContractVersion;
  derivedAt: string;
};

export type WorkQueueReadOnlyInteraction = {
  mode: "read_only";
  reason:
    | "capability_denied"
    | "diagnostic_blocker"
    | "no_action"
    | "source_not_canonical"
    | "target_unavailable";
};

export type WorkQueueWaitingInteraction = {
  mode: "waiting";
  waitingParty: TodayWaitingParty;
};

export type WorkQueueExecutableInteraction = {
  mode: "executable";
  activation:
    | { kind: "open_workbench" }
    | {
        kind: "inline_command";
        commandId: string;
        idempotencyKey: string;
        expectedCaseRevision: number;
      };
};

export type WorkQueueInteraction =
  | WorkQueueReadOnlyInteraction
  | WorkQueueWaitingInteraction
  | WorkQueueExecutableInteraction;

export type WorkQueueItem = {
  contractVersion: typeof workQueueContractVersion;
  case: {
    customerName: string | null;
    id: string;
    postalAddress: string | null;
    revision: number;
    reference: string;
    href: string;
  };
  locale: CaseNextActionLocale;
  action: {
    kind: CaseNextActionKind;
    presentation: LocalizedCaseNextActionPresentation;
  };
  owner: {
    id: string | null;
    party: CaseNextActionOwnerParty;
  };
  timing: {
    dueAt: string | null;
    wakeAt: string | null;
  };
  priority: TodayPriorityDimensions;
  blockers: readonly WorkQueueBlocker[];
  authorization: {
    requiredCapability: CaseNextActionCapability;
    granted: boolean;
  };
  target: WorkQueueExactTarget;
  sourceTruth: WorkQueueSourceTruth;
  interaction: WorkQueueInteraction;
};

export type CreateWorkQueueItemInput = {
  case: {
    customerName?: string | null;
    id: string;
    postalAddress?: string | null;
    revision: number;
    reference: string;
    href: string;
  };
  locale: CaseNextActionLocale;
  actionKind: CaseNextActionKind;
  owner: {
    id: string | null;
    party: CaseNextActionOwnerParty;
  };
  timing: {
    dueAt?: string | null;
    wakeAt?: string | null;
  };
  prioritySignals?: {
    hardStop?: TodayHardStop | null;
    recovery?: TodayRecovery | null;
    transitionBlocked?: boolean;
  };
  blockers: readonly WorkQueueBlocker[];
  capabilityGranted: boolean;
  target: WorkQueueExactTarget;
  sourceTruth: WorkQueueSourceTruth;
  interaction: WorkQueueInteraction;
};

export type WorkQueuePage = {
  contractVersion: typeof workQueueContractVersion;
  query: CanonicalWorkQueueQuery;
  items: readonly WorkQueueItem[];
  totalItems: number;
  facets: {
    actionKinds: readonly {
      value: CaseNextActionKind;
      count: number;
    }[];
    processStages: readonly {
      value: CaseNextActionProcessStage;
      count: number;
    }[];
    owners: readonly {
      id: string;
      party: CaseNextActionOwnerParty | "mixed";
      count: number;
    }[];
  };
  pageInfo: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: WorkQueueCursor | null;
  };
};

export type WorkQueueFacets = WorkQueuePage["facets"];

export type WorkQueueContractErrorCode =
  | "CAPABILITY_MISMATCH"
  | "CURSOR_LOOP"
  | "DUPLICATE_CASE"
  | "EXECUTION_REQUIRES_CANONICAL_SOURCE"
  | "EXECUTION_REQUIRES_GRANTED_CAPABILITY"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "INVALID_BLOCKER"
  | "INVALID_CASE_ID"
  | "INVALID_CASE_REVISION"
  | "INVALID_COMMAND_ID"
  | "INVALID_OWNER"
  | "INVALID_PAGE"
  | "INVALID_SOURCE_TRUTH"
  | "INVALID_TARGET"
  | "INVALID_UTC_INSTANT"
  | "NO_ACTION_MUST_BE_READ_ONLY"
  | "OWNER_PARTY_MISMATCH"
  | "READ_ONLY_REASON_MISMATCH"
  | "REVISION_MISMATCH"
  | "TARGET_SEMANTICS_MISMATCH"
  | "WAITING_INTERACTION_MISMATCH";

export class WorkQueueContractError extends Error {
  constructor(
    readonly code: WorkQueueContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkQueueContractError";
  }
}

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/u;
const cursorPattern = /^wq1_[A-Za-z0-9_-]{16,512}$/u;
const commandPattern = /^[a-z][a-z0-9_.:-]{2,127}$/u;
const blockerCodePattern = /^[A-Z][A-Z0-9_]{2,127}$/u;
const operatorHrefPattern = /^\/(?:admin-v2|admin-next-preview)(?:[/?]|$)/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const workQueueViews = new Set<WorkQueueView>([
  "all",
  "mine",
  "overdue",
  "waiting",
  "blocked",
  "unassigned",
]);
const processStages = new Set<CaseNextActionProcessStage>([
  "inquiry",
  "evidence",
  "commercial",
  "agreement",
  "work",
  "completion",
]);
const actionKinds = new Set<CaseNextActionKind>(
  caseNextActionPresentationKinds,
);
const allowedQueryKeys = new Set([
  "view",
  "queue",
  "stage",
  "action",
  "ownerId",
  "cursor",
  "limit",
]);

function contractError(
  code: WorkQueueContractErrorCode,
  message: string,
): never {
  throw new WorkQueueContractError(code, message);
}

function nonEmptyStableId(value: string, code: WorkQueueContractErrorCode) {
  if (!stableIdPattern.test(value)) contractError(code, "Invalid stable ID");
  return value;
}

function canonicalHref(value: string, code: WorkQueueContractErrorCode) {
  if (!operatorHrefPattern.test(value)) {
    contractError(
      code,
      "Expected an operator URL under /admin-v2 or /admin-next-preview",
    );
  }
  return value;
}

function normalizeUtcInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    contractError("INVALID_UTC_INSTANT", "Invalid timestamp");
  }
  return new Date(parsed).toISOString();
}

export function parseWorkQueueCursor(value: string): WorkQueueCursor {
  if (!cursorPattern.test(value)) {
    contractError("INVALID_PAGE", "Invalid work queue cursor");
  }
  return value as WorkQueueCursor;
}

function assertOwner(
  owner: CreateWorkQueueItemInput["owner"],
  expectedParty: CaseNextActionOwnerParty,
) {
  if (owner.party !== expectedParty) {
    contractError(
      "OWNER_PARTY_MISMATCH",
      "Resolved owner party does not match action semantics",
    );
  }
  if (owner.party === "none" && owner.id !== null) {
    contractError("INVALID_OWNER", "No-action owner cannot have an ID");
  }
  if (owner.id !== null) nonEmptyStableId(owner.id, "INVALID_OWNER");
}

function assertTarget(
  target: WorkQueueExactTarget,
  presentation: LocalizedCaseNextActionPresentation,
  interaction: WorkQueueInteraction,
) {
  const availability = target.availability || "exact";
  if (availability === "case_recovery") {
    if (target.entity !== "case" || interaction.mode === "executable") {
      contractError(
        "TARGET_SEMANTICS_MISMATCH",
        "Case recovery targets cannot be executable or target another entity",
      );
    }
  } else if (availability !== "exact") {
    contractError("INVALID_TARGET", "Unknown target availability");
  }
  if (target.entity !== presentation.target.entity) {
    if (availability !== "case_recovery") {
      contractError(
        "TARGET_SEMANTICS_MISMATCH",
        "Resolved target entity does not match action semantics",
      );
    }
  }
  nonEmptyStableId(target.id, "INVALID_TARGET");
  if (target.version !== null) {
    nonEmptyStableId(target.version, "INVALID_TARGET");
  }
  canonicalHref(target.href, "INVALID_TARGET");
}

function assertBlockers(blockers: readonly WorkQueueBlocker[]) {
  for (const blocker of blockers) {
    if (!blockerCodePattern.test(blocker.code)) {
      contractError("INVALID_BLOCKER", "Invalid blocker code");
    }
    nonEmptyStableId(blocker.source.id, "INVALID_BLOCKER");
    if (blocker.owner.id !== null) {
      nonEmptyStableId(blocker.owner.id, "INVALID_BLOCKER");
    }
    if (blocker.owner.party === "none" && blocker.owner.id !== null) {
      contractError("INVALID_BLOCKER", "Owner-less blocker cannot have an ID");
    }
    if (!blocker.resolution.trim()) {
      contractError("INVALID_BLOCKER", "Blocker resolution is required");
    }
  }
}

function assertSourceTruth(sourceTruth: WorkQueueSourceTruth) {
  if (!(["canonical", "shadow_read"] as const).includes(sourceTruth.kind)) {
    contractError("INVALID_SOURCE_TRUTH", "Unknown source truth");
  }
  if (
    sourceTruth.resolver !== "deriveCaseNextAction" ||
    sourceTruth.contractVersion !== workQueueContractVersion
  ) {
    contractError("INVALID_SOURCE_TRUTH", "Unknown resolver or contract");
  }
}

function assertInteraction(
  input: CreateWorkQueueItemInput,
  presentation: LocalizedCaseNextActionPresentation,
) {
  const { interaction } = input;
  if (presentation.reviewMode === "none" && interaction.mode !== "read_only") {
    contractError(
      "NO_ACTION_MUST_BE_READ_ONLY",
      "No-action presentation cannot be executable or waiting",
    );
  }
  if (presentation.reviewMode === "waiting") {
    if (interaction.mode !== "waiting") {
      contractError(
        "WAITING_INTERACTION_MISMATCH",
        "Waiting presentation must use waiting interaction",
      );
    }
    if (interaction.waitingParty !== input.owner.party) {
      contractError(
        "WAITING_INTERACTION_MISMATCH",
        "Waiting party must match the resolved owner party",
      );
    }
  } else if (interaction.mode === "waiting") {
    contractError(
      "WAITING_INTERACTION_MISMATCH",
      "Executable presentation cannot use waiting interaction",
    );
  }
  if (interaction.mode === "executable") {
    if (!input.capabilityGranted) {
      contractError(
        "EXECUTION_REQUIRES_GRANTED_CAPABILITY",
        "Executable interaction requires its capability",
      );
    }
    if (input.sourceTruth.kind !== "canonical") {
      contractError(
        "EXECUTION_REQUIRES_CANONICAL_SOURCE",
        "Shadow-read data cannot expose executable interaction",
      );
    }
    if (interaction.activation.kind === "inline_command") {
      if (!commandPattern.test(interaction.activation.commandId)) {
        contractError("INVALID_COMMAND_ID", "Invalid command ID");
      }
      if (!cursorPattern.test(`wq1_${interaction.activation.idempotencyKey}`)) {
        contractError(
          "IDEMPOTENCY_KEY_REQUIRED",
          "Inline command requires a stable idempotency key",
        );
      }
      if (interaction.activation.expectedCaseRevision !== input.case.revision) {
        contractError(
          "REVISION_MISMATCH",
          "Inline command CAS revision must match the rendered case",
        );
      }
    }
  }
  if (interaction.mode === "read_only") {
    if (interaction.reason === "capability_denied" && input.capabilityGranted) {
      contractError(
        "READ_ONLY_REASON_MISMATCH",
        "Capability-denied state cannot claim granted access",
      );
    }
    if (
      interaction.reason === "diagnostic_blocker" &&
      (!input.prioritySignals?.transitionBlocked || input.blockers.length === 0)
    ) {
      contractError(
        "READ_ONLY_REASON_MISMATCH",
        "Diagnostic blocker state requires a projected blocker and transition stop",
      );
    }
    if (
      interaction.reason === "source_not_canonical" &&
      input.sourceTruth.kind !== "shadow_read"
    ) {
      contractError(
        "READ_ONLY_REASON_MISMATCH",
        "Source reason requires shadow-read source",
      );
    }
    if (
      interaction.reason === "no_action" &&
      presentation.reviewMode !== "none"
    ) {
      contractError(
        "READ_ONLY_REASON_MISMATCH",
        "No-action reason requires no-action presentation",
      );
    }
    if (
      interaction.reason === "target_unavailable" &&
      input.target.availability !== "case_recovery"
    ) {
      contractError(
        "READ_ONLY_REASON_MISMATCH",
        "Target-unavailable state requires an explicit case recovery target",
      );
    }
  }
}

export function createWorkQueueItem(
  input: CreateWorkQueueItemInput,
  now: Date,
): WorkQueueItem {
  nonEmptyStableId(input.case.id, "INVALID_CASE_ID");
  if (!Number.isInteger(input.case.revision) || input.case.revision < 0) {
    contractError(
      "INVALID_CASE_REVISION",
      "Case revision must be non-negative",
    );
  }
  if (!input.case.reference.trim()) {
    contractError("INVALID_CASE_ID", "Case reference is required");
  }
  canonicalHref(input.case.href, "INVALID_CASE_ID");

  const presentation = getCaseNextActionPresentation(
    input.actionKind,
    input.locale,
  );
  assertOwner(input.owner, presentation.owner.party);
  assertTarget(input.target, presentation, input.interaction);
  assertBlockers(input.blockers);
  if (presentation.caseStateHint === "blocked" && input.blockers.length === 0) {
    contractError(
      "INVALID_BLOCKER",
      "Blocked presentation requires an explicit blocker",
    );
  }
  assertSourceTruth(input.sourceTruth);
  assertInteraction(input, presentation);

  const dueAt = normalizeUtcInstant(input.timing.dueAt);
  const wakeAt = normalizeUtcInstant(input.timing.wakeAt);
  const derivedAt = normalizeUtcInstant(input.sourceTruth.derivedAt);
  if (!derivedAt || !utcInstantPattern.test(derivedAt)) {
    contractError("INVALID_SOURCE_TRUTH", "Source derivedAt is required");
  }
  const waitingParty =
    input.interaction.mode === "waiting"
      ? input.interaction.waitingParty
      : null;
  const priority = deriveTodayPriority(
    {
      caseId: input.case.id,
      dueAt,
      hardStop: input.prioritySignals?.hardStop,
      ownerId: input.owner.id,
      recovery: input.prioritySignals?.recovery,
      transitionBlocked:
        input.blockers.length > 0 ||
        Boolean(input.prioritySignals?.transitionBlocked),
      waitingParty,
      wakeAt,
    },
    now,
  );

  return {
    contractVersion: workQueueContractVersion,
    case: {
      ...input.case,
      customerName: input.case.customerName?.trim() || null,
      postalAddress: input.case.postalAddress?.trim() || null,
    },
    locale: input.locale,
    action: { kind: input.actionKind, presentation },
    owner: { ...input.owner },
    timing: { dueAt, wakeAt },
    priority,
    blockers: input.blockers.map((blocker) => ({
      ...blocker,
      source: { ...blocker.source },
      owner: { ...blocker.owner },
    })),
    authorization: {
      requiredCapability: presentation.requiredCapability,
      granted: input.capabilityGranted,
    },
    target: { ...input.target },
    sourceTruth: { ...input.sourceTruth, derivedAt },
    interaction: input.interaction,
  };
}

function queryError(
  code: WorkQueueQueryErrorCode,
  key: string,
): ParseWorkQueueQueryResult {
  return { ok: false, code, key };
}

export function parseCanonicalWorkQueueQuery(
  input: string | URLSearchParams,
): ParseWorkQueueQueryResult {
  const params =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : new URLSearchParams(input);
  for (const key of params.keys()) {
    if (!allowedQueryKeys.has(key)) return queryError("UNKNOWN_QUERY_KEY", key);
    if (params.getAll(key).length > 1) {
      return queryError("DUPLICATE_QUERY_VALUE", key);
    }
  }
  const view = params.get("view") || "today";
  if (view !== "today") return queryError("INVALID_VIEW", "view");

  const queueValue = params.get("queue") || "all";
  if (!workQueueViews.has(queueValue as WorkQueueView)) {
    return queryError("INVALID_QUEUE", "queue");
  }
  const stageValue = params.get("stage");
  if (
    stageValue !== null &&
    !processStages.has(stageValue as CaseNextActionProcessStage)
  ) {
    return queryError("INVALID_STAGE", "stage");
  }
  const actionValue = params.get("action");
  if (
    actionValue !== null &&
    !actionKinds.has(actionValue as CaseNextActionKind)
  ) {
    return queryError("INVALID_ACTION_KIND", "action");
  }
  const ownerId = params.get("ownerId");
  if (ownerId !== null && !stableIdPattern.test(ownerId)) {
    return queryError("INVALID_OWNER_ID", "ownerId");
  }
  const cursorValue = params.get("cursor");
  if (cursorValue !== null && !cursorPattern.test(cursorValue)) {
    return queryError("INVALID_CURSOR", "cursor");
  }
  const limitValue = params.get("limit") || "25";
  if (!/^\d{1,3}$/u.test(limitValue)) {
    return queryError("INVALID_LIMIT", "limit");
  }
  const limit = Number(limitValue);
  if (limit < 1 || limit > 100) {
    return queryError("INVALID_LIMIT", "limit");
  }

  return {
    ok: true,
    value: {
      view: "today",
      queue: queueValue as WorkQueueView,
      processStage: stageValue as CaseNextActionProcessStage | null,
      actionKind: actionValue as CaseNextActionKind | null,
      ownerId,
      cursor: cursorValue as WorkQueueCursor | null,
      limit,
    },
  };
}

export function canonicalWorkQueueUrl(query: CanonicalWorkQueueQuery) {
  const params = new URLSearchParams();
  params.set("view", "today");
  params.set("queue", query.queue);
  if (query.processStage) params.set("stage", query.processStage);
  if (query.actionKind) params.set("action", query.actionKind);
  if (query.ownerId) params.set("ownerId", query.ownerId);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit));
  const parsed = parseCanonicalWorkQueueQuery(params);
  if (!parsed.ok) {
    contractError(
      "INVALID_PAGE",
      `Invalid canonical query value for ${parsed.key}`,
    );
  }
  return `${canonicalWorkQueuePath}?${params.toString()}`;
}

function assertJsonSerializable(value: unknown, seen = new WeakSet<object>()) {
  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint" ||
    (typeof value === "number" && !Number.isFinite(value)) ||
    value instanceof Date
  ) {
    contractError("INVALID_PAGE", "Work queue pages must be plain JSON values");
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) {
    contractError("INVALID_PAGE", "Work queue pages cannot contain cycles");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertJsonSerializable(item, seen);
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      contractError("INVALID_PAGE", "Work queue pages require plain objects");
    }
    for (const item of Object.values(value)) {
      assertJsonSerializable(item, seen);
    }
  }
  seen.delete(value);
}

export function deriveWorkQueueFacets(
  items: readonly WorkQueueItem[],
): WorkQueueFacets {
  const actionKinds = new Map<CaseNextActionKind, number>();
  const processStages = new Map<CaseNextActionProcessStage, number>();
  const owners = new Map<
    string,
    {
      id: string;
      party: CaseNextActionOwnerParty | "mixed";
      count: number;
    }
  >();
  for (const item of items) {
    actionKinds.set(
      item.action.kind,
      (actionKinds.get(item.action.kind) ?? 0) + 1,
    );
    const processStage = item.action.presentation.processStage;
    processStages.set(processStage, (processStages.get(processStage) ?? 0) + 1);
    if (item.owner.id) {
      const owner = owners.get(item.owner.id);
      owners.set(item.owner.id, {
        id: item.owner.id,
        party:
          owner && owner.party !== item.owner.party
            ? "mixed"
            : (owner?.party ?? item.owner.party),
        count: (owner?.count ?? 0) + 1,
      });
    }
  }
  return {
    actionKinds: [...actionKinds]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => left.value.localeCompare(right.value, "en")),
    processStages: [...processStages]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => left.value.localeCompare(right.value, "en")),
    owners: [...owners.values()].sort((left, right) =>
      left.id.localeCompare(right.id, "en"),
    ),
  };
}

function assertWorkQueueFacets(facets: WorkQueueFacets, totalItems: number) {
  const groups = [
    facets.actionKinds.map(({ count, value }) => ({ count, value })),
    facets.processStages.map(({ count, value }) => ({ count, value })),
    facets.owners.map(({ count, id }) => ({ count, value: id })),
  ];
  for (const group of groups) {
    const values = group.map(({ value }) => value);
    if (new Set(values).size !== values.length) {
      contractError("INVALID_PAGE", "Work Queue facet values must be unique");
    }
    for (const { count, value } of group) {
      if (
        !value ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > totalItems
      ) {
        contractError("INVALID_PAGE", "Work Queue facet counts are invalid");
      }
    }
  }
}

export function createWorkQueuePage(input: {
  query: CanonicalWorkQueueQuery;
  items: readonly WorkQueueItem[];
  nextCursor: WorkQueueCursor | null;
  totalItems?: number;
  facets?: WorkQueueFacets;
}): WorkQueuePage {
  canonicalWorkQueueUrl(input.query);
  if (input.items.length > input.query.limit) {
    contractError("INVALID_PAGE", "Page contains more items than its limit");
  }
  const caseIds = input.items.map((item) => item.case.id);
  if (new Set(caseIds).size !== caseIds.length) {
    contractError(
      "DUPLICATE_CASE",
      "A page cannot contain the same case twice",
    );
  }
  if (input.nextCursor && input.nextCursor === input.query.cursor) {
    contractError("CURSOR_LOOP", "Next cursor must advance the page");
  }
  const totalItems = input.totalItems ?? input.items.length;
  if (!Number.isInteger(totalItems) || totalItems < input.items.length) {
    contractError(
      "INVALID_PAGE",
      "Work Queue totalItems must include every item on the current page",
    );
  }
  const facets = input.facets ?? deriveWorkQueueFacets(input.items);
  assertWorkQueueFacets(facets, totalItems);
  assertJsonSerializable(input.items);
  const page: WorkQueuePage = {
    contractVersion: workQueueContractVersion,
    query: { ...input.query },
    items: [...input.items],
    totalItems,
    facets: {
      actionKinds: facets.actionKinds.map((facet) => ({ ...facet })),
      processStages: facets.processStages.map((facet) => ({ ...facet })),
      owners: facets.owners.map((facet) => ({ ...facet })),
    },
    pageInfo: {
      limit: input.query.limit,
      hasNextPage: input.nextCursor !== null,
      nextCursor: input.nextCursor,
    },
  };
  assertJsonSerializable(page);
  return page;
}
