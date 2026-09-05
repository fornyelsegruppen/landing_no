import type { PanelLocale } from "@/lib/panel-i18n";
import type { AdminNextCaseWorkspaceView } from "./case-workspace-contract";
import {
  caseWorkspaceGoldenFixtureNow,
  caseWorkspaceGoldenStateFixtures,
  validateCaseWorkspaceGoldenStateFixture,
  type CaseWorkspaceGoldenFixture,
  type CaseWorkspaceGoldenFixtureId,
} from "./case-workspace-golden-state-fixtures";

export const caseWorkspaceGoldenVisualFixtureStateIds =
  caseWorkspaceGoldenStateFixtures.map(({ fixtureId }) => fixtureId);

const stateIdSet = new Set<string>(caseWorkspaceGoldenVisualFixtureStateIds);

const fixtureCopy = {
  nb: {
    address: "Syntetisk testadresse 12, 0164 Oslo",
    blocked: "Primær sperre: WORK_ORDER_BLOCKED.",
    capabilityDenied:
      "Tilstanden er skrivebeskyttet fordi nødvendig tilgang mangler.",
    customer: "Golden-kunde",
    evidence: "Syntetisk saksgrunnlag",
    evidenceSummary:
      "Fixture-only grunnlag for visuell kontroll av denne tilstanden.",
    ownerMissing: "Ikke tildelt",
    ownerParties: {
      administrator: "Administrator",
      customer: "Kunde",
      worker: "Medarbeider",
      system: "System",
      none: "Ingen ansvarlig",
    },
    service: "Takfornyelse",
    targetUnavailable:
      "Det eksakte målet er utilgjengelig; ingen handling kan utføres her.",
    team: "Golden-state fixture",
    timelineActor: "Fixture-projeksjon",
    timelineSummary:
      "Tilstanden ble projisert fra det validerte syntetiske grunnlaget.",
    timelineTitle: "Golden state projisert",
  },
  lt: {
    address: "Sintetinis testavimo adresas 12, 0164 Oslas",
    blocked: "Pagrindinis blokatorius: WORK_ORDER_BLOCKED.",
    capabilityDenied: "Būsena skirta tik skaityti, nes trūksta būtinos teisės.",
    customer: "Golden klientas",
    evidence: "Sintetiniai bylos duomenys",
    evidenceSummary:
      "Tik fixture naudojami duomenys šios būsenos vizualinei patikrai.",
    ownerMissing: "Nepriskirta",
    ownerParties: {
      administrator: "Administratorius",
      customer: "Klientas",
      worker: "Darbuotojas",
      system: "Sistema",
      none: "Atsakingo nėra",
    },
    service: "Stogo atnaujinimas",
    targetUnavailable:
      "Tikslus objektas nepasiekiamas; šiame ekrane veiksmas nevykdomas.",
    team: "Golden-state fixture",
    timelineActor: "Fixture projekcija",
    timelineSummary: "Būsena suprojektuota iš patikrintų sintetinių duomenų.",
    timelineTitle: "Golden būsena suprojektuota",
  },
  en: {
    address: "Synthetic test address 12, 0164 Oslo",
    blocked: "Primary blocker: WORK_ORDER_BLOCKED.",
    capabilityDenied:
      "This state is read-only because the required capability is missing.",
    customer: "Golden customer",
    evidence: "Synthetic case evidence",
    evidenceSummary:
      "Fixture-only evidence for visual verification of this state.",
    ownerMissing: "Unassigned",
    ownerParties: {
      administrator: "Administrator",
      customer: "Customer",
      worker: "Worker",
      system: "System",
      none: "No owner",
    },
    service: "Roof renewal",
    targetUnavailable:
      "The exact target is unavailable; no action can be performed here.",
    team: "Golden-state fixture",
    timelineActor: "Fixture projection",
    timelineSummary:
      "The state was projected from validated synthetic evidence.",
    timelineTitle: "Golden state projected",
  },
} as const;

export function parseCaseWorkspaceGoldenVisualFixtureState(
  value: string | string[] | undefined,
): CaseWorkspaceGoldenFixtureId | null {
  return typeof value === "string" && stateIdSet.has(value)
    ? (value as CaseWorkspaceGoldenFixtureId)
    : null;
}

export function getCaseWorkspaceGoldenVisualFixture(
  fixtureId: CaseWorkspaceGoldenFixtureId,
) {
  const fixture = caseWorkspaceGoldenStateFixtures.find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (!fixture) throw new Error(`Missing golden-state fixture: ${fixtureId}`);
  return validateCaseWorkspaceGoldenStateFixture(fixture);
}

