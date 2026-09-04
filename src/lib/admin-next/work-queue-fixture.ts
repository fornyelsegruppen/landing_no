import type { PanelLocale } from "@/lib/panel-i18n";
import type { AdminCaseListItem } from "@/lib/admin-v2/case-list";
import type { CaseNextActionKind } from "@/lib/admin-v2/case-read-model";
import type { CaseNextActionProcessStage } from "@/lib/admin-v2/case-next-action-presentation";
import type {
  CanonicalWorkQueueQuery,
  WorkQueuePage,
} from "./work-queue-contract";
import {
  projectAdminCaseListWorkQueue,
  type AdminCaseListWorkQueueRow,
} from "./work-queue-read-adapter";

export const adminNextWorkQueueFixtureNow = new Date(
  "2026-09-04T10:00:00.000Z",
);

export const adminNextWorkQueueFixtureActionKinds = [
  "generate_reply",
  "assign_worker",
  "wait_customer",
  "calculate_price",
] as const satisfies readonly CaseNextActionKind[];

export const adminNextWorkQueueFixtureStages = [
  "inquiry",
  "evidence",
  "commercial",
  "agreement",
  "work",
  "completion",
] as const satisfies readonly CaseNextActionProcessStage[];

export const adminNextWorkQueueFixtureOwners = [
  { id: "admin:demo", label: "Marius" },
  { id: "customer:1031", label: "Kari Nilsen" },
] as const;

const blockerResolution: Record<PanelLocale, string> = {
  nb: "Kontroller målegrunnlaget før prisberegningen kan åpnes.",
  lt: "Patikrinkite matavimo pagrindą prieš atverdami kainos skaičiavimą.",
  en: "Review the measurement evidence before opening price calculation.",
};

function caseItem(
  id: number,
  input: {
    customer: string;
    dueAt?: string;
    href: string;
    nextAction: CaseNextActionKind;
    postalAddress: string;
    revision: number;
  },
): AdminCaseListItem {
  return {
    customer: input.customer,
    dueAt: input.dueAt,
    href: input.href,
    id,
    nextAction: input.nextAction,
    nextActionBlockers: [],
    overdue: Boolean(
      input.dueAt &&
      Date.parse(input.dueAt) <= adminNextWorkQueueFixtureNow.getTime(),
    ),
    postalAddress: input.postalAddress,
    recordState: "active",
    revision: input.revision,
  };
}

function fixtureRows(
  locale: PanelLocale,
): readonly AdminCaseListWorkQueueRow[] {
  return [
    {
      item: caseItem(1042, {
        customer: "Kari Nilsen",
        dueAt: "2026-09-04T08:30:00.000Z",
        href: "/admin-next-preview/cases/TF-1042",
        nextAction: "generate_reply",
        postalAddress: "Testveien 12, Oslo",
        revision: 12,
      }),
      caseRevision: 12,
      ownerId: "admin:demo",
      blockers: [],
      capabilityGranted: true,
    },
    {
      item: caseItem(1038, {
        customer: "Henrik Solberg",
        dueAt: "2026-09-04T13:00:00.000Z",
        href: "/admin-next-preview/cases/1038",
        nextAction: "assign_worker",
        postalAddress: "Eksempelveien 8, Bærum",
        revision: 7,
      }),
      caseRevision: 7,
      ownerId: "admin:demo",
      blockers: [],
      capabilityGranted: false,
      exactTargetAvailable: false,
    },
    {
      item: caseItem(1031, {
        customer: "Ingrid Dahl",
        href: "/admin-next-preview/cases/1031",
        nextAction: "wait_customer",
        postalAddress: "Prøvegata 24, Lillestrøm",
        revision: 5,
      }),
      caseRevision: 5,
      ownerId: "customer:1031",
      blockers: [],
      capabilityGranted: true,
      exactTargetAvailable: false,
      wakeAt: "2026-09-06T08:00:00.000Z",
    },
    {
      item: caseItem(1027, {
        customer: "Ola Berg",
        dueAt: "2026-09-05T11:00:00.000Z",
        href: "/admin-next-preview/cases/1027",
        nextAction: "calculate_price",
        postalAddress: "Mønsterveien 5, Asker",
        revision: 9,
      }),
      caseRevision: 9,
      ownerId: "admin:demo",
      blockers: [
        {
          code: "MEASUREMENT_EVIDENCE_INCOMPLETE",
          owner: { id: "admin:demo", party: "administrator" },
          resolution: blockerResolution[locale],
          source: { id: "measurement:1027", type: "measurement" },
        },
      ],
      capabilityGranted: false,
      exactTargetAvailable: false,
      prioritySignals: { transitionBlocked: true },
    },
  ];
}

export function createAdminNextWorkQueueFixture(
  locale: PanelLocale,
  query: CanonicalWorkQueueQuery,
): WorkQueuePage {
  return projectAdminCaseListWorkQueue({
    currentUserId: "admin:demo",
    locale,
    now: adminNextWorkQueueFixtureNow,
    query,
    rows: fixtureRows(locale),
    sourceKind: "shadow_read",
  });
}
