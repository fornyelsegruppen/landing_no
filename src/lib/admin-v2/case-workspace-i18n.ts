import type { CustomerQuestionReplyStage } from "@/lib/messages/customer-question-state";
import { panelLocales, type PanelLocale } from "@/lib/panel-i18n";
import { getAdminCaseCopy } from "./case-i18n";
import type {
  CaseProcessStageId,
  CaseProcessStageState,
} from "./case-process-stages";
import type { CaseNextActionKind } from "./case-read-model";
import type { CaseWorkspaceSectionKey } from "./case-workspace-sections";

export type CaseWorkspaceQuestionRecovery =
  "source_changed" | "safety_rejected" | "stale_revision" | "ai_unavailable";

export type CaseWorkspaceQuestionPresentation =
  CustomerQuestionReplyStage | CaseWorkspaceQuestionRecovery;

export type CaseWorkspaceProcessStage = CaseProcessStageId;

export type CaseWorkspaceStatusKey =
  | "action"
  | "archived"
  | "attention"
  | "blocked"
  | "cancellation"
  | "declined"
  | "idle"
  | "trashed"
  | "waiting";

export type CaseWorkspaceHelpKey =
  | "action"
  | "archived"
  | "attention"
  | "blocked"
  | "cancellation"
  | "declined"
  | "idle"
  | "trashed"
  | "waiting";

export type CaseWorkspaceEvidenceKey =
  "document" | "message" | "receivedAt" | "target";

export type CaseWorkspaceBlockerKey =
  | "archived"
  | "communication"
  | "customerCancellation"
  | "customerQuestion"
  | "declined"
  | "trashed"
  | "work";

type CaseWorkspaceQuestionCopy = {
  help: string;
  status: string;
  title: string;
};

type CaseWorkspaceProcessCopy = {
  closeInspector: string;
  closeStage: string;
  details: string;
  discardChanges: string;
  help: string;
  history: string;
  historyHelp: string;
  inspectorHelp: string;
  openInspector: string;
  openStage: string;
  waitForAction: string;
  states: Record<CaseProcessStageState, string>;
  title: string;
};

export type CaseWorkspaceCopy = {
  actions: Record<CaseNextActionKind, string>;
  blockers: Record<CaseWorkspaceBlockerKey, string>;
  evidence: Record<CaseWorkspaceEvidenceKey, string>;
  help: Record<CaseWorkspaceHelpKey, string>;
  process: CaseWorkspaceProcessCopy;
  questions: Record<
    CaseWorkspaceQuestionPresentation,
    CaseWorkspaceQuestionCopy
  >;
  sections: Record<CaseWorkspaceSectionKey, string>;
  stages: Record<CaseWorkspaceProcessStage, string>;
  statuses: Record<CaseWorkspaceStatusKey, string>;
};

