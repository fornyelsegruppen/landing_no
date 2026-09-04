import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Hourglass,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import { getCaseNextActionPresentation } from "@/lib/admin-v2/case-next-action-presentation";
import {
  parseCanonicalWorkQueueQuery,
  type CanonicalWorkQueueQuery,
  type WorkQueueItem,
  type WorkQueuePage,
  type WorkQueueView,
} from "@/lib/admin-next/work-queue-contract";

type FilterOwner = { id: string; label: string };

const copy = {
  nb: {
    eyebrow: "F2 · felles arbeidskø",
    title: "Arbeidskø",
    intro:
      "Velg én sak, forstå hvorfor den ligger her, og åpne bare det eksakte arbeidsområdet.",
    preview: {
      canonical: "Beskyttet Preview · canonical data",
      fixture: "Beskyttet Preview · syntetiske data",
    },
    queueLabel: "Køvisning",
    queues: {
      all: "Alle",
      mine: "Mine",
      overdue: "Forsinket",
      waiting: "Venter",
      blocked: "Blokkert",
      unassigned: "Ufordelt",
    },
    filters: "Avgrens arbeidskøen",
    stage: "Prosessfase",
    action: "Neste handling",
    owner: "Ansvarlig",
    any: "Alle",
    apply: "Bruk filtre",
    reset: "Nullstill",
    results: "saker i gjeldende visning",
    pagination: "Sidenavigasjon for arbeidskøen",
    nextPage: "Neste side",
    previousPageBrowserBack:
      "Forrige side: bruk Tilbake-knappen i nettleseren.",
    endOfQueue: "Ingen flere saker i denne visningen.",
    masterTitle: "Prioritert liste",
    masterIntro: "Valget lagres i URL-en. Filterendringer nullstiller valget.",
    priority: {
      whyNow: "Hvorfor nå",
      dimensions: "Prioritetsdimensjoner",
      reasons: {
        ASSIGNMENT_REQUIRED: "Saken mangler ansvarlig.",
        COMMAND_RECOVERY_REQUIRED: "En mislykket kommando må følges opp.",
        DELIVERY_RECOVERY_REQUIRED: "En mislykket levering må følges opp.",
        DUE_TODAY: "Fristen er i dag.",
        FUTURE_ACTION: "Handlingen har en senere frist.",
        INTEGRITY_STOP: "En integritetskontroll stopper flyten.",
        LEGAL_STOP: "Et juridisk stopp må avklares.",
        NO_DUE_DATE: "Handlingen har ingen frist.",
        OVERDUE: "Fristen er passert.",
        SAFETY_STOP: "Et sikkerhetsstopp må avklares.",
        TRANSITION_BLOCKED: "Neste prosesstrinn er blokkert.",
        WAITING_NOT_DUE:
          "En annen part eier neste steg; vekketidspunktet er ikke nådd.",
        WAITING_WAKE_DUE: "Ventetiden er utløpt; saken må følges opp nå.",
      },
      sla: "Frist",
      slaValues: {
        overdue: "Passert",
        due_today: "I dag",
        future: "Senere",
        none: "Ingen",
      },
      assignment: "Eierskap",
      assigned: "Tildelt",
      unassigned: "Ufordelt",
      flow: "Flyt",
      blocked: "Blokkert",
      open: "Åpen",
      waiting: "Venter på",
      hardStop: "Stopp",
      recovery: "Gjenoppretting",
    },
    select: "Vis detaljer",
    detailTitle: "Saksdetalj",
    choose: "Velg en synlig sak fra listen for å se neste handling.",
    unavailable:
      "Det valgte saks-ID-et finnes ikke i denne filtrerte visningen. Ingen detalj eller handling vises.",
    states: {
      executable: "Klar til arbeid",
      waiting: "Venter",
      read_only: "Kun lesing",
    },
    stateDescriptions: {
      executable:
        "Køen utfører ingen endring. Fortsett til den eksakte arbeidsflaten for kontroll og handling.",
      waiting:
        "Neste steg eies av en annen part. Ingen handling tilbys i køen.",
      read_only: "Du kan se konteksten, men denne køen tilbyr ingen handling.",
    },
    openExact: "Åpne eksakt arbeidsflate",
    exactTarget: "Eksakt mål",
    caseRecoveryTarget: "Saksmål for trygg gjenoppretting",
    version: "Versjon",
    caseRevision: "Saksrevisjon",
    due: "Frist",
    wake: "Vekk køelementet",
    noDate: "Ingen dato",
    blockers: "Blokkeringer",
    noBlockers: "Ingen registrerte blokkeringer",
    sourcePolicy:
      "Preview-køen sender ingen kommandoer og gjør ingen endringer.",
    readOnlyReasons: {
      capability_denied: "Tilgangen tillater ikke denne handlingen.",
      diagnostic_blocker:
        "En lagret blokkering mangler en trygg canonical måltilordning.",
      no_action: "Saken krever ingen handling nå.",
      source_not_canonical: "Kilden er en kontrollert skyggeavlesning.",
      target_unavailable: "Et eksakt arbeidsmål er ikke tilgjengelig.",
    },
    parties: {
      administrator: "Administrator",
      customer: "Kunde",
      worker: "Medarbeider",
      system: "System",
      none: "Ingen",
      mixed: "Flere roller",
    },
    stages: {
      inquiry: "Henvendelse",
      evidence: "Grunnlag",
      commercial: "Tilbud",
      agreement: "Avtale",
      work: "Arbeid",
      completion: "Avslutning",
    },
  },
  lt: {
    eyebrow: "F2 · bendra darbo eilė",
    title: "Darbo eilė",
    intro:
      "Pasirinkite vieną bylą, supraskite jos prioritetą ir atverkite tik tikslinę darbo vietą.",
    preview: {
      canonical: "Apsaugota Preview · canonical duomenys",
      fixture: "Apsaugota Preview · sintetiniai duomenys",
    },
    queueLabel: "Eilės vaizdas",
    queues: {
      all: "Visos",
      mine: "Mano",
      overdue: "Vėluoja",
      waiting: "Laukia",
      blocked: "Užblokuota",
      unassigned: "Nepriskirta",
    },
    filters: "Susiaurinti darbo eilę",
    stage: "Proceso etapas",
    action: "Kitas veiksmas",
    owner: "Atsakingas",
    any: "Visi",
    apply: "Taikyti filtrus",
    reset: "Atstatyti",
    results: "bylos šiame vaizde",
    pagination: "Darbo eilės puslapių navigacija",
    nextPage: "Kitas puslapis",
    previousPageBrowserBack:
      "Ankstesnis puslapis: naudokite naršyklės mygtuką „Atgal“.",
    endOfQueue: "Šiame vaizde daugiau bylų nėra.",
    masterTitle: "Prioritetų sąrašas",
    masterIntro: "Pasirinkimas saugomas URL. Pakeitus filtrą jis atstatomas.",
    priority: {
      whyNow: "Kodėl dabar",
      dimensions: "Prioriteto dimensijos",
      reasons: {
        ASSIGNMENT_REQUIRED: "Bylai trūksta atsakingo asmens.",
        COMMAND_RECOVERY_REQUIRED: "Nepavykusią komandą reikia atkurti.",
        DELIVERY_RECOVERY_REQUIRED: "Nepavykusį pristatymą reikia atkurti.",
        DUE_TODAY: "Terminas yra šiandien.",
        FUTURE_ACTION: "Veiksmo terminas yra vėliau.",
        INTEGRITY_STOP: "Procesą stabdo vientisumo patikra.",
        LEGAL_STOP: "Reikia išspręsti teisinį stabdį.",
        NO_DUE_DATE: "Veiksmas neturi termino.",
        OVERDUE: "Terminas jau praėjo.",
        SAFETY_STOP: "Reikia išspręsti saugos stabdį.",
        TRANSITION_BLOCKED: "Kitas proceso perėjimas užblokuotas.",
        WAITING_NOT_DUE:
          "Kitas žingsnis priklauso kitai šaliai; grįžimo laikas dar neatėjo.",
        WAITING_WAKE_DUE: "Laukimo laikas baigėsi; bylą reikia tęsti dabar.",
      },
      sla: "Terminas",
      slaValues: {
        overdue: "Praėjęs",
        due_today: "Šiandien",
        future: "Vėliau",
        none: "Nėra",
      },
      assignment: "Atsakomybė",
      assigned: "Priskirta",
      unassigned: "Nepriskirta",
      flow: "Proceso eiga",
      blocked: "Užblokuota",
      open: "Atvira",
      waiting: "Laukiama",
      hardStop: "Stabdis",
      recovery: "Atkūrimas",
    },
    select: "Rodyti detales",
    detailTitle: "Bylos detalė",
    choose: "Pasirinkite matomą bylą iš sąrašo, kad matytumėte kitą veiksmą.",
    unavailable:
      "Pasirinkto bylos ID šiame filtruotame vaizde nėra. Detalė ir veiksmas nerodomi.",
    states: {
      executable: "Paruošta vykdyti",
      waiting: "Laukiama",
      read_only: "Tik skaityti",
    },
    stateDescriptions: {
      executable:
        "Eilė nieko nekeičia. Tęskite tikslinėje darbo vietoje, kur veiksmą galėsite patikrinti.",
      waiting:
        "Kitas žingsnis priklauso kitai šaliai. Eilėje veiksmas nesiūlomas.",
      read_only: "Kontekstą galite peržiūrėti, tačiau ši eilė veiksmo nesiūlo.",
    },
    openExact: "Atidaryti tikslinę darbo vietą",
    exactTarget: "Tikslinis objektas",
    caseRecoveryTarget: "Byla saugiam grįžimui",
    version: "Versija",
    caseRevision: "Bylos revizija",
    due: "Terminas",
    wake: "Grąžinti į eilę",
    noDate: "Datos nėra",
    blockers: "Blokavimai",
    noBlockers: "Registruotų blokavimų nėra",
    sourcePolicy: "Preview eilė nesiunčia komandų ir nekeičia duomenų.",
    readOnlyReasons: {
      capability_denied: "Turima prieiga neleidžia atlikti šio veiksmo.",
      diagnostic_blocker:
        "Išsaugotam blokavimui nėra saugiai susieto canonical tikslo.",
      no_action: "Šiuo metu bylai veiksmo nereikia.",
      source_not_canonical: "Šaltinis yra kontroliuojamas šešėlinis skaitymas.",
      target_unavailable: "Tikslinė darbo vieta nepasiekiama.",
    },
    parties: {
      administrator: "Administratorius",
      customer: "Klientas",
      worker: "Darbuotojas",
      system: "Sistema",
      none: "Niekas",
      mixed: "Keli vaidmenys",
    },
    stages: {
      inquiry: "Užklausa",
      evidence: "Duomenys",
      commercial: "Pasiūlymas",
      agreement: "Sutartis",
      work: "Darbai",
      completion: "Užbaigimas",
    },
  },
  en: {
    eyebrow: "F2 · unified work queue",
    title: "Work queue",
    intro:
      "Select one case, understand its priority, and open only the exact workbench.",
    preview: {
      canonical: "Protected Preview · canonical data",
      fixture: "Protected Preview · synthetic data",
    },
    queueLabel: "Queue view",
    queues: {
      all: "All",
      mine: "Mine",
      overdue: "Overdue",
      waiting: "Waiting",
      blocked: "Blocked",
      unassigned: "Unassigned",
    },
    filters: "Narrow the work queue",
    stage: "Process stage",
    action: "Next action",
    owner: "Owner",
    any: "All",
    apply: "Apply filters",
    reset: "Reset",
    results: "cases in this view",
    pagination: "Work Queue page navigation",
    nextPage: "Next page",
    previousPageBrowserBack: "Previous page: use your browser’s Back button.",
    endOfQueue: "No more cases in this view.",
    masterTitle: "Priority list",
    masterIntro: "Selection is stored in the URL. Changing filters resets it.",
    priority: {
      whyNow: "Why now",
      dimensions: "Priority dimensions",
      reasons: {
        ASSIGNMENT_REQUIRED: "The case has no assigned owner.",
        COMMAND_RECOVERY_REQUIRED: "A failed command requires recovery.",
        DELIVERY_RECOVERY_REQUIRED: "A failed delivery requires recovery.",
        DUE_TODAY: "The deadline is today.",
        FUTURE_ACTION: "The action has a later deadline.",
        INTEGRITY_STOP: "An integrity check stops the flow.",
        LEGAL_STOP: "A legal stop must be resolved.",
        NO_DUE_DATE: "The action has no deadline.",
        OVERDUE: "The deadline has passed.",
        SAFETY_STOP: "A safety stop must be resolved.",
        TRANSITION_BLOCKED: "The next process transition is blocked.",
        WAITING_NOT_DUE:
          "Another party owns the next step; its wake time has not arrived.",
        WAITING_WAKE_DUE: "The wait has expired; follow up now.",
      },
      sla: "Deadline",
      slaValues: {
        overdue: "Overdue",
        due_today: "Today",
        future: "Later",
        none: "None",
      },
      assignment: "Ownership",
      assigned: "Assigned",
      unassigned: "Unassigned",
      flow: "Process flow",
      blocked: "Blocked",
      open: "Open",
      waiting: "Waiting for",
      hardStop: "Stop",
      recovery: "Recovery",
    },
    select: "Show details",
    detailTitle: "Case detail",
    choose: "Select a visible case from the list to inspect its next action.",
    unavailable:
      "The selected case ID is not present in this filtered view. No detail or action is shown.",
    states: {
      executable: "Ready to work",
      waiting: "Waiting",
      read_only: "Read only",
    },
    stateDescriptions: {
      executable:
        "The queue performs no change. Continue to the exact workbench to review and act.",
      waiting: "Another party owns the next step. The queue offers no action.",
      read_only:
        "You can inspect the context, but this queue offers no action.",
    },
    openExact: "Open exact workbench",
    exactTarget: "Exact target",
    caseRecoveryTarget: "Case recovery target",
    version: "Version",
    caseRevision: "Case revision",
    due: "Due",
    wake: "Return to queue",
    noDate: "No date",
    blockers: "Blockers",
    noBlockers: "No recorded blockers",
    sourcePolicy: "The Preview queue sends no commands and changes no data.",
    readOnlyReasons: {
      capability_denied: "Your access does not allow this action.",
      diagnostic_blocker:
        "The stored blocker has no safely mapped canonical target.",
      no_action: "The case requires no action now.",
      source_not_canonical: "The source is a controlled shadow read.",
      target_unavailable: "An exact work target is unavailable.",
    },
    parties: {
      administrator: "Administrator",
      customer: "Customer",
      worker: "Worker",
      system: "System",
      none: "None",
      mixed: "Multiple roles",
    },
    stages: {
      inquiry: "Inquiry",
      evidence: "Evidence",
      commercial: "Commercial",
      agreement: "Agreement",
      work: "Work",
      completion: "Completion",
    },
  },
} as const;

