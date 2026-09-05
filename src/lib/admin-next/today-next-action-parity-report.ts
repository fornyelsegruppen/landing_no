import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";
import type {
  CaseNextActionOwnerParty,
  CaseNextActionTargetEntity,
} from "@/lib/admin-v2/case-next-action-presentation";
import { projectLegacyNextActionDiagnostic } from "@/lib/admin-v2/legacy-next-action-adapter";
import type {
  WorkQueueInteraction,
  WorkQueueItem,
} from "./work-queue-contract";

export const todayNextActionParityReportVersion = "ua-f2-009-v1" as const;

export const todayNextActionParityClassifications = [
  "match",
  "legacy_unknown",
  "missing_canonical_target",
  "owner_or_due_gap",
  "blocker_gap",
  "revision_conflict",
] as const;

export type TodayNextActionParityClassification =
  (typeof todayNextActionParityClassifications)[number];

export type TodayParityInteraction = {
  mode: WorkQueueInteraction["mode"];
  activationKind: "inline_command" | "open_workbench" | null;
  reason:
    | "capability_denied"
    | "diagnostic_blocker"
    | "no_action"
    | "source_not_canonical"
    | "target_unavailable"
    | null;
  waitingParty: "customer" | "system" | "worker" | null;
};

export type TodayParityTarget = {
  entity: CaseNextActionTargetEntity;
  id: string;
  version: string | null;
};

export type TodayParityOwner = {
  id: string | null;
  party: CaseNextActionOwnerParty;
};

export type TodayParityTiming = {
  dueAt: string | null;
  wakeAt: string | null;
};

export type TodayParityCanonicalInput = {
  caseId: string;
  revision: number;
  derivedKind: CaseNextActionKind;
  interaction: TodayParityInteraction;
  target: TodayParityTarget | null;
  owner: TodayParityOwner;
  timing: TodayParityTiming;
  blockers: readonly {
    code: string;
    sourceType: string;
    sourceId: string;
  }[];
};

/**
 * A normalized legacy shadow-read. `nextActionText` is inspected in memory and
 * intentionally never copied to the PII-minimal report.
 */
export type TodayParityLegacyInput = {
  caseId: string;
  revision: number;
  nextActionText?: string | null;
  observedInteractionMode?: WorkQueueInteraction["mode"] | null;
  target?: TodayParityTarget | null;
  owner?: TodayParityOwner | null;
  dueAt?: string | null;
  wakeAt?: string | null;
  blockerCodes?: readonly string[] | null;
};

export type TodayNextActionParityReportInput = {
  generatedAt: string;
  canonical: readonly TodayParityCanonicalInput[];
  legacy: readonly TodayParityLegacyInput[];
};

type ComparisonResult = "match" | "mismatch" | "missing" | "unknown";

export type TodayNextActionParityItem = {
  case: {
    id: string;
    canonicalRevision: number | null;
    legacyRevision: number | null;
  };
  classification: TodayNextActionParityClassification;
  canonical: {
    derivedKind: CaseNextActionKind;
    interaction: TodayParityInteraction;
    target: TodayParityTarget | null;
    owner: TodayParityOwner;
    timing: TodayParityTiming;
    blockers: readonly {
      code: string;
      sourceType: string;
      sourceId: string;
    }[];
  } | null;
  legacy: {
    authority: "diagnostic_only";
    executableTruth: false;
    text: {
      included: false;
      present: boolean;
      status: "known" | "missing" | "unknown_legacy";
      suggestedKind: CaseNextActionKind | null;
    };
    observedInteractionMode: WorkQueueInteraction["mode"] | null;
    target: TodayParityTarget | null;
    owner: TodayParityOwner | null;
    timing: TodayParityTiming;
    blockerCodes: readonly string[];
    invalidBlockerCodeCount: number;
  } | null;
  comparison: {
    kind: ComparisonResult;
    interaction: ComparisonResult;
    target: ComparisonResult;
    owner: ComparisonResult;
    due: ComparisonResult;
    blocker: ComparisonResult;
  };
};

export type TodayNextActionParityReport = {
  contractVersion: typeof todayNextActionParityReportVersion;
  generatedAt: string;
  items: readonly TodayNextActionParityItem[];
  summary: {
    total: number;
    counts: Record<TodayNextActionParityClassification, number>;
  };
};

