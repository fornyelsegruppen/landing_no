import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";
import {
  getCaseNextActionPresentation,
  type CaseNextActionCapability,
  type CaseNextActionLocale,
  type CaseNextActionOwnerParty,
  type CaseNextActionProcessStage,
  type CaseNextActionTargetEntity,
  type LocalizedCaseNextActionPresentation,
} from "@/lib/admin-v2/case-next-action-presentation";

export const caseWorkspaceGoldenFixtureMarker = "synthetic:ua-f2-005" as const;
export const caseWorkspaceGoldenProjectionVersion = "ua-f2-005-v1" as const;
export const caseWorkspaceGoldenFixtureNow =
  "2026-09-04T12:00:00.000Z" as const;
export const caseWorkspaceGoldenStageOrder = [
  "inquiry",
  "evidence",
  "commercial",
  "agreement",
  "work",
  "completion",
] as const satisfies readonly CaseNextActionProcessStage[];

export type CaseWorkspaceGoldenFixtureId =
  | "executable_measurement_review"
  | "waiting_customer"
  | "overdue_unassigned"
  | "blocked_work_recovery"
  | "capability_read_only"
  | "target_unavailable"
  | "completed_no_action";

export type CaseWorkspaceGoldenStage = {
  id: CaseNextActionProcessStage;
  state: "complete" | "current" | "upcoming";
};

export type CaseWorkspaceGoldenExactTarget = {
  entity: CaseNextActionTargetEntity;
  id: string;
  version: string | null;
  href: string;
};

export type CaseWorkspaceGoldenInteraction =
  | { mode: "executable"; activation: "open_workbench" }
  | { mode: "waiting"; waitingParty: "customer" | "system" | "worker" }
  | {
      mode: "read_only";
      reason: "capability_denied" | "no_action" | "target_unavailable";
    };

export type CaseWorkspaceGoldenFixture = {
  fixtureId: CaseWorkspaceGoldenFixtureId;
  source: {
    kind: "synthetic_fixture";
    marker: typeof caseWorkspaceGoldenFixtureMarker;
    fixtureOnly: true;
    canonicalEligibility: "forbidden";
  };
  case: {
    id: string;
    reference: string;
  };
  status: {
    lifecycle: "active" | "closed";
    caseState: "needs_action" | "waiting" | "blocked" | "complete";
  };
  risk: {
    level: "none" | "low" | "medium" | "high";
    code:
      | "NONE"
      | "CUSTOMER_WAIT"
      | "SLA_OVERDUE_UNASSIGNED"
      | "WORK_BLOCKED"
      | "CAPABILITY_REQUIRED"
      | "TARGET_MISSING"
      | "MEASUREMENT_REVIEW";
  };
  version: {
    caseRevision: number;
    targetVersion: string | null;
    projectionVersion: typeof caseWorkspaceGoldenProjectionVersion;
  };
  stages: readonly CaseWorkspaceGoldenStage[];
  terminal: boolean;
  primary: {
    nextAction: {
      kind: CaseNextActionKind;
      interaction: CaseWorkspaceGoldenInteraction;
      targetState: "exact" | "unavailable";
      target: CaseWorkspaceGoldenExactTarget | null;
      owner: {
        party: CaseNextActionOwnerParty;
        id: string | null;
      };
      timing: {
        dueAt: string | null;
        wakeAt: string | null;
      };
      capability: {
        required: CaseNextActionCapability;
        granted: boolean;
      };
      presentations: Readonly<
        Record<CaseNextActionLocale, LocalizedCaseNextActionPresentation>
      >;
    };
    blocker: {
      code: "WORK_ORDER_BLOCKED";
      source: { type: "work_order"; id: string };
    } | null;
    recovery: {
      kind: "open_exact_target";
      targetId: string;
    } | null;
  };
};

type FixtureInput = {
  fixtureId: CaseWorkspaceGoldenFixtureId;
  caseNumber: number;
  revision: number;
  kind: CaseNextActionKind;
  currentStage: CaseNextActionProcessStage;
  status: CaseWorkspaceGoldenFixture["status"];
  risk: CaseWorkspaceGoldenFixture["risk"];
  interaction: CaseWorkspaceGoldenInteraction;
  target: CaseWorkspaceGoldenExactTarget | null;
  targetState?: "exact" | "unavailable";
  ownerId: string | null;
  dueAt?: string | null;
  wakeAt?: string | null;
  capabilityGranted: boolean;
  blocker?: CaseWorkspaceGoldenFixture["primary"]["blocker"];
  recovery?: CaseWorkspaceGoldenFixture["primary"]["recovery"];
  terminal?: boolean;
};

