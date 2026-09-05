import {
  projectAuditHistory,
  type AuditHistoryItem,
  type AuditHistorySourceEvent,
  type AuditHistoryTimeline,
} from "./audit-history-projection";

const correlationIdPattern = /^[a-zA-Z0-9._:-]{1,160}$/u;

export type CaseAuditHistoryScope = {
  /** The canonical case record is the Payload lead. */
  leadId: number;
  /**
   * Correlations resolved by a trusted case loader. Raw audit metadata is never
   * inspected to discover case membership.
   */
  correlationIds?: readonly string[];
};

/** Structurally accepts the `docs` portion returned by Payload `find`. */
export type CaseAuditHistoryLoaderPage = {
  docs: readonly AuditHistorySourceEvent[];
};

export type CaseAuditHistoryUnavailableReason =
  "canonical_audit_unavailable" | "invalid_case_scope";

export type CaseAuditHistoryReadResult =
  | {
      status: "ready";
      source: "canonical";
      value: AuditHistoryTimeline;
    }
  | {
      status: "unavailable";
      source: "canonical";
      reason: CaseAuditHistoryUnavailableReason;
    };

export type CaseAuditHistoryCanonicalLoader = (
  scope: Readonly<CaseAuditHistoryScope>,
) => Promise<CaseAuditHistoryLoaderPage | null | undefined>;

export type CaseAuditHistoryReadAdapter = {
  load(scope: CaseAuditHistoryScope): Promise<CaseAuditHistoryReadResult>;
};

function validScope(scope: CaseAuditHistoryScope) {
  return (
    Number.isSafeInteger(scope.leadId) &&
    scope.leadId > 0 &&
    (scope.correlationIds === undefined ||
      scope.correlationIds.every(
        (correlationId) =>
          typeof correlationId === "string" &&
          correlationIdPattern.test(correlationId),
      ))
  );
}

function unavailable(
  reason: CaseAuditHistoryUnavailableReason,
): CaseAuditHistoryReadResult {
  return { status: "unavailable", source: "canonical", reason };
}

function isCaseAnchor(item: AuditHistoryItem) {
  return item.entity.type === "lead" || item.entity.type === "case";
}

function isTargetCaseAnchor(item: AuditHistoryItem, leadId: number) {
  const numericId = String(leadId);
  return (
    (item.entity.type === "lead" && item.entity.id === numericId) ||
    (item.entity.type === "case" && item.entity.id === `lead-${numericId}`)
  );
}

/**
 * Converts an already-loaded canonical Payload page into a privacy-safe,
 * case-scoped timeline. It is a pure read projection and never returns the raw
 * event, actor record, or metadata object.
 */
export function adaptCanonicalCaseAuditHistory(
  page: CaseAuditHistoryLoaderPage | null | undefined,
  scope: CaseAuditHistoryScope,
): CaseAuditHistoryReadResult {
  if (!validScope(scope)) return unavailable("invalid_case_scope");
  if (!page || !Array.isArray(page.docs)) {
    return unavailable("canonical_audit_unavailable");
  }

  const projected = projectAuditHistory(page.docs);
  const targetAnchorCorrelations = new Set(
    projected.items
      .filter((item) => isTargetCaseAnchor(item, scope.leadId))
      .map((item) => item.correlationId),
  );
  const trustedCorrelations = new Set([
    ...(scope.correlationIds ?? []),
    ...targetAnchorCorrelations,
  ]);

  // A correlation that also identifies another case is ambiguous. Excluding
  // the entire group prevents a malformed loader result from crossing cases.
  const conflictingCorrelations = new Set(
    projected.items
      .filter(
        (item) => isCaseAnchor(item) && !isTargetCaseAnchor(item, scope.leadId),
      )
      .map((item) => item.correlationId)
      .filter((correlationId) => trustedCorrelations.has(correlationId)),
  );

  const items = projected.items.filter((item) => {
    if (conflictingCorrelations.has(item.correlationId)) return false;
    return (
      isTargetCaseAnchor(item, scope.leadId) ||
      trustedCorrelations.has(item.correlationId)
    );
  });

  return {
    status: "ready",
    source: "canonical",
    value: {
      order: "newest_first",
      items,
      rejectedCount: projected.rejectedCount,
    },
  };
}

/**
 * Wraps a read-only canonical loader. Loader failures collapse to an explicit
 * unavailable state without exposing exception messages or falling back to
 * fixtures.
 */
export function createCaseAuditHistoryReadAdapter(
  loader: CaseAuditHistoryCanonicalLoader,
): CaseAuditHistoryReadAdapter {
  return {
    async load(scope) {
      if (!validScope(scope)) return unavailable("invalid_case_scope");
      try {
        return adaptCanonicalCaseAuditHistory(await loader(scope), scope);
      } catch {
        return unavailable("canonical_audit_unavailable");
      }
    },
  };
}