const queueViews = [
  "all",
  "mine",
  "overdue",
  "waiting",
  "blocked",
  "unassigned",
] as const satisfies readonly WorkQueueView[];

const stateStyle = {
  executable:
    "border-[var(--an-action)] bg-[var(--an-action-soft)] text-[var(--an-action)]",
  waiting:
    "border-[var(--an-info)] bg-[var(--an-info-soft)] text-[var(--an-info)]",
  read_only:
    "border-[var(--an-border-strong)] bg-[var(--an-surface-soft)] text-[var(--an-text-muted)]",
} as const;

function queryParams(query: CanonicalWorkQueueQuery) {
  const params = new URLSearchParams();
  params.set("view", "today");
  params.set("queue", query.queue);
  if (query.processStage) params.set("stage", query.processStage);
  if (query.actionKind) params.set("action", query.actionKind);
  if (query.ownerId) params.set("ownerId", query.ownerId);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit));
  return params;
}

export function parseAdminNextWorkQueueRouteState(
  input: Record<string, string | string[] | undefined>,
  ignoredUiKeys: readonly string[] = [],
) {
  const params = new URLSearchParams();
  const selectedValue = input.selected;
  const optionalKeys = new Set(["stage", "action", "ownerId", "cursor"]);
  let needsCanonicalRedirect = false;
  for (const [key, value] of Object.entries(input)) {
    if (
      key === "selected" ||
      ignoredUiKeys.includes(key) ||
      value === undefined
    )
      continue;
    if (typeof value === "string") {
      if (optionalKeys.has(key) && value === "") {
        needsCanonicalRedirect = true;
        continue;
      }
      params.append(key, value);
      continue;
    }
    for (const entry of value) params.append(key, entry);
  }
  const selectedCandidate =
    typeof selectedValue === "string" ? selectedValue : null;
  const selectedMatch = selectedCandidate
    ? /^case:([1-9]\d*)$/u.exec(selectedCandidate)
    : null;
  const selectedNumber = selectedMatch ? Number(selectedMatch[1]) : null;
  const selectedCaseId: string | null =
    selectedMatch &&
    selectedNumber !== null &&
    Number.isSafeInteger(selectedNumber) &&
    selectedCandidate
      ? selectedCandidate
      : null;
  if (selectedValue !== undefined && selectedCaseId === null) {
    needsCanonicalRedirect = true;
  }
  return {
    needsCanonicalRedirect,
    parsed: parseCanonicalWorkQueueQuery(params),
    selectedCaseId,
  };
}