const nb = {
  actions: getAdminCaseCopy("nb").actionLabels,
  blockers: {
    archived: "Saken er arkivert",
    communication: "En melding krever oppfølging",
    customerCancellation:
      "Kunden har sendt en endrings- eller kanselleringsforespørsel",
    customerQuestion: "Kundens spørsmål stopper signeringen",
    declined: "Kunden har avslått tilbudet",
    trashed: "Saken ligger i papirkurven",
    work: "Arbeidet er stoppet",
  },
  evidence: {
    document: "Dokument",
    message: "Melding",
    receivedAt: "Mottatt",
    target: "Gjelder",
  },
  help: {
    action: "Fullfør dette som sakens eneste primære handling.",
    archived:
      "Vanlige sakshandlinger er låst. Bruk livssykluskontrollen hvis saken skal gjenopprettes.",
    attention: "Kontroller feilen før den trygge oppfølgingen fortsetter.",
    blocked: "Arbeidet kan ikke fortsette før blokkeringen er vurdert.",
    cancellation: "Vurder kundens forespørsel før andre oppgaver fortsetter.",
    declined:
      "Tilbudet kan ikke lenger signeres. Følg opp kunden eller arkiver saken som avslått.",
    idle: "Ingen primær handling er nødvendig akkurat nå.",
    trashed: "Saken er skrivebeskyttet mens den ligger i papirkurven.",
    waiting: "Statusen er ikke et bekreftet sluttresultat ennå.",
  },
  process: {
    title: "Saksprosess",
    help: "De seks hovedfasene i saken og hvor den står nå.",
    closeInspector: "Lukk detaljene",
    closeStage: "Skjul informasjon",
    details: "Saksdetaljer",
    discardChanges: "Du har ulagrede endringer. Vil du lukke og forkaste dem?",
    history: "Hele historikken",
    historyHelp: "Vis kronologisk handlings- og hendelseshistorikk",
    inspectorHelp:
      "Detaljene åpnes uten at du mister plasseringen din i saken.",
    openInspector: "Vis alle detaljer",
    openStage: "Vis informasjon",
    waitForAction: "Vent til handlingen er ferdig før du lukker detaljene.",
    states: {
      not_started: "Ikke startet",
      current: "Nåværende fase",
      blocked: "Fasen er blokkert",
      completed: "Fullført",
    },
  },
  questions: {
    prepare: {
      status: "Et svar må forberedes",
      title: "Svar på kundens spørsmål",
      help: "Velg AI-utkast eller skriv et manuelt svar i det eneste aktive spørsmålsområdet.",
    },
    review: {
      status: "Svarutkast klart",
      title: "Kontroller svaret før sending",
      help: "Kontroller fakta og send svaret fra det eneste aktive redigeringsområdet.",
    },
    queued: {
      status: "Svar i utsendingskø",
      title: "Svaret venter på sending",
      help: "Ikke send på nytt mens transporten behandler meldingen.",
    },
    sent: {
      status: "Sendt – venter på leveringsbekreftelse",
      title: "Leveringen er ikke bekreftet ennå",
      help: "Leverandøren har mottatt meldingen, men kunden kan ikke signere før levering er bekreftet.",
    },
    delivered: {
      status: "Svar bekreftet levert",
      title: "Kundens spørsmål er besvart",
      help: "Det leverte svaret er dokumentert og blokkerer ikke neste forretningshandling.",
    },
    delivery_failed: {
      status: "Levering mislyktes",
      title: "Gjenopprett leveringen av kundesvaret",
      help: "Kontroller den lokaliserte feilen og bruk bare den gyldige recovery-handlingen.",
    },
    source_changed: {
      status: "Kildene er endret – et nytt svar kreves",
      title: "Lag svaret på nytt fra gjeldende dokumenter",
      help: "Det gamle utkastet kan ikke sendes etter at dokumentgrunnlaget er endret.",
    },
    safety_rejected: {
      status: "Automatisk sikkerhetskontroll avviste teksten",
      title: "Kontroller og erstatt det avviste svaret",
      help: "Lag et nytt kontrollert AI-utkast eller skriv et manuelt svar.",
    },
    stale_revision: {
      status: "Saken eller meldingen er oppdatert",
      title: "Last inn gjeldende versjon før du fortsetter",
      help: "Kontroller den nyere versjonen. Ikke gjenta den gamle handlingen automatisk.",
    },
    ai_unavailable: {
      status: "AI-utkast er midlertidig utilgjengelig",
      title: "Svar manuelt eller prøv et nytt utkast senere",
      help: "Det manuelle svaralternativet er fortsatt tilgjengelig.",
    },
  },
  sections: {
    customer: "Kunde",
    measurement: "Takmåling",
    commercial: "Pris og tilbud",
    messages: "Kundemeldinger",
    contract: "Kontrakt",
    work: "Arbeid",
    changes: "Endringsavtaler",
    documents: "Dokumenter",
    history: "Full historikk",
  },
  stages: {
    contact: "Forespørsel og kontakt",
    measurement: "Måling",
    commercial: "Pris og tilbud",
    agreement: "Kundebeslutning og kontrakt",
    work: "Tildeling og utførelse",
    completion: "Ferdigstillelse, faktura og garanti",
  },
  statuses: {
    action: "Krever handling",
    archived: "Saken er arkivert",
    attention: "Krever oppmerksomhet",
    blocked: "Arbeidet er blokkert",
    cancellation: "Kanselleringsforespørsel må vurderes",
    declined: "Kunden avslo tilbudet",
    idle: "Ingen handling nødvendig nå",
    trashed: "Saken ligger i papirkurven",
    waiting: "Venter på neste bekreftede hendelse",
  },
} satisfies CaseWorkspaceCopy;