export type TodayNextActionParityErrorCode =
  | "INVALID_CANONICAL_INPUT"
  | "INVALID_CASE_ID"
  | "INVALID_GENERATED_AT"
  | "INVALID_REVISION";

export class TodayNextActionParityError extends Error {
  constructor(
    readonly code: TodayNextActionParityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TodayNextActionParityError";
  }
}

const caseIdPattern = /^case:[1-9]\d*$/u;
const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/u;
const blockerCodePattern = /^[A-Z][A-Z0-9_]{2,127}$/u;

function parityError(
  code: TodayNextActionParityErrorCode,
  message: string,
): never {
  throw new TodayNextActionParityError(code, message);
}

function assertCaseId(value: string) {
  if (!caseIdPattern.test(value)) {
    parityError(
      "INVALID_CASE_ID",
      "Parity records require a canonical case:<id>",
    );
  }
}

function assertRevision(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    parityError(
      "INVALID_REVISION",
      "Parity records require a positive revision",
    );
  }
}

function utcInstant(value: string | null | undefined, strict: boolean) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    if (strict) {
      parityError("INVALID_CANONICAL_INPUT", "Canonical timing is invalid");
    }
    return null;
  }
  return new Date(parsed).toISOString();
}

function normalizeTarget(
  target: TodayParityTarget | null | undefined,
  strict: boolean,
): TodayParityTarget | null {
  if (!target) return null;
  if (
    !stableIdPattern.test(target.id) ||
    (target.version !== null && !stableIdPattern.test(target.version))
  ) {
    if (strict) {
      parityError("INVALID_CANONICAL_INPUT", "Canonical target is invalid");
    }
    return null;
  }
  return {
    entity: target.entity,
    id: target.id,
    version: target.version,
  };
}

function normalizeOwner(
  owner: TodayParityOwner | null | undefined,
  strict: boolean,
): TodayParityOwner | null {
  if (!owner) return null;
  if (owner.id !== null && !stableIdPattern.test(owner.id)) {
    if (strict) {
      parityError("INVALID_CANONICAL_INPUT", "Canonical owner ID is invalid");
    }
    return null;
  }
  return { id: owner.id, party: owner.party };
}

function normalizeCanonicalBlockers(
  blockers: TodayParityCanonicalInput["blockers"],
) {
  return blockers
    .map((blocker) => {
      if (
        !blockerCodePattern.test(blocker.code) ||
        !stableIdPattern.test(blocker.sourceId) ||
        !stableIdPattern.test(blocker.sourceType)
      ) {
        parityError("INVALID_CANONICAL_INPUT", "Canonical blocker is invalid");
      }
      return {
        code: blocker.code,
        sourceType: blocker.sourceType,
        sourceId: blocker.sourceId,
      };
    })
    .sort((left, right) =>
      `${left.code}:${left.sourceType}:${left.sourceId}`.localeCompare(
        `${right.code}:${right.sourceType}:${right.sourceId}`,
        "en",
      ),
    );
}

function normalizeLegacyBlockers(values: readonly string[] | null | undefined) {
  const valid = new Set<string>();
  let invalidCount = 0;
  for (const value of values || []) {
    if (blockerCodePattern.test(value)) valid.add(value);
    else invalidCount += 1;
  }
  return { values: [...valid].sort(), invalidCount };
}

function interactionFromWorkQueue(item: WorkQueueItem): TodayParityInteraction {
  if (item.interaction.mode === "executable") {
    return {
      mode: "executable",
      activationKind: item.interaction.activation.kind,
      reason: null,
      waitingParty: null,
    };
  }
  if (item.interaction.mode === "waiting") {
    return {
      mode: "waiting",
      activationKind: null,
      reason: null,
      waitingParty: item.interaction.waitingParty,
    };
  }
  return {
    mode: "read_only",
    activationKind: null,
    reason: item.interaction.reason,
    waitingParty: null,
  };
}

/** Creates the PII-minimal canonical snapshot from a validated Work Queue item. */
export function snapshotCanonicalTodayParity(
  item: WorkQueueItem,
): TodayParityCanonicalInput {
  return {
    caseId: item.case.id,
    revision: item.case.revision,
    derivedKind: item.action.kind,
    interaction: interactionFromWorkQueue(item),
    target: {
      entity: item.target.entity,
      id: item.target.id,
      version: item.target.version,
    },
    owner: { ...item.owner },
    timing: { ...item.timing },
    blockers: item.blockers.map((blocker) => ({
      code: blocker.code,
      sourceType: blocker.source.type,
      sourceId: blocker.source.id,
    })),
  };
}