function projectedSla(
  fixture: CaseWorkspaceGoldenFixture,
  locale: PanelLocale,
): AdminNextCaseWorkspaceView["sla"] {
  const instant =
    fixture.primary.nextAction.timing.dueAt ||
    fixture.primary.nextAction.timing.wakeAt;
  if (!instant) {
    return { deadline: "—", remainingMinutes: null, state: "unknown" };
  }
  const remainingMinutes = Math.round(
    (Date.parse(instant) - Date.parse(caseWorkspaceGoldenFixtureNow)) / 60_000,
  );
  return {
    deadline: new Intl.DateTimeFormat(
      locale === "nb" ? "nb-NO" : locale === "lt" ? "lt-LT" : "en-GB",
      { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" },
    ).format(new Date(instant)),
    remainingMinutes,
    state:
      remainingMinutes < 0
        ? "overdue"
        : remainingMinutes <= 4 * 60
          ? "due_soon"
          : "on_track",
  };
}

function projectedTimeline(
  fixture: CaseWorkspaceGoldenFixture,
  locale: PanelLocale,
): Pick<AdminNextCaseWorkspaceView, "timeline" | "timelineState"> {
  if (fixture.fixtureId === "capability_read_only") {
    return {
      timeline: [],
      timelineState: {
        status: "denied",
        source: "canonical",
        reason: "audit_read_denied",
      },
    };
  }
  if (fixture.fixtureId === "target_unavailable") {
    return {
      timeline: [],
      timelineState: {
        status: "unavailable",
        source: "canonical",
        reason: "audit_unavailable",
      },
    };
  }
  if (
    fixture.fixtureId === "waiting_customer" ||
    fixture.fixtureId === "completed_no_action"
  ) {
    return {
      timeline: [],
      timelineState: { status: "ready", source: "fixture" },
    };
  }
  const t = fixtureCopy[locale];
  return {
    timeline: [
      {
        actor: t.timelineActor,
        at: "14:00",
        id: `timeline:${fixture.case.id}`,
        kind:
          fixture.fixtureId === "overdue_unassigned"
            ? "assignment"
            : fixture.fixtureId === "executable_measurement_review"
              ? "measurement"
              : "automation",
        summary: t.timelineSummary,
        title: t.timelineTitle,
      },
    ],
    timelineState: { status: "ready", source: "fixture" },
  };
}

/**
 * Dev-evidence projection only. It deliberately adapts the stricter golden
 * matrix into the existing, final Case Workspace view without changing either
 * contract or introducing a canonical/Production read path.
 */
export function projectCaseWorkspaceGoldenVisualFixture(
  fixture: CaseWorkspaceGoldenFixture,
  locale: PanelLocale,
): AdminNextCaseWorkspaceView {
  validateCaseWorkspaceGoldenStateFixture(fixture);
  const t = fixtureCopy[locale];
  const action = fixture.primary.nextAction;
  const presentation = action.presentations[locale];
  const interactionNote =
    fixture.primary.blocker !== null
      ? t.blocked
      : action.interaction.mode === "read_only" &&
          action.interaction.reason === "capability_denied"
        ? t.capabilityDenied
        : action.interaction.mode === "read_only" &&
            action.interaction.reason === "target_unavailable"
          ? t.targetUnavailable
          : null;
  const isExecutable = action.interaction.mode === "executable";
  const ownerName = action.owner.id
    ? `${t.ownerParties[action.owner.party]} · ${action.owner.id}`
    : t.ownerMissing;
  const timeline = projectedTimeline(fixture, locale);

  return {
    reference: fixture.case.reference,
    customer: t.customer,
    address: t.address,
    service: t.service,
    status:
      fixture.status.caseState === "waiting"
        ? "waiting"
        : fixture.status.caseState === "complete"
          ? "on_track"
          : "attention",
    owner: { name: ownerName, team: t.team },
    sla: projectedSla(fixture, locale),
    nextAction: {
      kind: action.kind,
      title: presentation.copy.label,
      reason: interactionNote
        ? `${presentation.copy.reason} ${interactionNote}`
        : presentation.copy.reason,
      label: isExecutable ? presentation.copy.cta : null,
      href: isExecutable ? action.target?.href || null : null,
      processStage: presentation.processStage,
      requiredCapability: presentation.requiredCapability,
      reviewMode: presentation.reviewMode,
      interaction: action.interaction,
    },
    stages: fixture.stages.map(({ id, state }) => ({ id, state })),
    evidence: [
      {
        id: `evidence:${fixture.case.id}`,
        kind:
          action.target?.entity === "measurement"
            ? "measurement"
            : action.target?.entity === "quote" ||
                action.target?.entity === "contract"
              ? "document"
              : "communication",
        state:
          action.targetState === "unavailable"
            ? "missing"
            : action.interaction.mode === "executable"
              ? "review"
              : "verified",
        title: t.evidence,
        summary: t.evidenceSummary,
        metric: `r${fixture.version.caseRevision}`,
        recordedAt: "2026-09-04 14:00",
        fallbackHref: "/admin-v2/cases",
        previewHref: isExecutable ? action.target?.href : undefined,
        previewAction:
          isExecutable && action.target?.entity === "measurement"
            ? "review_measurement"
            : undefined,
      },
    ],
    timeline: timeline.timeline,
    timelineState: timeline.timelineState,
    fallback: {
      caseHref: "/admin-v2/cases",
      documentsHref: "/admin-v2/documents",
      workHref: "/admin-v2/work",
    },
  };
}