function stagesFor(
  currentStage: CaseNextActionProcessStage,
  terminal: boolean,
): readonly CaseWorkspaceGoldenStage[] {
  const currentIndex = caseWorkspaceGoldenStageOrder.indexOf(currentStage);
  return caseWorkspaceGoldenStageOrder.map((id, index) => ({
    id,
    state: terminal
      ? "complete"
      : index < currentIndex
        ? "complete"
        : index === currentIndex
          ? "current"
          : "upcoming",
  }));
}

function presentationsFor(kind: CaseNextActionKind) {
  return {
    nb: getCaseNextActionPresentation(kind, "nb"),
    lt: getCaseNextActionPresentation(kind, "lt"),
    en: getCaseNextActionPresentation(kind, "en"),
  } satisfies Record<CaseNextActionLocale, LocalizedCaseNextActionPresentation>;
}

function fixture(input: FixtureInput): CaseWorkspaceGoldenFixture {
  const presentation = getCaseNextActionPresentation(input.kind, "en");
  return {
    fixtureId: input.fixtureId,
    source: {
      kind: "synthetic_fixture",
      marker: caseWorkspaceGoldenFixtureMarker,
      fixtureOnly: true,
      canonicalEligibility: "forbidden",
    },
    case: {
      id: `case:${input.caseNumber}`,
      reference: `TF-${input.caseNumber}`,
    },
    status: { ...input.status },
    risk: { ...input.risk },
    version: {
      caseRevision: input.revision,
      targetVersion: input.target?.version || null,
      projectionVersion: caseWorkspaceGoldenProjectionVersion,
    },
    stages: stagesFor(input.currentStage, Boolean(input.terminal)),
    terminal: Boolean(input.terminal),
    primary: {
      nextAction: {
        kind: input.kind,
        interaction: input.interaction,
        targetState: input.targetState || "exact",
        target: input.target,
        owner: { party: presentation.owner.party, id: input.ownerId },
        timing: {
          dueAt: input.dueAt || null,
          wakeAt: input.wakeAt || null,
        },
        capability: {
          required: presentation.requiredCapability,
          granted: input.capabilityGranted,
        },
        presentations: presentationsFor(input.kind),
      },
      blocker: input.blocker || null,
      recovery: input.recovery || null,
    },
  };
}

export const caseWorkspaceGoldenStateFixtures: readonly CaseWorkspaceGoldenFixture[] =
  [
    fixture({
      fixtureId: "executable_measurement_review",
      caseNumber: 9001,
      revision: 7,
      kind: "approve_measurement",
      currentStage: "evidence",
      status: { lifecycle: "active", caseState: "needs_action" },
      risk: { level: "medium", code: "MEASUREMENT_REVIEW" },
      interaction: { mode: "executable", activation: "open_workbench" },
      target: {
        entity: "measurement",
        id: "measurement:9101",
        version: "r4",
        href: "/admin-next-preview/cases/9001/measurements/9101",
      },
      ownerId: "user:71",
      dueAt: "2026-09-04T14:00:00.000Z",
      capabilityGranted: true,
    }),
    fixture({
      fixtureId: "waiting_customer",
      caseNumber: 9002,
      revision: 8,
      kind: "wait_customer",
      currentStage: "commercial",
      status: { lifecycle: "active", caseState: "waiting" },
      risk: { level: "low", code: "CUSTOMER_WAIT" },
      interaction: { mode: "waiting", waitingParty: "customer" },
      target: {
        entity: "quote",
        id: "quote:9202",
        version: "r3",
        href: "/admin-v2/cases/9002?target=quote%3A9202",
      },
      ownerId: "case:9002:customer",
      wakeAt: "2026-09-08T08:00:00.000Z",
      capabilityGranted: true,
    }),
    fixture({
      fixtureId: "overdue_unassigned",
      caseNumber: 9003,
      revision: 3,
      kind: "assign_worker",
      currentStage: "work",
      status: { lifecycle: "active", caseState: "needs_action" },
      risk: { level: "high", code: "SLA_OVERDUE_UNASSIGNED" },
      interaction: { mode: "executable", activation: "open_workbench" },
      target: {
        entity: "work_order",
        id: "work_order:9303",
        version: "r1",
        href: "/admin-v2/cases/9003?target=work_order%3A9303",
      },
      ownerId: null,
      dueAt: "2026-09-03T08:00:00.000Z",
      capabilityGranted: true,
    }),
    fixture({
      fixtureId: "blocked_work_recovery",
      caseNumber: 9004,
      revision: 11,
      kind: "resolve_work_block",
      currentStage: "work",
      status: { lifecycle: "active", caseState: "blocked" },
      risk: { level: "high", code: "WORK_BLOCKED" },
      interaction: { mode: "executable", activation: "open_workbench" },
      target: {
        entity: "work_order",
        id: "work_order:9404",
        version: "r6",
        href: "/admin-v2/cases/9004?target=work_order%3A9404",
      },
      ownerId: "user:74",
      dueAt: "2026-09-04T09:00:00.000Z",
      capabilityGranted: true,
      blocker: {
        code: "WORK_ORDER_BLOCKED",
        source: { type: "work_order", id: "work_order:9404" },
      },
      recovery: {
        kind: "open_exact_target",
        targetId: "work_order:9404",
      },
    }),
    fixture({
      fixtureId: "capability_read_only",
      caseNumber: 9005,
      revision: 5,
      kind: "company_sign_contract",
      currentStage: "agreement",
      status: { lifecycle: "active", caseState: "needs_action" },
      risk: { level: "medium", code: "CAPABILITY_REQUIRED" },
      interaction: { mode: "read_only", reason: "capability_denied" },
      target: {
        entity: "contract",
        id: "contract:9505",
        version: "r2",
        href: "/admin-v2/cases/9005?target=contract%3A9505",
      },
      ownerId: "user:75",
      dueAt: "2026-09-05T12:00:00.000Z",
      capabilityGranted: false,
    }),
    fixture({
      fixtureId: "target_unavailable",
      caseNumber: 9006,
      revision: 4,
      kind: "approve_quote",
      currentStage: "commercial",
      status: { lifecycle: "active", caseState: "blocked" },
      risk: { level: "high", code: "TARGET_MISSING" },
      interaction: { mode: "read_only", reason: "target_unavailable" },
      targetState: "unavailable",
      target: null,
      ownerId: "user:76",
      dueAt: "2026-09-04T15:00:00.000Z",
      capabilityGranted: true,
    }),
    fixture({
      fixtureId: "completed_no_action",
      caseNumber: 9007,
      revision: 15,
      kind: "none",
      currentStage: "completion",
      status: { lifecycle: "closed", caseState: "complete" },
      risk: { level: "none", code: "NONE" },
      interaction: { mode: "read_only", reason: "no_action" },
      target: {
        entity: "case",
        id: "case:9007",
        version: "r15",
        href: "/admin-v2/cases/9007",
      },
      ownerId: null,
      capabilityGranted: false,
      terminal: true,
    }),
  ] as const;