const lt = {
  actions: getAdminCaseCopy("lt").actionLabels,
  blockers: {
    archived: "Byla archyvuota",
    communication: "Reikia patikrinti žinutę",
    customerCancellation: "Klientas pateikė pakeitimo arba atšaukimo prašymą",
    customerQuestion: "Kliento klausimas stabdo pasirašymą",
    declined: "Klientas atsisakė pasiūlymo",
    trashed: "Byla perkelta į šiukšlinę",
    work: "Darbas sustabdytas",
  },
  evidence: {
    document: "Dokumentas",
    message: "Žinutė",
    receivedAt: "Gauta",
    target: "Susijęs objektas",
  },
  help: {
    action: "Atlikite šį vienintelį pagrindinį bylos veiksmą.",
    archived:
      "Įprasti bylos veiksmai užrakinti. Jei bylą reikia atkurti, naudokite jos gyvavimo ciklo valdymą.",
    attention: "Prieš tęsdami saugų procesą patikrinkite klaidą.",
    blocked:
      "Darbas negali būti tęsiamas, kol neįvertinta sustabdymo priežastis.",
    cancellation: "Prieš tęsdami kitus darbus įvertinkite kliento prašymą.",
    declined:
      "Pasiūlymo nebegalima pasirašyti. Susisiekite su klientu arba archyvuokite bylą kaip atsisakytą.",
    idle: "Šiuo metu pagrindinio veiksmo atlikti nereikia.",
    trashed: "Kol byla yra šiukšlinėje, ją galima tik peržiūrėti.",
    waiting: "Tai dar nėra patvirtintas galutinis rezultatas.",
  },
  process: {
    title: "Bylos procesas",
    help: "Šeši pagrindiniai bylos etapai ir dabartinė jos vieta.",
    closeInspector: "Uždaryti informaciją",
    closeStage: "Slėpti informaciją",
    details: "Bylos informacija",
    discardChanges: "Yra neišsaugotų pakeitimų. Uždaryti ir juos prarasti?",
    history: "Visa istorija",
    historyHelp: "Rodyti chronologinę veiksmų ir įvykių istoriją",
    inspectorHelp:
      "Informacija atidaroma neprarandant dabartinės vietos byloje.",
    openInspector: "Rodyti visą informaciją",
    openStage: "Rodyti informaciją",
    waitForAction: "Prieš uždarydami informaciją palaukite veiksmo pabaigos.",
    states: {
      not_started: "Nepradėta",
      current: "Dabartinis etapas",
      blocked: "Etapas užblokuotas",
      completed: "Užbaigta",
    },
  },
  questions: {
    prepare: {
      status: "Reikia parengti atsakymą",
      title: "Atsakyti į kliento klausimą",
      help: "Vienintelėje aktyvioje klausimo darbo vietoje pasirinkite DI juodraštį arba rankinį atsakymą.",
    },
    review: {
      status: "Atsakymo juodraštis parengtas",
      title: "Prieš siųsdami patikrinkite atsakymą",
      help: "Patikrinkite faktus ir siųskite atsakymą tik iš vienintelio aktyvaus redaktoriaus.",
    },
    queued: {
      status: "Atsakymas laukia siuntimo",
      title: "Atsakymas yra siuntimo eilėje",
      help: "Kol transportas apdoroja žinutę, pakartotinai jos nesiųskite.",
    },
    sent: {
      status: "Išsiųsta – laukiama pristatymo patvirtinimo",
      title: "Pristatymas dar nepatvirtintas",
      help: "Teikėjas priėmė žinutę, bet klientas negali pasirašyti, kol pristatymas nepatvirtintas.",
    },
    delivered: {
      status: "Patvirtinta, kad atsakymas pristatytas",
      title: "Į kliento klausimą atsakyta",
      help: "Pristatytas atsakymas užfiksuotas ir neblokuoja kito verslo veiksmo.",
    },
    delivery_failed: {
      status: "Pristatyti nepavyko",
      title: "Atkurti atsakymo pristatymą",
      help: "Patikrinkite lokalizuotą klaidą ir naudokite tik galiojantį atkūrimo veiksmą.",
    },
    source_changed: {
      status: "Šaltiniai pasikeitė – reikia naujo atsakymo",
      title: "Sukurti atsakymą iš naujo pagal galiojančius dokumentus",
      help: "Pasikeitus dokumentų pagrindui seno juodraščio siųsti negalima.",
    },
    safety_rejected: {
      status: "Automatinė patikra atmetė tekstą",
      title: "Patikrinti ir pakeisti atmestą atsakymą",
      help: "Sukurkite naują patikrintą DI juodraštį arba parašykite atsakymą patys.",
    },
    stale_revision: {
      status: "Byla arba žinutė atnaujinta",
      title: "Prieš tęsdami įkelkite galiojančią versiją",
      help: "Patikrinkite naujesnę versiją ir automatiškai nekartokite seno veiksmo.",
    },
    ai_unavailable: {
      status: "DI juodraštis laikinai nepasiekiamas",
      title: "Atsakykite patys arba naują juodraštį kurkite vėliau",
      help: "Rankinio atsakymo galimybė lieka pasiekiama.",
    },
  },
  sections: {
    customer: "Klientas",
    measurement: "Stogo matavimas",
    commercial: "Kaina ir pasiūlymas",
    messages: "Žinutės klientui",
    contract: "Sutartis",
    work: "Darbas",
    changes: "Pakeitimų susitarimai",
    documents: "Dokumentai",
    history: "Visa istorija",
  },
  stages: {
    contact: "Užklausa ir kontaktas",
    measurement: "Matavimas",
    commercial: "Kaina ir pasiūlymas",
    agreement: "Kliento sprendimas ir sutartis",
    work: "Darbo paskyrimas ir vykdymas",
    completion: "Užbaigimas, sąskaita ir garantija",
  },
  statuses: {
    action: "Reikia veiksmo",
    archived: "Byla archyvuota",
    attention: "Reikia dėmesio",
    blocked: "Darbas sustabdytas",
    cancellation: "Reikia įvertinti atšaukimo prašymą",
    declined: "Klientas atsisakė pasiūlymo",
    idle: "Dabar veiksmų nereikia",
    trashed: "Byla yra šiukšlinėje",
    waiting: "Laukiama kito patvirtinto įvykio",
  },
} satisfies CaseWorkspaceCopy;