function canonicalOutput(value: TodayParityCanonicalInput) {
  assertCaseId(value.caseId);
  assertRevision(value.revision);
  const target = normalizeTarget(value.target, true);
  const owner = normalizeOwner(value.owner, true);
  if (!owner) {
    parityError("INVALID_CANONICAL_INPUT", "Canonical owner is required");
  }
  return {
    derivedKind: value.derivedKind,
    interaction: { ...value.interaction },
    target,
    owner,
    timing: {
      dueAt: utcInstant(value.timing.dueAt, true),
      wakeAt: utcInstant(value.timing.wakeAt, true),
    },
    blockers: normalizeCanonicalBlockers(value.blockers),
  };
}

function legacyOutput(
  value: TodayParityLegacyInput,
  canonicalKind: CaseNextActionKind,
) {
  assertCaseId(value.caseId);
  assertRevision(value.revision);
  const diagnostic = projectLegacyNextActionDiagnostic({
    canonicalKind,
    legacyText: value.nextActionText,
  });
  const blockers = normalizeLegacyBlockers(value.blockerCodes);
  return {
    authority: "diagnostic_only" as const,
    executableTruth: false as const,
    text: {
      included: false as const,
      present: diagnostic.legacyTextPresent,
      status: diagnostic.status,
      suggestedKind: diagnostic.suggestedKind,
    },
    observedInteractionMode: value.observedInteractionMode || null,
    target: normalizeTarget(value.target, false),
    owner: normalizeOwner(value.owner, false),
    timing: {
      dueAt: utcInstant(value.dueAt, false),
      wakeAt: utcInstant(value.wakeAt, false),
    },
    blockerCodes: blockers.values,
    invalidBlockerCodeCount: blockers.invalidCount,
  };
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function comparison(
  canonical: ReturnType<typeof canonicalOutput> | null,
  legacy: ReturnType<typeof legacyOutput> | null,
) {
  if (!canonical) {
    return {
      kind: "missing",
      interaction: "missing",
      target: "missing",
      owner: "missing",
      due: "missing",
      blocker: "missing",
    } as const;
  }
  if (!legacy) {
    return {
      kind: "unknown",
      interaction: "unknown",
      target: "unknown",
      owner: "unknown",
      due: "unknown",
      blocker: "unknown",
    } as const;
  }
  const kind = legacy.text.suggestedKind
    ? legacy.text.suggestedKind === canonical.derivedKind
      ? "match"
      : "mismatch"
    : "unknown";
  return {
    kind,
    interaction: legacy.observedInteractionMode
      ? legacy.observedInteractionMode === canonical.interaction.mode
        ? "match"
        : "mismatch"
      : "missing",
    target: legacy.target
      ? same(legacy.target, canonical.target)
        ? "match"
        : "mismatch"
      : "missing",
    owner: legacy.owner
      ? same(legacy.owner, canonical.owner)
        ? "match"
        : "mismatch"
      : "missing",
    due: same(legacy.timing, canonical.timing) ? "match" : "mismatch",
    blocker:
      legacy.invalidBlockerCodeCount === 0 &&
      same(
        legacy.blockerCodes,
        [...new Set(canonical.blockers.map(({ code }) => code))].sort(),
      )
        ? "match"
        : "mismatch",
  } satisfies TodayNextActionParityItem["comparison"];
}

function classification(
  canonicalRevision: number | null,
  legacyRevision: number | null,
  revisionConflict: boolean,
  canonical: ReturnType<typeof canonicalOutput> | null,
  legacy: ReturnType<typeof legacyOutput> | null,
  compared: TodayNextActionParityItem["comparison"],
): TodayNextActionParityClassification {
  if (
    revisionConflict ||
    (canonicalRevision !== null &&
      legacyRevision !== null &&
      canonicalRevision !== legacyRevision)
  ) {
    return "revision_conflict";
  }
  if (!canonical || !canonical.target) return "missing_canonical_target";
  if (
    !legacy ||
    legacy.text.status !== "known" ||
    compared.kind !== "match" ||
    compared.interaction !== "match" ||
    compared.target !== "match"
  ) {
    return "legacy_unknown";
  }
  if (compared.owner !== "match" || compared.due !== "match") {
    return "owner_or_due_gap";
  }
  if (compared.blocker !== "match") return "blocker_gap";
  return "match";
}

function chooseLatest<T extends { revision: number }>(values: readonly T[]) {
  return [...values].sort((left, right) => {
    if (left.revision !== right.revision) return right.revision - left.revision;
    return JSON.stringify(left).localeCompare(JSON.stringify(right), "en");
  })[0];
}

function hasConflictingDuplicates<T extends { revision: number }>(
  values: readonly T[],
  fingerprint: (value: T) => unknown,
) {
  const byRevision = new Map<number, Set<string>>();
  for (const value of values) {
    const fingerprints = byRevision.get(value.revision) || new Set<string>();
    fingerprints.add(JSON.stringify(fingerprint(value)));
    byRevision.set(value.revision, fingerprints);
  }
  return (
    byRevision.size > 1 || [...byRevision.values()].some((set) => set.size > 1)
  );
}

function emptyCounts(): Record<TodayNextActionParityClassification, number> {
  return {
    match: 0,
    legacy_unknown: 0,
    missing_canonical_target: 0,
    owner_or_due_gap: 0,
    blocker_gap: 0,
    revision_conflict: 0,
  };
}

/**
 * Pure shadow-read parity projection. It emits no command, capability grant,
 * customer identity, address, message body, or raw legacy next-action text.
 */
export function createTodayNextActionParityReport(
  input: TodayNextActionParityReportInput,
): TodayNextActionParityReport {
  const generatedAt = utcInstant(input.generatedAt, false);
  if (!generatedAt) {
    parityError(
      "INVALID_GENERATED_AT",
      "Report generatedAt must be a UTC instant",
    );
  }
  const canonicalByCase = new Map<string, TodayParityCanonicalInput[]>();
  const legacyByCase = new Map<string, TodayParityLegacyInput[]>();
  for (const item of input.canonical) {
    assertCaseId(item.caseId);
    assertRevision(item.revision);
    canonicalByCase.set(item.caseId, [
      ...(canonicalByCase.get(item.caseId) || []),
      item,
    ]);
  }
  for (const item of input.legacy) {
    assertCaseId(item.caseId);
    assertRevision(item.revision);
    legacyByCase.set(item.caseId, [
      ...(legacyByCase.get(item.caseId) || []),
      item,
    ]);
  }
  const caseIds = [
    ...new Set([...canonicalByCase.keys(), ...legacyByCase.keys()]),
  ].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  const items = caseIds.map((caseId): TodayNextActionParityItem => {
    const canonicalValues = canonicalByCase.get(caseId) || [];
    const legacyValues = legacyByCase.get(caseId) || [];
    const canonicalInput = chooseLatest(canonicalValues);
    const canonical = canonicalInput ? canonicalOutput(canonicalInput) : null;
    const legacyInput = chooseLatest(legacyValues);
    const legacy = legacyInput
      ? legacyOutput(legacyInput, canonical?.derivedKind || "none")
      : null;
    const compared = comparison(canonical, legacy);
    const revisionConflict =
      hasConflictingDuplicates(canonicalValues, canonicalOutput) ||
      hasConflictingDuplicates(legacyValues, (value) =>
        legacyOutput(value, canonical?.derivedKind || "none"),
      );
    const itemClassification = classification(
      canonicalInput?.revision || null,
      legacyInput?.revision || null,
      revisionConflict,
      canonical,
      legacy,
      compared,
    );
    return {
      case: {
        id: caseId,
        canonicalRevision: canonicalInput?.revision || null,
        legacyRevision: legacyInput?.revision || null,
      },
      classification: itemClassification,
      canonical,
      legacy,
      comparison: compared,
    };
  });
  const counts = emptyCounts();
  for (const item of items) counts[item.classification] += 1;
  const report: TodayNextActionParityReport = {
    contractVersion: todayNextActionParityReportVersion,
    generatedAt,
    items,
    summary: { total: items.length, counts },
  };
  JSON.stringify(report);
  return report;
}