export type CaseWorkspaceGoldenFixtureErrorCode =
  | "BLOCKER_INVARIANT"
  | "CAPABILITY_INVARIANT"
  | "FIXTURE_SOURCE_INVARIANT"
  | "INTERACTION_INVARIANT"
  | "PRESENTATION_INVARIANT"
  | "STAGE_INVARIANT"
  | "STATUS_RISK_VERSION_INVARIANT"
  | "TARGET_INVARIANT"
  | "TIMING_INVARIANT";

export class CaseWorkspaceGoldenFixtureError extends Error {
  constructor(
    readonly code: CaseWorkspaceGoldenFixtureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CaseWorkspaceGoldenFixtureError";
  }
}

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/u;
const caseIdPattern = /^case:[1-9]\d*$/u;
const operatorHrefPattern = /^\/(?:admin-v2|admin-next-preview)(?:[/?]|$)/u;

function invariant(
  code: CaseWorkspaceGoldenFixtureErrorCode,
  condition: boolean,
  message: string,
) {
  if (!condition) throw new CaseWorkspaceGoldenFixtureError(code, message);
}

function isUtc(value: string | null) {
  if (!value) return true;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

/** Runtime invariant gate for the synthetic golden-state data only. */
export function validateCaseWorkspaceGoldenStateFixture(
  value: CaseWorkspaceGoldenFixture,
) {
  invariant(
    "FIXTURE_SOURCE_INVARIANT",
    value.source.marker === caseWorkspaceGoldenFixtureMarker &&
      value.source.fixtureOnly === true &&
      value.source.canonicalEligibility === "forbidden" &&
      caseIdPattern.test(value.case.id) &&
      value.case.reference === `TF-${value.case.id.slice("case:".length)}`,
    "Golden state must remain explicitly synthetic and fixture-only",
  );
  invariant(
    "STATUS_RISK_VERSION_INVARIANT",
    value.status !== (value.risk as unknown) &&
      value.risk !== (value.version as unknown) &&
      Number.isInteger(value.version.caseRevision) &&
      value.version.caseRevision > 0,
    "Status, risk and version must remain distinct valid dimensions",
  );
  invariant(
    "STAGE_INVARIANT",
    value.stages.length === 6 &&
      value.stages.every(
        (stage, index) => stage.id === caseWorkspaceGoldenStageOrder[index],
      ),
    "Golden state must expose the exact six canonical stages",
  );
  const currentIndexes = value.stages.flatMap((stage, index) =>
    stage.state === "current" ? [index] : [],
  );
  if (value.terminal) {
    invariant(
      "STAGE_INVARIANT",
      currentIndexes.length === 0 &&
        value.stages.every(({ state }) => state === "complete") &&
        value.primary.nextAction.kind === "none",
      "Terminal fixture must complete all stages and have no action",
    );
  } else {
    invariant(
      "STAGE_INVARIANT",
      currentIndexes.length === 1 &&
        value.stages.every(({ state }, index) =>
          index < currentIndexes[0]
            ? state === "complete"
            : index === currentIndexes[0]
              ? state === "current"
              : state === "upcoming",
        ),
      "Non-terminal stages must be monotonic around one current stage",
    );
  }

  const action = value.primary.nextAction;
  const canonical = action.presentations.en;
  for (const locale of ["nb", "lt", "en"] as const) {
    invariant(
      "PRESENTATION_INVARIANT",
      JSON.stringify(action.presentations[locale]) ===
        JSON.stringify(getCaseNextActionPresentation(action.kind, locale)),
      `Presentation must be canonical for ${locale}`,
    );
  }
  if (!value.terminal) {
    invariant(
      "STAGE_INVARIANT",
      value.stages[currentIndexes[0]].id === canonical.processStage,
      "Current stage must match canonical action presentation",
    );
  }
  invariant(
    "CAPABILITY_INVARIANT",
    action.capability.required === canonical.requiredCapability,
    "Capability must come from canonical presentation",
  );
  invariant(
    "TIMING_INVARIANT",
    isUtc(action.timing.dueAt) && isUtc(action.timing.wakeAt),
    "Due and wake values must be full UTC instants",
  );

  const blocked = canonical.caseStateHint === "blocked";
  invariant(
    "BLOCKER_INVARIANT",
    !Array.isArray(value.primary.blocker) &&
      (!blocked || value.primary.blocker !== null) &&
      (value.primary.blocker === null || value.status.caseState === "blocked"),
    "There can be only one primary blocker and blocked actions require it",
  );
  invariant(
    "BLOCKER_INVARIANT",
    (value.primary.blocker === null && value.primary.recovery === null) ||
      (value.primary.blocker !== null &&
        value.primary.recovery?.targetId === action.target?.id),
    "Primary blocker and recovery must be singular and target the same entity",
  );

  if (action.targetState === "unavailable") {
    invariant(
      "TARGET_INVARIANT",
      action.target === null &&
        action.interaction.mode === "read_only" &&
        action.interaction.reason === "target_unavailable",
      "Unavailable target must fail closed as read-only",
    );
  } else {
    const caseNumber = value.case.id.slice("case:".length);
    const targetSuffix = action.target?.id.split(":").at(-1) || "";
    invariant(
      "TARGET_INVARIANT",
      Boolean(
        action.target &&
        action.target.entity === canonical.target.entity &&
        stableIdPattern.test(action.target.id) &&
        operatorHrefPattern.test(action.target.href) &&
        action.target.href.includes(`/cases/${caseNumber}`) &&
        (action.target.entity === "case" ||
          action.target.href.includes(encodeURIComponent(action.target.id)) ||
          action.target.href.split(/[?#]/u)[0].endsWith(`/${targetSuffix}`)) &&
        action.target.version === value.version.targetVersion,
      ),
      "Available actions require one exact canonical operator target",
    );
  }

  if (canonical.reviewMode === "waiting") {
    invariant(
      "INTERACTION_INVARIANT",
      action.interaction.mode === "waiting" &&
        action.interaction.waitingParty === canonical.owner.party,
      "Waiting presentation must remain waiting",
    );
  } else if (canonical.reviewMode === "none") {
    invariant(
      "INTERACTION_INVARIANT",
      action.interaction.mode === "read_only" &&
        action.interaction.reason === "no_action",
      "No-action presentation must remain read-only",
    );
  } else if (action.targetState === "unavailable") {
    invariant(
      "INTERACTION_INVARIANT",
      action.interaction.mode === "read_only",
      "Missing target must remain read-only",
    );
  } else if (!action.capability.granted) {
    invariant(
      "INTERACTION_INVARIANT",
      action.interaction.mode === "read_only" &&
        action.interaction.reason === "capability_denied",
      "Denied capability must remain read-only",
    );
  } else {
    invariant(
      "INTERACTION_INVARIANT",
      action.interaction.mode === "executable" &&
        action.interaction.activation === "open_workbench",
      "Granted actionable state must open its exact workbench",
    );
  }

  JSON.stringify(value);
  return value;
}