const en = {
  actions: getAdminCaseCopy("en").actionLabels,
  blockers: {
    archived: "The case is archived",
    communication: "A message needs attention",
    customerCancellation:
      "The customer submitted a change or cancellation request",
    customerQuestion: "The customer's question blocks signing",
    declined: "The customer declined the quote",
    trashed: "The case is in the trash",
    work: "The work is stopped",
  },
  evidence: {
    document: "Document",
    message: "Message",
    receivedAt: "Received",
    target: "Applies to",
  },
  help: {
    action: "Complete this as the case's single primary action.",
    archived:
      "Normal case actions are locked. Use lifecycle controls if the case must be restored.",
    attention: "Review the failure before the safe workflow continues.",
    blocked: "Work cannot continue until the blocker has been reviewed.",
    cancellation:
      "Review the customer's request before any other work continues.",
    declined:
      "The quote can no longer be signed. Follow up with the customer or archive the case as declined.",
    idle: "No primary action is required right now.",
    trashed: "The case is read-only while it is in the trash.",
    waiting: "This is not a confirmed final result yet.",
  },
  process: {
    title: "Case process",
    help: "The six main case stages and its current position.",
    closeInspector: "Close details",
    closeStage: "Hide details",
    details: "Case details",
    discardChanges: "You have unsaved changes. Close and discard them?",
    history: "Full history",
    historyHelp: "Show the chronological action and event history",
    inspectorHelp:
      "Details open without losing your current position in the case.",
    openInspector: "Show all details",
    openStage: "Show details",
    waitForAction: "Wait for the action to finish before closing the details.",
    states: {
      not_started: "Not started",
      current: "Current stage",
      blocked: "Stage blocked",
      completed: "Completed",
    },
  },
  questions: {
    prepare: {
      status: "A reply must be prepared",
      title: "Reply to the customer's question",
      help: "Choose an AI draft or write a manual reply in the only active question workspace.",
    },
    review: {
      status: "Reply draft ready",
      title: "Review the reply before delivery",
      help: "Check the facts and send the reply only from the active editor.",
    },
    queued: {
      status: "Reply queued for delivery",
      title: "The reply is in the delivery queue",
      help: "Do not resend while transport is processing the message.",
    },
    sent: {
      status: "Sent – awaiting delivery confirmation",
      title: "Delivery is not confirmed yet",
      help: "The provider accepted the message, but the customer cannot sign until delivery is confirmed.",
    },
    delivered: {
      status: "Reply confirmed delivered",
      title: "The customer's question is resolved",
      help: "The delivered reply is recorded and no longer blocks the next business action.",
    },
    delivery_failed: {
      status: "Delivery failed",
      title: "Recover delivery of the customer reply",
      help: "Review the localized error and use only the valid recovery action.",
    },
    source_changed: {
      status: "Sources changed – a new reply is required",
      title: "Recreate the reply from the current documents",
      help: "The old draft cannot be sent after its document basis changes.",
    },
    safety_rejected: {
      status: "Automated safety check rejected the text",
      title: "Review and replace the rejected reply",
      help: "Create a new controlled AI draft or write a manual reply.",
    },
    stale_revision: {
      status: "The case or message was updated",
      title: "Load the current version before continuing",
      help: "Review the newer version. Do not automatically repeat the old action.",
    },
    ai_unavailable: {
      status: "AI drafting is temporarily unavailable",
      title: "Reply manually or create another draft later",
      help: "The manual reply option remains available.",
    },
  },
  sections: {
    customer: "Customer",
    measurement: "Roof measurement",
    commercial: "Price and quote",
    messages: "Customer messages",
    contract: "Contract",
    work: "Work",
    changes: "Change agreements",
    documents: "Documents",
    history: "Full history",
  },
  stages: {
    contact: "Enquiry and contact",
    measurement: "Measurement",
    commercial: "Price and quote",
    agreement: "Customer decision and contract",
    work: "Work assignment and execution",
    completion: "Completion, invoice and warranty",
  },
  statuses: {
    action: "Action required",
    archived: "Case archived",
    attention: "Needs attention",
    blocked: "Work blocked",
    cancellation: "Cancellation request requires review",
    declined: "Customer declined the quote",
    idle: "No action required now",
    trashed: "Case is in the trash",
    waiting: "Waiting for the next confirmed event",
  },
} satisfies CaseWorkspaceCopy;