export function adminNextWorkQueueHref({
  basePath,
  query,
  queue,
  selectedCaseId,
}: {
  basePath: string;
  query: CanonicalWorkQueueQuery;
  queue?: WorkQueueView;
  selectedCaseId?: string | null;
}) {
  const params = queryParams(query);
  if (queue) {
    params.set("queue", queue);
    params.delete("cursor");
  }
  if (selectedCaseId) params.set("selected", selectedCaseId);
  else params.delete("selected");
  return `${basePath}?${params.toString()}${selectedCaseId ? "#work-queue-detail" : ""}`;
}

/**
 * Cursor navigation is forward-only: the cursor stays opaque and previous-page
 * navigation intentionally belongs to browser history rather than a UI offset.
 */
export function adminNextWorkQueueNextPageHref({
  basePath,
  page,
}: {
  basePath: string;
  page: WorkQueuePage;
}) {
  if (!page.pageInfo.nextCursor) return null;
  return adminNextWorkQueueHref({
    basePath,
    query: { ...page.query, cursor: page.pageInfo.nextCursor },
    selectedCaseId: null,
  });
}

export function workQueueExactActionHref(item: WorkQueueItem) {
  return item.interaction.mode === "executable" &&
    item.interaction.activation.kind === "open_workbench"
    ? item.target.href
    : null;
}