export const caseWorkspaceCopies = {
  nb,
  lt,
  en,
} as const satisfies Record<PanelLocale, CaseWorkspaceCopy>;

export const caseWorkspaceCopyLocales = panelLocales;

export function getCaseWorkspaceCopy(locale: PanelLocale) {
  return caseWorkspaceCopies[locale];
}

export type CaseWorkspaceI18nKey =
  | `actions.${CaseNextActionKind}`
  | `blockers.${CaseWorkspaceBlockerKey}`
  | `evidence.${CaseWorkspaceEvidenceKey}`
  | `help.${CaseWorkspaceHelpKey}`
  | `process.${Exclude<keyof CaseWorkspaceProcessCopy, "states">}`
  | `process.states.${CaseProcessStageState}`
  | `questions.${CaseWorkspaceQuestionPresentation}.${keyof CaseWorkspaceQuestionCopy}`
  | `sections.${CaseWorkspaceSectionKey}`
  | `stages.${CaseWorkspaceProcessStage}`
  | `statuses.${CaseWorkspaceStatusKey}`;

function flattenCopy(
  value: Record<string, unknown>,
  prefix = "",
  result: Record<string, string> = {},
) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result[path] = child;
    else if (child && typeof child === "object") {
      flattenCopy(child as Record<string, unknown>, path, result);
    }
  }
  return result;
}

const flattenedCopies = Object.fromEntries(
  panelLocales.map((locale) => [
    locale,
    flattenCopy(
      caseWorkspaceCopies[locale] as unknown as Record<string, unknown>,
    ),
  ]),
) as Record<PanelLocale, Record<CaseWorkspaceI18nKey, string>>;

export function caseWorkspaceText(
  locale: PanelLocale,
  key: CaseWorkspaceI18nKey,
) {
  return flattenedCopies[locale][key];
}