export function workQueueFilterOptionsFromFacets(
  page: WorkQueuePage,
  locale: PanelLocale,
) {
  const actionKinds = new Set(
    page.facets.actionKinds.map(({ value }) => value),
  );
  const processStages = new Set(
    page.facets.processStages.map(({ value }) => value),
  );
  if (page.query.actionKind) actionKinds.add(page.query.actionKind);
  if (page.query.processStage) processStages.add(page.query.processStage);

  const owners = new Map(
    page.facets.owners.map(({ id, party }) => [
      id,
      `${copy[locale].parties[party]} · ${id}`,
    ]),
  );
  if (page.query.ownerId && !owners.has(page.query.ownerId)) {
    owners.set(page.query.ownerId, page.query.ownerId);
  }
  return {
    actionKinds: [...actionKinds].sort(),
    filterOwners: [...owners]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.id.localeCompare(right.id, "en")),
    processStages: [...processStages].sort(),
  };
}

function StateIcon({ mode }: { mode: WorkQueueItem["interaction"]["mode"] }) {
  if (mode === "executable")
    return <CheckCircle2 aria-hidden="true" className="size-4" />;
  if (mode === "waiting")
    return <Hourglass aria-hidden="true" className="size-4" />;
  return <Eye aria-hidden="true" className="size-4" />;
}

function formatDate(
  value: string | null,
  locale: PanelLocale,
  fallback: string,
) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(
    locale === "nb" ? "nb-NO" : locale === "lt" ? "lt-LT" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    },
  ).format(new Date(value));
}

function PriorityWhyNow({
  item,
  locale,
}: {
  item: WorkQueueItem;
  locale: PanelLocale;
}) {
  const t = copy[locale].priority;
  const dimensions: Array<{ label: string; value: string }> = [
    { label: t.sla, value: t.slaValues[item.priority.slaBand] },
    {
      label: t.assignment,
      value: item.priority.assignmentGap ? t.unassigned : t.assigned,
    },
    {
      label: t.flow,
      value: item.priority.transitionBlocked ? t.blocked : t.open,
    },
  ];
  if (item.priority.waitingParty) {
    dimensions.push({
      label: t.waiting,
      value: copy[locale].parties[item.priority.waitingParty],
    });
  }
  return (
    <section
      aria-label={`${t.whyNow}: ${t.reasons[item.priority.reasonCode]}`}
      className="mt-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-3"
      data-work-queue-priority={item.priority.reasonCode}
    >
      <p className="text-xs leading-relaxed text-[var(--an-text-muted)]">
        <strong className="text-[var(--an-action)]">{t.whyNow}:</strong>{" "}
        <span data-work-queue-priority-reason>
          {t.reasons[item.priority.reasonCode]}
        </span>
      </p>
      <dl
        aria-label={t.dimensions}
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--an-text-subtle)]"
        data-work-queue-priority-dimensions
      >
        {dimensions.map(({ label, value }) => (
          <div className="inline-flex gap-1" key={label}>
            <dt>{label}:</dt>
            <dd className="font-bold text-[var(--an-text-muted)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AdminNextWorkQueue({
  actionKinds,
  basePath = "/admin-next-preview/work",
  filterOwners,
  locale,
  page,
  processStages,
  selectedCaseId,
  source = "fixture",
}: {
  actionKinds: readonly WorkQueueItem["action"]["kind"][];
  basePath?: string;
  filterOwners: readonly FilterOwner[];
  locale: PanelLocale;
  page: WorkQueuePage;
  processStages: readonly WorkQueueItem["action"]["presentation"]["processStage"][];
  selectedCaseId?: string | null;
  source?: "canonical" | "fixture";
}) {
  const t = copy[locale];
  const selectedItem = selectedCaseId
    ? page.items.find((item) => item.case.id === selectedCaseId)
    : undefined;
  const invalidSelection = Boolean(selectedCaseId && !selectedItem);
  const nextPageHref = adminNextWorkQueueNextPageHref({ basePath, page });
  const showPagination = Boolean(page.query.cursor || nextPageHref);

  return (
    <div
      className="mx-auto max-w-[1500px] space-y-6"
      data-admin-next-section="work-queue"
    >
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold tracking-[.16em] text-[var(--an-action)] uppercase">
            {t.eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-.025em] text-[var(--an-text-primary)] sm:text-3xl">
            {t.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--an-text-muted)] sm:text-base">
            {t.intro}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--an-action)] bg-[var(--an-action-soft)] px-3 py-2 text-xs font-bold text-[var(--an-action)]">
          <ShieldCheck aria-hidden="true" className="size-4" />
          {t.preview[source]}
        </span>
      </section>

      <section
        aria-labelledby="work-queue-filters-title"
        className="rounded-2xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-4 sm:p-5"
      >
        <div className="flex items-center gap-2">
          <Filter
            aria-hidden="true"
            className="size-4 text-[var(--an-action)]"
          />
          <h2 className="text-sm font-bold" id="work-queue-filters-title">
            {t.filters}
          </h2>
        </div>
        <nav
          aria-label={t.queueLabel}
          className="mt-4 grid max-w-full grid-cols-3 gap-1 rounded-xl bg-[var(--an-surface-soft)] p-1 sm:flex sm:overflow-x-auto"
          data-work-queue-view-filter
        >
          {queueViews.map((queue) => (
            <Link
              aria-current={page.query.queue === queue ? "page" : undefined}
              className={`min-h-10 min-w-0 rounded-lg px-1.5 py-2 text-center text-[11px] leading-tight font-bold whitespace-normal transition sm:shrink-0 sm:px-3 sm:text-xs ${page.query.queue === queue ? "bg-[var(--an-action)] text-[var(--an-action-ink)]" : "text-[var(--an-text-muted)] hover:text-[var(--an-text-primary)]"}`}
              href={adminNextWorkQueueHref({
                basePath,
                query: page.query,
                queue,
                selectedCaseId: null,
              })}
              key={queue}
            >
              {t.queues[queue]}
            </Link>
          ))}
        </nav>
        <form
          action={basePath}
          className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto] xl:items-end"
          method="get"
        >
          <input name="view" type="hidden" value="today" />
          <input name="queue" type="hidden" value={page.query.queue} />
          <input name="limit" type="hidden" value={page.query.limit} />
          <label className="grid gap-1.5 text-xs font-bold text-[var(--an-text-muted)]">
            {t.stage}
            <select
              className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-raised)] px-3 text-sm text-[var(--an-text-primary)]"
              defaultValue={page.query.processStage || ""}
              name="stage"
            >
              <option value="">{t.any}</option>
              {processStages.map((stage) => (
                <option key={stage} value={stage}>
                  {t.stages[stage]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[var(--an-text-muted)]">
            {t.action}
            <select
              className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-raised)] px-3 text-sm text-[var(--an-text-primary)]"
              defaultValue={page.query.actionKind || ""}
              name="action"
            >
              <option value="">{t.any}</option>
              {actionKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {getCaseNextActionPresentation(kind, locale).copy.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[var(--an-text-muted)]">
            {t.owner}
            <select
              className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-raised)] px-3 text-sm text-[var(--an-text-primary)]"
              defaultValue={page.query.ownerId || ""}
              name="ownerId"
            >
              <option value="">{t.any}</option>
              {filterOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1 xl:flex-nowrap">
            <button
              className="min-h-11 flex-1 rounded-xl bg-[var(--an-action)] px-4 text-sm font-bold text-[var(--an-action-ink)] xl:flex-none"
              type="submit"
            >
              {t.apply}
            </button>
            <Link
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--an-border)] px-4 text-sm font-bold text-[var(--an-text-muted)] hover:text-[var(--an-text-primary)] xl:flex-none"
              href={`${basePath}?view=today&queue=all&limit=${page.query.limit}`}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              {t.reset}
            </Link>
          </div>
        </form>
      </section>

      <p aria-live="polite" className="text-sm text-[var(--an-text-muted)]">
        <strong className="text-[var(--an-text-primary)]">
          {page.totalItems}
        </strong>{" "}
        {t.results}
      </p>

      <div
        className="grid min-w-0 gap-5 xl:grid-cols-[minmax(320px,.82fr)_minmax(0,1.18fr)] xl:items-start"
        data-work-queue-layout
      >
        <section
          aria-labelledby="work-queue-master-title"
          className="min-w-0 overflow-hidden rounded-3xl border border-[var(--an-border)] bg-[var(--an-surface-base)]"
          data-work-queue-master
        >
          <header className="border-b border-[var(--an-border)] p-4 sm:p-5">
            <h2 className="text-lg font-bold" id="work-queue-master-title">
              {t.masterTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--an-text-muted)]">
              {t.masterIntro}
            </p>
          </header>
          {page.items.length ? (
            <ol className="divide-y divide-[var(--an-border)]">
              {page.items.map((item) => {
                const selected = item.case.id === selectedItem?.case.id;
                const mode = item.interaction.mode;
                return (
                  <li key={item.case.id}>
                    <article
                      className={`relative p-4 transition sm:p-5 ${selected ? "bg-[var(--an-action-soft)]" : "hover:bg-[var(--an-surface-soft)]"}`}
                      data-work-queue-item={item.case.id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${stateStyle[mode]}`}
                        >
                          <StateIcon mode={mode} />
                          {t.states[mode]}
                        </span>
                        <span className="text-xs font-bold text-[var(--an-text-subtle)]">
                          {item.case.reference}
                        </span>
                        <span className="text-xs text-[var(--an-text-subtle)]">
                          {t.stages[item.action.presentation.processStage]}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-[var(--an-text-primary)]">
                        {item.action.presentation.copy.label}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--an-text-muted)]">
                        {item.action.presentation.copy.reason}
                      </p>
                      <PriorityWhyNow item={item} locale={locale} />
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <span className="text-xs text-[var(--an-text-muted)]">
                          <UserRound
                            aria-hidden="true"
                            className="mr-1 inline size-3.5"
                          />
                          {t.parties[item.owner.party]}
                        </span>
                        <Link
                          aria-current={selected ? "true" : undefined}
                          aria-label={`${t.select}: ${item.action.presentation.copy.label}, ${item.case.reference}`}
                          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[var(--an-border-strong)] px-3 text-xs font-bold text-[var(--an-text-primary)] hover:border-[var(--an-action)] hover:text-[var(--an-action)]"
                          href={adminNextWorkQueueHref({
                            basePath,
                            query: page.query,
                            selectedCaseId: item.case.id,
                          })}
                        >
                          {t.select}
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="p-8 text-center text-sm text-[var(--an-text-muted)]">
              {t.choose}
            </p>
          )}
        </section>

        <section
          aria-labelledby="work-queue-detail-title"
          className="min-w-0 rounded-3xl border border-[var(--an-border)] bg-[var(--an-surface-raised)] p-4 shadow-[var(--an-shadow)] sm:p-6 xl:sticky xl:top-28"
          data-work-queue-detail={selectedItem?.case.id || "none"}
          id="work-queue-detail"
        >
          <h2 className="text-lg font-bold" id="work-queue-detail-title">
            {t.detailTitle}
          </h2>
          {!selectedItem ? (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm leading-relaxed ${invalidSelection ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]" : "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-muted)]"}`}
              data-work-queue-empty-detail
            >
              {invalidSelection ? t.unavailable : t.choose}
            </div>
          ) : (
            <WorkQueueDetail item={selectedItem} locale={locale} />
          )}
        </section>
      </div>

      {showPagination ? (
        <nav
          aria-label={t.pagination}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-4"
          data-work-queue-pagination
        >
          {page.query.cursor ? (
            <p
              className="text-sm text-[var(--an-text-muted)]"
              data-work-queue-browser-back-guidance
            >
              {t.previousPageBrowserBack}
            </p>
          ) : (
            <span aria-hidden="true" />
          )}
          {nextPageHref ? (
            <Link
              aria-label={t.nextPage}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--an-border-strong)] px-4 text-sm font-bold text-[var(--an-text-primary)] hover:border-[var(--an-action)] hover:text-[var(--an-action)]"
              data-work-queue-next-page
              href={nextPageHref}
            >
              {t.nextPage}
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <p
              aria-live="polite"
              className="text-sm text-[var(--an-text-muted)]"
              data-work-queue-end
            >
              {t.endOfQueue}
            </p>
          )}
        </nav>
      ) : null}
    </div>
  );

  function WorkQueueDetail({
    item,
    locale,
  }: {
    item: WorkQueueItem;
    locale: PanelLocale;
  }) {
    const mode = item.interaction.mode;
    const actionHref = workQueueExactActionHref(item);
    const relevantDate =
      mode === "waiting" ? item.timing.wakeAt : item.timing.dueAt;
    return (
      <div className="mt-4" data-work-queue-detail-content>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${stateStyle[mode]}`}
          >
            <StateIcon mode={mode} />
            {t.states[mode]}
          </span>
          <strong className="text-sm text-[var(--an-text-subtle)]">
            {item.case.reference}
          </strong>
        </div>
        <h3 className="mt-4 text-xl font-bold text-[var(--an-text-primary)] sm:text-2xl">
          {item.action.presentation.copy.label}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--an-text-muted)] sm:text-base">
          {item.action.presentation.copy.reason}
        </p>

        <div
          className={`mt-5 rounded-2xl border p-4 ${stateStyle[mode]}`}
          data-work-queue-interaction={mode}
        >
          <p className="flex items-center gap-2 font-bold">
            <StateIcon mode={mode} />
            {t.states[mode]}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {t.stateDescriptions[mode]}
          </p>
          {mode === "read_only" ? (
            <p className="mt-2 text-sm font-semibold">
              {t.readOnlyReasons[item.interaction.reason]}
            </p>
          ) : null}
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--an-surface-soft)] p-3">
            <dt className="text-xs font-bold text-[var(--an-text-subtle)]">
              {item.target.availability === "case_recovery"
                ? t.caseRecoveryTarget
                : t.exactTarget}
            </dt>
            <dd className="mt-1 font-semibold break-all text-[var(--an-text-primary)]">
              {item.target.entity} · {item.target.id}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--an-surface-soft)] p-3">
            <dt className="text-xs font-bold text-[var(--an-text-subtle)]">
              {t.version}
            </dt>
            <dd className="mt-1 font-semibold text-[var(--an-text-primary)]">
              {item.target.version || "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--an-surface-soft)] p-3">
            <dt className="text-xs font-bold text-[var(--an-text-subtle)]">
              {t.owner}
            </dt>
            <dd className="mt-1 font-semibold text-[var(--an-text-primary)]">
              {t.parties[item.owner.party]}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--an-surface-soft)] p-3">
            <dt className="text-xs font-bold text-[var(--an-text-subtle)]">
              {mode === "waiting" ? t.wake : t.due}
            </dt>
            <dd className="mt-1 font-semibold text-[var(--an-text-primary)]">
              <Clock3 aria-hidden="true" className="mr-1 inline size-4" />
              {formatDate(relevantDate, locale, t.noDate)}
            </dd>
          </div>
          <div className="rounded-xl bg-[var(--an-surface-soft)] p-3 sm:col-span-2">
            <dt className="text-xs font-bold text-[var(--an-text-subtle)]">
              {t.caseRevision}
            </dt>
            <dd className="mt-1 font-semibold text-[var(--an-text-primary)]">
              r{item.case.revision}
            </dd>
          </div>
        </dl>

        <section aria-labelledby="work-queue-blockers-title" className="mt-5">
          <h3 className="text-sm font-bold" id="work-queue-blockers-title">
            {t.blockers}
          </h3>
          {item.blockers.length ? (
            <ul className="mt-2 space-y-2">
              {item.blockers.map((blocker) => (
                <li
                  className="rounded-xl border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-3 text-sm text-[var(--an-danger)]"
                  key={`${blocker.code}-${blocker.source.id}`}
                >
                  <strong className="flex items-center gap-2">
                    <AlertTriangle aria-hidden="true" className="size-4" />
                    {blocker.code}
                  </strong>
                  <p className="mt-1 leading-relaxed">{blocker.resolution}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--an-text-muted)]">
              {t.noBlockers}
            </p>
          )}
        </section>

        {actionHref ? (
          <Link
            aria-label={`${t.openExact}: ${item.action.presentation.copy.label}, ${item.case.reference}`}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--an-action)] px-5 text-sm font-bold text-[var(--an-action-ink)] sm:w-auto"
            data-work-queue-action="exact-deep-link"
            href={actionHref}
          >
            {t.openExact}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
        <p className="mt-4 text-xs leading-relaxed text-[var(--an-text-subtle)]">
          {t.sourcePolicy}
        </p>
      </div>
    );
  }
}
