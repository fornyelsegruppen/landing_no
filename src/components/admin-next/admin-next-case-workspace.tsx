import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  FileCheck2,
  FileSignature,
  Files,
  FolderOpen,
  ImageIcon,
  Mail,
  MapPin,
  MessageCircleQuestion,
  MessageSquareText,
  Ruler,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type {
  AdminNextCaseStageId,
  AdminNextCaseStageState,
  AdminNextAuditTimelineDetails,
  AdminNextCaseWorkspaceView,
  AdminNextEvidenceKind,
  AdminNextEvidenceState,
  AdminNextTimelineKind,
} from "@/lib/admin-next/case-workspace-contract";
import { adminNextPreviewWorkQueueEntry } from "@/lib/admin-next/work-queue-navigation";
import {
  AdminNextCaseWorkspaceHistoryRail,
  AdminNextCaseWorkspacePanelSwitcher,
} from "./admin-next-case-workspace-navigation";
import { AdminNextCaseCommunications } from "./admin-next-case-communications";
import {
  BlockerSummary,
  DueIndicator,
  StatusBadge,
} from "./admin-status-primitives";

const copy = {
  nb: {
    back: "Tilbake til arbeidskøen",
    case: "Sak",
    synthetic: "Syntetiske testdata i Preview",
    canonical: "Direkte saksdata i Preview",
    regressionTestData: "Regresjonstestdata",
    attention: "Krever oppmerksomhet",
    on_track: "På plan",
    waiting: "Venter",
    owner: "Ansvarlig",
    sla: "SLA-frist",
    today: "I dag",
    yesterday: "I går",
    tomorrow: "I morgen",
    overdue: "Forsinket",
    hours: "t",
    minutes: "min",
    due_soon: "Forfaller snart",
    slaUnknown: "Ingen frist registrert",
    next: "Neste nødvendige handling",
    currentFallback: "Tilbake til arbeidskøen",
    interactionReasons: {
      capability_denied:
        "Handlingen er skrivebeskyttet uten bekreftet tilgang.",
      no_action: "Saken krever ingen handling nå.",
      target_unavailable: "Et eksakt operatørmål er ikke tilgjengelig.",
    },
    dataPrerequisite: "En registrert forutsetning må avklares.",
    process: "Saksforløp",
    processIntro: "Ett felles bilde av fremdrift og blokkeringer.",
    contextNavigation: "Navigasjon i saken",
    contextSummary: "Sammendrag",
    contextCustomerRecord: "Kundedialog",
    contextEvidence: "Dokumentasjon",
    contextHistory: "Historikk",
    historyToggle: "Vis eller skjul historikk",
    historyStates: {
      ready: "Hendelser tilgjengelige",
      empty: "Ingen hendelser",
      unavailable: "Midlertidig utilgjengelig",
      denied: "Ingen tilgang",
    },
    showProgress: "Vis hele forløpet",
    of: "av",
    evidence: "Dokumentasjon og bevis",
    evidenceIntro: "Alt som støtter neste beslutning, samlet på ett sted.",
    openEvidence: "Åpne i dagens løsning",
    evidenceUnavailable: "Ingen operatorflate",
    reviewMeasurement: "Kontroller R4",
    documentPreflight: "Kontroller pakke",
    customerRecord: "Kundedialog og avtalehistorikk",
    customerRecordIntro:
      "Meldinger, spørsmål, tilbud, kontrakter og dokumentversjoner i samme saksbilde.",
    communications: "Meldinger",
    communicationsEmpty: "Ingen kundemeldinger er registrert.",
    communicationAllLoaded: "Hele meldingshistorikken vises",
    communicationLoadFailed: "Eldre meldinger kunne ikke lastes. Prøv igjen.",
    communicationLoadingOlder: "Laster eldre meldinger",
    communicationShowOlder: "Vis eldre meldinger",
    questions: "Kundespørsmål",
    unresolvedQuestion: "Ett eller flere spørsmål venter på svar",
    questionsResolved: "Alle registrerte spørsmål er besvart",
    activeQuestion: "Kundespørsmål som krever handling",
    questionReceived: "Mottatt",
    relatedDocuments: "Gjelder dokument",
    replyPreview: "Svarutkast eller siste leveringsforsøk",
    noReply: "Det er ikke opprettet noe svar ennå.",
    openReplyWorkspace: "Åpne svararbeidsflate",
    questionReplyStages: {
      prepare: "Svar må forberedes",
      review: "Svarutkast klart for kontroll",
      queued: "Svar ligger i sendekø",
      sent: "Sendt, venter på levering",
      delivered: "Svar levert",
      delivery_failed: "Levering må følges opp",
    },
    inbound: "Fra kunden",
    outbound: "Til kunden",
    sentAt: "Sendt",
    deliveredAt: "Levert",
    replyTo: "Svar på melding",
    attachments: "Vedlegg",
    openThread: "Åpne tilknyttet oppføring",
    commercialVersions: "Tilbud og kontrakter",
    commercialVersionsEmpty: "Ingen tilbuds- eller kontraktsversjoner.",
    activeCommercialVersions: "Aktive versjoner",
    commercialStatuses: {
      draft: "Utkast",
      approved: "Godkjent",
      sent: "Sendt",
      viewed: "Åpnet av kunden",
      accepted: "Akseptert",
      issued: "Utstedt",
      signed: "Signert",
      declined: "Avslått",
      expired: "Utløpt",
      revoked: "Tilbakekalt",
      superseded: "Erstattet",
    },
    commercialRoles: {
      effective: "Gjeldende",
      working: "Under arbeid",
      historical: "Historisk",
    },
    quote: "Tilbud",
    contract: "Kontrakt",
    versionShort: "v",
    supersedes: "Erstatter",
    customerSigned: "Kunde signerte",
    companySigned: "Selskapet signerte",
    openPdf: "Åpne PDF",
    documentRegister: "Dokumentregister",
    documentRegisterEmpty: "Ingen dokumenter er registrert.",
    relatedTo: "Tilknyttet",
    businessHistory: "Full saksrekkefølge",
    businessHistoryIntro:
      "Forretningshendelser fra forespørsel til siste dokument- eller avtaleendring.",
    historyKinds: {
      change: "Endring",
      contract: "Avtale",
      contract_request: "Avtaleforespørsel",
      document: "Dokument",
      invoice: "Faktura",
      lead: "Forespørsel",
      measurement: "Måling",
      message: "Melding",
      price: "Prisberegning",
      quote: "Tilbud",
      warranty: "Garanti",
      work: "Arbeid",
    },
    historyStatuses: {
      accepted: "Akseptert",
      approved: "Godkjent",
      attention: "Må følges opp",
      delivered: "Levert",
      draft: "Utkast",
      failed: "Mislykket",
      new: "Ny",
      pending: "Venter",
      received: "Mottatt",
      sent: "Sendt",
      signed: "Signert",
    },
    otherHistoryKind: "Annen hendelse",
    otherHistoryStatus: "Annen status",
    openSource: "Åpne kilde",
    timeline: "Tidslinje",
    timelineIntro: "Registrerte sakshendelser med tidspunkt.",
    timelineEmpty: "Ingen revisjonshendelser er registrert for denne saken.",
    timelineUnavailable: "Revisjonshistorikken er midlertidig utilgjengelig.",
    timelineDenied: "Du har ikke tilgang til revisjonshistorikken.",
    changedFields: "Endrede felt",
    result: "Resultat",
    reason: "Årsak",
    version: "Versjon",
    sourceLabel: "Kilde",
    correlation: "Korrelasjon",
    hashStatus: "Hash-status",
    actorKinds: {
      user: "Bruker",
      system: "System",
      job: "Jobb",
      webhook: "Webhook",
      unknown: "Ukjent aktør",
    },
    changedFieldsStatuses: {
      absent: "Ikke registrert",
      projected: "Felt registrert",
      rejected: "Avvist av personvernfilteret",
    },
    hashStatuses: {
      not_recorded: "Ikke registrert",
      recorded_unverified: "Registrert, ikke verifisert",
      invalid: "Ugyldig",
    },
    tamperStatuses: { not_assessable: "Kan ikke vurderes" },
    fallbackTitle: "Flere saksverktøy",
    fallbackIntro:
      "Eksisterende dokument- og arbeidsruter beholdes som trygg reserve.",
    technicalDetails: "Tekniske detaljer",
    technicalIntro: "Rå systemverdier for feilsøking",
    sourceMode: "Datakildemodus",
    storedService: "Lagret tjenesteverdi",
    originalAddress: "Opprinnelig adresseverdi",
    nextActionKind: "Handlingstype",
    requiredCapability: "Påkrevd tilgang",
    reviewMode: "Kontrollmodus",
    blockerCode: "Blokkeringskode",
    rawKind: "Rå type",
    rawStatus: "Rå status",
    rawDirection: "Rå retning",
    rawChannel: "Rå kanal",
    rawCategory: "Rå meldingskategori",
    recordId: "Oppførings-ID",
    services: {
      Takfornyelse: "Takfornyelse",
      takvask_impregnering: "Takvask og impregnering",
    },
    otherService: "Annen takjeneste",
    messageChannels: { email: "E-post", phone: "Telefon", sms: "SMS" },
    customerPortal: "Kundeportal",
    messageCategories: {
      ai_reply: "Svarutkast",
      change_confirmation: "Endringsbekreftelse",
      completion: "Ferdigmelding",
      contract: "Avtale",
      customer_question: "Kundespørsmål",
      customer_reply: "Kundesvar",
      follow_up: "Oppfølging",
      information_request: "Forespørsel om informasjon",
      invoice: "Faktura",
      quote: "Tilbud",
      receipt: "Mottaksbekreftelse",
      reminder: "Påminnelse",
      schedule_confirmation: "Avtalebekreftelse",
    },
    messageStatuses: {
      approved: "Godkjent",
      attention: "Må følges opp",
      cancelled: "Forkastet",
      contacted: "Kontaktet",
      delivered: "Levert",
      draft: "Utkast",
      failed: "Mislykket",
      pending: "Venter",
      queued: "I kø",
      received: "Mottatt",
      sent: "Sendt",
    },
    otherMessageChannel: "Annen kanal",
    otherMessageCategory: "Annen meldingstype",
    otherMessageStatus: "Annen meldingsstatus",
    openDocuments: "Dokumenter",
    openWork: "Arbeidsplan",
    stages: {
      inquiry: "Forespørsel",
      evidence: "Dokumentasjon",
      commercial: "Kommersielt",
      agreement: "Avtale",
      work: "Arbeid",
      completion: "Sluttføring",
    },
    stageStates: {
      complete: "Fullført",
      current: "Nå",
      blocked: "Blokkert",
      upcoming: "Senere",
    },
    evidenceStates: {
      verified: "Bekreftet",
      review: "Må kontrolleres",
      missing: "Mangler",
    },
  },
  lt: {
    back: "Grįžti į darbų eilę",
    case: "Byla",
    synthetic: "Sintetiniai Preview bandymo duomenys",
    canonical: "Tiesioginiai Preview bylos duomenys",
    regressionTestData: "Regresijos bandymo duomenys",
    attention: "Reikia dėmesio",
    on_track: "Pagal planą",
    waiting: "Laukia",
    owner: "Atsakingas",
    sla: "SLA terminas",
    today: "Šiandien",
    yesterday: "Vakar",
    tomorrow: "Rytoj",
    overdue: "Vėluoja",
    hours: "val.",
    minutes: "min.",
    due_soon: "Terminas netrukus",
    slaUnknown: "Terminas neužregistruotas",
    next: "Kitas būtinas veiksmas",
    currentFallback: "Grįžti į darbų eilę",
    interactionReasons: {
      capability_denied: "Veiksmas tik skaitomas, kol nepatvirtinta prieiga.",
      no_action: "Šiuo metu bylai veiksmo nereikia.",
      target_unavailable: "Tikslinė operatoriaus darbo vieta nepasiekiama.",
    },
    dataPrerequisite: "Reikia išspręsti užregistruotą sąlygą.",
    process: "Bylos eiga",
    processIntro: "Vienas bendras eigos ir blokavimų vaizdas.",
    contextNavigation: "Navigacija byloje",
    contextSummary: "Santrauka",
    contextCustomerRecord: "Kliento dialogas",
    contextEvidence: "Įrodymai",
    contextHistory: "Istorija",
    historyToggle: "Rodyti arba slėpti istoriją",
    historyStates: {
      ready: "Įvykiai pasiekiami",
      empty: "Įvykių nėra",
      unavailable: "Laikinai nepasiekiama",
      denied: "Prieiga nesuteikta",
    },
    showProgress: "Rodyti visą eigą",
    of: "iš",
    evidence: "Dokumentai ir įrodymai",
    evidenceIntro: "Viskas, ko reikia kitam sprendimui, vienoje vietoje.",
    openEvidence: "Atidaryti dabartinėje sistemoje",
    evidenceUnavailable: "Operatoriaus darbo vietos nėra",
    reviewMeasurement: "Peržiūrėti R4",
    documentPreflight: "Tikrinti paketą",
    customerRecord: "Kliento dialogas ir sutarčių istorija",
    customerRecordIntro:
      "Žinutės, klausimai, pasiūlymai, sutartys ir dokumentų versijos vienoje byloje.",
    communications: "Žinutės",
    communicationsEmpty: "Kliento žinučių neužregistruota.",
    communicationAllLoaded: "Rodoma visa žinučių istorija",
    communicationLoadFailed:
      "Senesnių žinučių įkelti nepavyko. Bandykite dar kartą.",
    communicationLoadingOlder: "Įkeliamos senesnės žinutės",
    communicationShowOlder: "Rodyti ankstesnes žinutes",
    questions: "Kliento klausimai",
    unresolvedQuestion: "Vienas ar daugiau klausimų laukia atsakymo",
    questionsResolved: "Į visus užregistruotus klausimus atsakyta",
    activeQuestion: "Kliento klausimas, kuriam reikia veiksmo",
    questionReceived: "Gauta",
    relatedDocuments: "Susijęs dokumentas",
    replyPreview: "Atsakymo juodraštis arba paskutinis siuntimo bandymas",
    noReply: "Atsakymas dar nesukurtas.",
    openReplyWorkspace: "Atidaryti atsakymo darbo vietą",
    questionReplyStages: {
      prepare: "Reikia parengti atsakymą",
      review: "Atsakymo juodraštis parengtas peržiūrai",
      queued: "Atsakymas laukia siuntimo",
      sent: "Išsiųsta, laukiama pristatymo",
      delivered: "Atsakymas pristatytas",
      delivery_failed: "Reikia spręsti pristatymo klaidą",
    },
    inbound: "Nuo kliento",
    outbound: "Klientui",
    sentAt: "Išsiųsta",
    deliveredAt: "Pristatyta",
    replyTo: "Atsakymas į žinutę",
    attachments: "Priedai",
    openThread: "Atverti susijusį įrašą",
    commercialVersions: "Pasiūlymai ir sutartys",
    commercialVersionsEmpty: "Pasiūlymų ar sutarčių versijų nėra.",
    activeCommercialVersions: "Aktyvios versijos",
    commercialStatuses: {
      draft: "Juodraštis",
      approved: "Patvirtinta",
      sent: "Išsiųsta",
      viewed: "Klientas atidarė",
      accepted: "Priimta",
      issued: "Pateikta pasirašyti",
      signed: "Pasirašyta",
      declined: "Atmesta",
      expired: "Nebegalioja",
      revoked: "Atšaukta",
      superseded: "Pakeista nauja versija",
    },
    commercialRoles: {
      effective: "Galiojanti",
      working: "Rengiama",
      historical: "Istorinė",
    },
    quote: "Pasiūlymas",
    contract: "Sutartis",
    versionShort: "v",
    supersedes: "Pakeičia",
    customerSigned: "Klientas pasirašė",
    companySigned: "Įmonė pasirašė",
    openPdf: "Atidaryti PDF",
    documentRegister: "Dokumentų registras",
    documentRegisterEmpty: "Dokumentų neužregistruota.",
    relatedTo: "Susieta su",
    businessHistory: "Visa bylos chronologija",
    businessHistoryIntro:
      "Veiklos įvykiai nuo užklausos iki paskutinio dokumento ar sutarties pakeitimo.",
    historyKinds: {
      change: "Pakeitimas",
      contract: "Sutartis",
      contract_request: "Sutarties užklausa",
      document: "Dokumentas",
      invoice: "Sąskaita",
      lead: "Užklausa",
      measurement: "Matavimas",
      message: "Žinutė",
      price: "Kainos skaičiavimas",
      quote: "Pasiūlymas",
      warranty: "Garantija",
      work: "Darbai",
    },
    historyStatuses: {
      accepted: "Priimta",
      approved: "Patvirtinta",
      attention: "Reikia dėmesio",
      delivered: "Pristatyta",
      draft: "Juodraštis",
      failed: "Nepavyko",
      new: "Nauja",
      pending: "Laukiama",
      received: "Gauta",
      sent: "Išsiųsta",
      signed: "Pasirašyta",
    },
    otherHistoryKind: "Kitas įvykis",
    otherHistoryStatus: "Kita būsena",
    openSource: "Atidaryti šaltinį",
    timeline: "Įvykių seka",
    timelineIntro: "Užregistruoti bylos įvykiai ir jų laikas.",
    timelineEmpty: "Šiai bylai audito įvykių neužregistruota.",
    timelineUnavailable: "Audito istorija laikinai nepasiekiama.",
    timelineDenied: "Neturite teisės peržiūrėti audito istorijos.",
    changedFields: "Pakeisti laukai",
    result: "Rezultatas",
    reason: "Priežastis",
    version: "Versija",
    sourceLabel: "Šaltinis",
    correlation: "Koreliacija",
    hashStatus: "Hash būsena",
    actorKinds: {
      user: "Naudotojas",
      system: "Sistema",
      job: "Užduotis",
      webhook: "Webhook",
      unknown: "Nežinomas veikėjas",
    },
    changedFieldsStatuses: {
      absent: "Neužregistruota",
      projected: "Laukai pateikti",
      rejected: "Atmesta privatumo filtro",
    },
    hashStatuses: {
      not_recorded: "Neužregistruota",
      recorded_unverified: "Užregistruota, nepatikrinta",
      invalid: "Netinkama",
    },
    tamperStatuses: { not_assessable: "Neįmanoma įvertinti" },
    fallbackTitle: "Papildomi bylos įrankiai",
    fallbackIntro:
      "Esami dokumentų ir darbų maršrutai palikti saugiam grįžimui.",
    technicalDetails: "Techninės detalės",
    technicalIntro: "Neapdorotos sistemos reikšmės diagnostikai",
    sourceMode: "Duomenų šaltinio režimas",
    storedService: "Išsaugota paslaugos reikšmė",
    originalAddress: "Pradinė adreso reikšmė",
    nextActionKind: "Veiksmo tipas",
    requiredCapability: "Reikalinga prieiga",
    reviewMode: "Peržiūros režimas",
    blockerCode: "Blokavimo kodas",
    rawKind: "Neapdorotas tipas",
    rawStatus: "Neapdorota būsena",
    rawDirection: "Neapdorota kryptis",
    rawChannel: "Neapdorotas kanalas",
    rawCategory: "Neapdorota žinutės kategorija",
    recordId: "Įrašo ID",
    services: {
      Takfornyelse: "Stogo atnaujinimas",
      takvask_impregnering: "Stogo plovimas ir impregnavimas",
    },
    otherService: "Kita stogo paslauga",
    messageChannels: { email: "El. paštas", phone: "Telefonas", sms: "SMS" },
    customerPortal: "Klientų portalas",
    messageCategories: {
      ai_reply: "Atsakymo juodraštis",
      change_confirmation: "Pakeitimo patvirtinimas",
      completion: "Darbų užbaigimas",
      contract: "Sutartis",
      customer_question: "Kliento klausimas",
      customer_reply: "Kliento atsakymas",
      follow_up: "Tolesnis susisiekimas",
      information_request: "Informacijos užklausa",
      invoice: "Sąskaita",
      quote: "Pasiūlymas",
      receipt: "Gavimo patvirtinimas",
      reminder: "Priminimas",
      schedule_confirmation: "Laiko patvirtinimas",
    },
    messageStatuses: {
      approved: "Patvirtinta",
      attention: "Reikia dėmesio",
      cancelled: "Atšaukta",
      contacted: "Susisiekta",
      delivered: "Pristatyta",
      draft: "Juodraštis",
      failed: "Nepavyko",
      pending: "Laukiama",
      queued: "Eilėje",
      received: "Gauta",
      sent: "Išsiųsta",
    },
    otherMessageChannel: "Kitas kanalas",
    otherMessageCategory: "Kita žinutės rūšis",
    otherMessageStatus: "Kita žinutės būsena",
    openDocuments: "Dokumentai",
    openWork: "Darbų planas",
    stages: {
      inquiry: "Užklausa",
      evidence: "Įrodymai",
      commercial: "Komercija",
      agreement: "Susitarimas",
      work: "Darbai",
      completion: "Užbaigimas",
    },
    stageStates: {
      complete: "Baigta",
      current: "Dabar",
      blocked: "Blokuota",
      upcoming: "Vėliau",
    },
    evidenceStates: {
      verified: "Patvirtinta",
      review: "Reikia peržiūros",
      missing: "Trūksta",
    },
  },
  en: {
    back: "Back to Work Queue",
    case: "Case",
    synthetic: "Synthetic Preview test data",
    canonical: "Live Preview case data",
    regressionTestData: "Regression test data",
    attention: "Needs attention",
    on_track: "On track",
    waiting: "Waiting",
    owner: "Owner",
    sla: "SLA deadline",
    today: "Today",
    yesterday: "Yesterday",
    tomorrow: "Tomorrow",
    overdue: "Overdue",
    hours: "h",
    minutes: "min",
    due_soon: "Due soon",
    slaUnknown: "No deadline recorded",
    next: "Next required action",
    currentFallback: "Back to Work Queue",
    interactionReasons: {
      capability_denied: "The action is read-only without confirmed access.",
      no_action: "The case requires no action now.",
      target_unavailable: "An exact operator target is unavailable.",
    },
    dataPrerequisite: "A recorded prerequisite must be resolved.",
    process: "Case progress",
    processIntro: "One shared view of progress and blockers.",
    contextNavigation: "Case navigation",
    contextSummary: "Summary",
    contextCustomerRecord: "Customer dialogue",
    contextEvidence: "Evidence",
    contextHistory: "History",
    historyToggle: "Show or hide history",
    historyStates: {
      ready: "Events available",
      empty: "No events",
      unavailable: "Temporarily unavailable",
      denied: "Access denied",
    },
    showProgress: "Show full progress",
    of: "of",
    evidence: "Evidence and documents",
    evidenceIntro: "Everything needed for the next decision in one place.",
    openEvidence: "Open in current system",
    evidenceUnavailable: "No operator workspace",
    reviewMeasurement: "Review R4",
    documentPreflight: "Check package",
    customerRecord: "Customer dialogue and agreement history",
    customerRecordIntro:
      "Messages, questions, quotes, contracts and document versions in one case record.",
    communications: "Messages",
    communicationsEmpty: "No customer messages are recorded.",
    communicationAllLoaded: "The full message history is shown",
    communicationLoadFailed: "Older messages could not be loaded. Try again.",
    communicationLoadingOlder: "Loading older messages",
    communicationShowOlder: "Show older messages",
    questions: "Customer questions",
    unresolvedQuestion: "One or more questions are awaiting a reply",
    questionsResolved: "All recorded questions have been answered",
    activeQuestion: "Customer question requiring action",
    questionReceived: "Received",
    relatedDocuments: "Related document",
    replyPreview: "Reply draft or latest delivery attempt",
    noReply: "No reply has been created yet.",
    openReplyWorkspace: "Open reply workspace",
    questionReplyStages: {
      prepare: "Reply must be prepared",
      review: "Reply draft ready for review",
      queued: "Reply is queued",
      sent: "Sent, awaiting delivery",
      delivered: "Reply delivered",
      delivery_failed: "Delivery needs attention",
    },
    inbound: "From customer",
    outbound: "To customer",
    sentAt: "Sent",
    deliveredAt: "Delivered",
    replyTo: "Reply to message",
    attachments: "Attachments",
    openThread: "Open related record",
    commercialVersions: "Quotes and contracts",
    commercialVersionsEmpty: "No quote or contract versions.",
    activeCommercialVersions: "Active versions",
    commercialStatuses: {
      draft: "Draft",
      approved: "Approved",
      sent: "Sent",
      viewed: "Opened by customer",
      accepted: "Accepted",
      issued: "Issued for signing",
      signed: "Signed",
      declined: "Declined",
      expired: "Expired",
      revoked: "Revoked",
      superseded: "Superseded",
    },
    commercialRoles: {
      effective: "Effective",
      working: "In progress",
      historical: "Historical",
    },
    quote: "Quote",
    contract: "Contract",
    versionShort: "v",
    supersedes: "Supersedes",
    customerSigned: "Customer signed",
    companySigned: "Company signed",
    openPdf: "Open PDF",
    documentRegister: "Document register",
    documentRegisterEmpty: "No documents are recorded.",
    relatedTo: "Related to",
    businessHistory: "Full case sequence",
    businessHistoryIntro:
      "Business events from inquiry to the latest document or agreement change.",
    historyKinds: {
      change: "Change",
      contract: "Contract",
      contract_request: "Contract request",
      document: "Document",
      invoice: "Invoice",
      lead: "Inquiry",
      measurement: "Measurement",
      message: "Message",
      price: "Price calculation",
      quote: "Quote",
      warranty: "Warranty",
      work: "Work",
    },
    historyStatuses: {
      accepted: "Accepted",
      approved: "Approved",
      attention: "Needs attention",
      delivered: "Delivered",
      draft: "Draft",
      failed: "Failed",
      new: "New",
      pending: "Pending",
      received: "Received",
      sent: "Sent",
      signed: "Signed",
    },
    otherHistoryKind: "Other event",
    otherHistoryStatus: "Other status",
    openSource: "Open source",
    timeline: "Timeline",
    timelineIntro: "Recorded case events with their timestamps.",
    timelineEmpty: "No audit events are recorded for this case.",
    timelineUnavailable: "Audit history is temporarily unavailable.",
    timelineDenied: "You do not have access to audit history.",
    changedFields: "Changed fields",
    result: "Result",
    reason: "Reason",
    version: "Version",
    sourceLabel: "Source",
    correlation: "Correlation",
    hashStatus: "Hash status",
    actorKinds: {
      user: "User",
      system: "System",
      job: "Job",
      webhook: "Webhook",
      unknown: "Unknown actor",
    },
    changedFieldsStatuses: {
      absent: "Not recorded",
      projected: "Fields recorded",
      rejected: "Rejected by privacy filter",
    },
    hashStatuses: {
      not_recorded: "Not recorded",
      recorded_unverified: "Recorded, unverified",
      invalid: "Invalid",
    },
    tamperStatuses: { not_assessable: "Cannot be assessed" },
    fallbackTitle: "Additional case tools",
    fallbackIntro:
      "Existing document and work routes remain available as a safe fallback.",
    technicalDetails: "Technical details",
    technicalIntro: "Raw system values for diagnostics",
    sourceMode: "Data source mode",
    storedService: "Stored service value",
    originalAddress: "Original address value",
    nextActionKind: "Action kind",
    requiredCapability: "Required capability",
    reviewMode: "Review mode",
    blockerCode: "Blocker code",
    rawKind: "Raw kind",
    rawStatus: "Raw status",
    rawDirection: "Raw direction",
    rawChannel: "Raw channel",
    rawCategory: "Raw message category",
    recordId: "Record ID",
    services: {
      Takfornyelse: "Roof renewal",
      takvask_impregnering: "Roof cleaning and impregnation",
    },
    otherService: "Other roof service",
    messageChannels: { email: "Email", phone: "Phone", sms: "SMS" },
    customerPortal: "Customer portal",
    messageCategories: {
      ai_reply: "Reply draft",
      change_confirmation: "Change confirmation",
      completion: "Completion",
      contract: "Contract",
      customer_question: "Customer question",
      customer_reply: "Customer reply",
      follow_up: "Follow-up",
      information_request: "Information request",
      invoice: "Invoice",
      quote: "Quote",
      receipt: "Receipt",
      reminder: "Reminder",
      schedule_confirmation: "Schedule confirmation",
    },
    messageStatuses: {
      approved: "Approved",
      attention: "Needs attention",
      cancelled: "Cancelled",
      contacted: "Contacted",
      delivered: "Delivered",
      draft: "Draft",
      failed: "Failed",
      pending: "Pending",
      queued: "Queued",
      received: "Received",
      sent: "Sent",
    },
    otherMessageChannel: "Other channel",
    otherMessageCategory: "Other message type",
    otherMessageStatus: "Other message status",
    openDocuments: "Documents",
    openWork: "Work schedule",
    stages: {
      inquiry: "Inquiry",
      evidence: "Evidence",
      commercial: "Commercial",
      agreement: "Agreement",
      work: "Work",
      completion: "Completion",
    },
    stageStates: {
      complete: "Complete",
      current: "Now",
      blocked: "Blocked",
      upcoming: "Later",
    },
    evidenceStates: {
      verified: "Verified",
      review: "Needs review",
      missing: "Missing",
    },
  },
} as const;

const evidenceIcons: Record<AdminNextEvidenceKind, typeof Ruler> = {
  measurement: Ruler,
  photo: Camera,
  document: FileCheck2,
  communication: MessageSquareText,
};

const timelineIcons: Record<AdminNextTimelineKind, typeof Ruler> = {
  automation: Bot,
  measurement: Ruler,
  message: Mail,
  assignment: UserRound,
};

const evidenceStateStyles: Record<AdminNextEvidenceState, string> = {
  verified:
    "border-[color:rgba(103,217,170,.3)] bg-[var(--an-success-soft)] text-[var(--an-success)]",
  review:
    "border-[color:rgba(244,182,63,.35)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]",
  missing:
    "border-[color:rgba(255,113,113,.35)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]",
};

const stageStyles: Record<AdminNextCaseStageState, string> = {
  complete:
    "border-[color:rgba(103,217,170,.3)] bg-[var(--an-success-soft)] text-[var(--an-success)]",
  current:
    "border-[color:rgba(244,182,63,.45)] bg-[var(--an-amber-soft)] text-[var(--an-amber)]",
  blocked:
    "border-[color:rgba(255,113,113,.35)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]",
  upcoming:
    "border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-muted)]",
};

function statusLabel(
  status: AdminNextCaseWorkspaceView["status"],
  t: (typeof copy)[PanelLocale],
) {
  return t[status];
}

function localeTag(locale: PanelLocale) {
  return locale === "nb" ? "nb-NO" : locale === "lt" ? "lt-LT" : "en-GB";
}

function zonedDayOrdinal(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Oslo",
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return Math.trunc(
    Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000,
  );
}

export function formatCaseSlaDeadline(
  deadline: string,
  locale: PanelLocale,
  now = new Date(),
) {
  const t = copy[locale];
  if (/^\d{1,2}:\d{2}$/u.test(deadline)) return deadline;
  const value = new Date(deadline);
  if (Number.isNaN(value.getTime())) return null;
  const relativeDay = zonedDayOrdinal(value) - zonedDayOrdinal(now);
  const time = new Intl.DateTimeFormat(localeTag(locale), {
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(value);
  const day =
    relativeDay === 0
      ? t.today
      : relativeDay === -1
        ? t.yesterday
        : relativeDay === 1
          ? t.tomorrow
          : new Intl.DateTimeFormat(localeTag(locale), {
              dateStyle: "medium",
              timeZone: "Europe/Oslo",
            }).format(value);
  return `${day} · ${time}`;
}

function slaLabel(
  sla: AdminNextCaseWorkspaceView["sla"],
  t: (typeof copy)[PanelLocale],
) {
  if (sla.state === "unknown") return t.slaUnknown;
  const minutes = Math.abs(sla.remainingMinutes || 0);
  const duration =
    minutes >= 60
      ? `${Math.floor(minutes / 60)} ${t.hours}${minutes % 60 ? ` ${minutes % 60} ${t.minutes}` : ""}`
      : `${minutes} ${t.minutes}`;
  if (sla.state === "overdue") return duration;
  if (sla.state === "due_soon") return `${t.due_soon} · ${duration}`;
  return `${t.on_track} · ${duration}`;
}

function auditTimestamp(locale: PanelLocale, value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(date);
}

function auditActor(
  audit: AdminNextAuditTimelineDetails,
  t: (typeof copy)[PanelLocale],
) {
  const kind = t.actorKinds[audit.actor.kind];
  return audit.actor.display ? `${kind} · ${audit.actor.display}` : kind;
}

function commercialStatusLabel(locale: PanelLocale, status: string) {
  const labels = copy[locale].commercialStatuses as Record<string, string>;
  return labels[status] || copy[locale].otherHistoryStatus;
}

function humanLabel(
  values: Readonly<Record<string, string>>,
  raw: string,
  fallback: string,
) {
  return values[raw] || fallback;
}

function displayCaseAddress(value: string) {
  return value.match(/^CAS\s+\S+\s+(.+)$/iu)?.[1] || value;
}

function explicitTestDataCue(
  source: "canonical" | "fixture",
  value: AdminNextCaseWorkspaceView,
) {
  if (source === "fixture") return "fixture" as const;
  const identityCue =
    /(?:\bdemo\b|\bpreview\b|synthetic|syntetisk|sintetin)/iu.test(
      value.customer,
    );
  const content = [
    value.customerRecord?.questions.active?.subject,
    value.customerRecord?.questions.active?.bodyText,
    ...(value.customerRecord?.communications.flatMap((message) => [
      message.subject,
      message.bodyText,
    ]) || []),
  ]
    .filter(Boolean)
    .join(" ");
  const contentCue =
    /(?:synthetic|syntetisk|sintetin|regression|testdata)/iu.test(content) ||
    /(?:not a real (?:delivery|send)|tai nėra realus siuntimas|ikke en reell (?:levering|sending))/iu.test(
      content,
    );
  return identityCue && contentCue ? ("explicit_content" as const) : null;
}

export function AdminNextCaseWorkspace({
  locale,
  returnTo = adminNextPreviewWorkQueueEntry,
  source = "fixture",
  value,
}: {
  locale: PanelLocale;
  returnTo?: string;
  source?: "canonical" | "fixture";
  value: AdminNextCaseWorkspaceView;
}) {
  const t = copy[locale];
  const currentStageIndex = value.stages.findIndex(
    ({ state }) => state === "current",
  );
  const activeStageIndex =
    currentStageIndex >= 0
      ? currentStageIndex
      : Math.max(
          0,
          value.stages.findIndex(({ state }) => state === "blocked"),
        );
  const activeStage = value.stages[activeStageIndex] ||
    value.stages[0] || { id: "inquiry" as const, state: "current" as const };
  const historyState =
    value.timelineState.status === "ready"
      ? value.timeline.length > 0
        ? "ready"
        : "empty"
      : value.timelineState.status;
  const commercialVersions = value.customerRecord?.commercialVersions || [];
  const nonHistoricalCommercialVersions = commercialVersions.filter(
    ({ role }) => role !== "historical",
  );
  const commercialVersionSummary = (
    nonHistoricalCommercialVersions.length
      ? nonHistoricalCommercialVersions
      : commercialVersions
  ).slice(0, 3);
  const testDataCue = explicitTestDataCue(source, value);
  const visibleAddress = displayCaseAddress(value.address);
  const visibleService = humanLabel(t.services, value.service, t.otherService);
  const deadlineLabel = formatCaseSlaDeadline(value.sla.deadline, locale);

  return (
    <div
      className="mx-auto max-w-[1500px] space-y-5"
      data-admin-next-section="cases"
      data-case-test-data-cue={testDataCue || undefined}
    >
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[var(--an-muted)] hover:bg-[var(--an-soft)] hover:text-[var(--an-amber)]"
        href={returnTo}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t.back}
      </Link>

      <header
        className="an-surface scroll-mt-36 overflow-hidden rounded-3xl border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--an-focus-ring)]"
        data-case-context-target
        id="case-summary"
        tabIndex={-1}
      >
        <div className="grid gap-5 p-5 sm:p-6 lg:p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                kind={
                  value.status === "attention"
                    ? "attention"
                    : value.status === "waiting"
                      ? "waiting"
                      : "resolved"
                }
                label={statusLabel(value.status, t)}
                locale={locale}
              />
              <span className="rounded-full border border-[color:rgba(244,182,63,.32)] bg-[var(--an-amber-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--an-amber)]">
                {source === "canonical" ? t.canonical : t.synthetic}
              </span>
              {testDataCue === "explicit_content" ? (
                <span className="rounded-full border border-[var(--an-info)] bg-[var(--an-info-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--an-info)]">
                  {t.regressionTestData}
                </span>
              ) : null}
            </div>
            <p className="mt-5 text-xs font-bold tracking-[.18em] text-[var(--an-amber)] uppercase">
              {t.case} {value.reference}
            </p>
            <h1 className="mt-2 truncate text-2xl font-bold tracking-[-.025em] text-[var(--an-text)] sm:text-3xl">
              {value.customer}
            </h1>
            <p className="mt-2 flex items-start gap-2 text-sm text-[var(--an-muted)]">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {visibleAddress} · {visibleService}
            </p>
            <details
              className="group mt-4 max-w-3xl rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] px-3 py-2 text-xs text-[var(--an-text-muted)]"
              data-case-technical-diagnostics
            >
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-bold text-[var(--an-text-primary)]">
                <span>{t.technicalDetails}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-2">{t.technicalIntro}</p>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt>{t.sourceMode}</dt>
                  <dd className="font-semibold break-all text-[var(--an-text-primary)]">
                    {source}
                  </dd>
                </div>
                <div>
                  <dt>{t.storedService}</dt>
                  <dd className="font-semibold break-all text-[var(--an-text-primary)]">
                    {value.service}
                  </dd>
                </div>
                {visibleAddress !== value.address ? (
                  <div className="sm:col-span-2">
                    <dt>{t.originalAddress}</dt>
                    <dd className="font-semibold break-all text-[var(--an-text-primary)]">
                      {value.address}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t.nextActionKind}</dt>
                  <dd className="font-semibold break-all text-[var(--an-text-primary)]">
                    {value.nextAction.kind}
                  </dd>
                </div>
                <div>
                  <dt>{t.requiredCapability}</dt>
                  <dd className="font-semibold break-all text-[var(--an-text-primary)]">
                    {value.nextAction.requiredCapability}
                  </dd>
                </div>
                <div>
                  <dt>{t.reviewMode}</dt>
                  <dd className="font-semibold break-all text-[var(--an-text-primary)]">
                    {value.nextAction.reviewMode}
                  </dd>
                </div>
                {value.nextAction.diagnosticBlocker ? (
                  <div>
                    <dt>{t.blockerCode}</dt>
                    <dd className="font-semibold break-all text-[var(--an-text-primary)]">
                      {value.nextAction.diagnosticBlocker.code}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </details>
          </div>
          <dl className="grid grid-cols-2 gap-3 lg:min-w-[350px]">
            <div className="an-elevated rounded-2xl border p-4">
              <dt className="flex items-center gap-2 text-xs font-bold text-[var(--an-muted)]">
                <UserRound aria-hidden="true" className="size-4" />
                {t.owner}
              </dt>
              <dd className="mt-2 text-sm font-bold text-[var(--an-text)]">
                {value.owner.name}
              </dd>
              <dd className="mt-1 text-xs text-[var(--an-subtle)]">
                {value.owner.team}
              </dd>
            </div>
            <div
              className={`rounded-2xl border p-4 ${value.sla.state === "overdue" ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)]" : value.sla.state === "due_soon" ? "border-[var(--an-info)] bg-[var(--an-info-soft)]" : "border-[var(--an-border)] bg-[var(--an-surface-soft)]"}`}
            >
              <dt className="text-xs font-bold text-[var(--an-text-muted)]">
                {t.sla}
              </dt>
              <dd className="mt-2 text-sm font-bold">
                {value.sla.state === "unknown"
                  ? t.slaUnknown
                  : deadlineLabel || t.slaUnknown}
              </dd>
              <dd className="mt-1">
                <DueIndicator
                  label={slaLabel(value.sla, t)}
                  locale={locale}
                  state={
                    value.sla.state === "unknown" ? "on_track" : value.sla.state
                  }
                />
              </dd>
            </div>
          </dl>
        </div>

        <section
          className="border-t border-[var(--an-border)] bg-[var(--an-elevated)] p-5 sm:p-6 lg:flex lg:items-center lg:justify-between lg:gap-6"
          aria-labelledby="case-next-action-title"
          data-case-action-mode={value.nextAction.interaction.mode}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[.16em] text-[var(--an-amber)] uppercase">
              {t.next}
            </p>
            <h2
              className="mt-2 text-xl font-bold text-[var(--an-text)]"
              id="case-next-action-title"
            >
              {value.nextAction.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--an-muted)]">
              {value.nextAction.reason}
            </p>
            {value.nextAction.interaction.mode === "read_only" &&
            value.nextAction.interaction.reason !== "diagnostic_blocker" ? (
              <p className="mt-2 max-w-3xl text-xs font-semibold text-[var(--an-text-subtle)]">
                {t.interactionReasons[value.nextAction.interaction.reason]}
              </p>
            ) : null}
            {value.nextAction.diagnosticBlocker ? (
              <div className="mt-3 max-w-3xl">
                <BlockerSummary
                  locale={locale}
                  recovery={value.nextAction.diagnosticBlocker.recovery}
                >
                  {t.dataPrerequisite}
                </BlockerSummary>
              </div>
            ) : null}
          </div>
          <Link
            className={`${value.nextAction.href && value.nextAction.label ? "an-cta" : "border border-[var(--an-border-strong)] bg-[var(--an-surface-base)] text-[var(--an-text-muted)]"} mt-4 inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold sm:w-auto lg:mt-0`}
            href={value.nextAction.href || returnTo}
          >
            {value.nextAction.label || t.currentFallback}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      </header>

      <section
        className="an-surface rounded-3xl border p-5 sm:p-6"
        aria-labelledby="case-progress-title"
      >
        <h2
          className="text-lg font-bold text-[var(--an-text)]"
          id="case-progress-title"
        >
          {t.process}
        </h2>
        <p className="mt-1 text-sm text-[var(--an-muted)]">{t.processIntro}</p>
        <details className="mt-5 sm:hidden">
          <summary
            aria-current={activeStage.state === "current" ? "step" : undefined}
            className={`min-h-12 cursor-pointer list-none rounded-2xl border p-3 ${stageStyles[activeStage.state]}`}
            data-case-stage-card
          >
            <span className="flex items-center justify-between gap-3">
              <strong>
                {activeStageIndex + 1} {t.of} {value.stages.length} ·{" "}
                {t.stages[activeStage.id]}
              </strong>
              <small className="font-bold tracking-wider uppercase">
                {t.stageStates[activeStage.state]}
              </small>
            </span>
            <span className="mt-1 block text-xs underline underline-offset-2">
              {t.showProgress}
            </span>
          </summary>
          <ol className="mt-2 grid gap-2">
            {value.stages.map((stage, index) => (
              <li
                className={`rounded-2xl border p-3 ${stageStyles[stage.state]}`}
                data-case-stage-card
                key={`mobile-${stage.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-[var(--an-surface)] text-xs font-black">
                    {stage.state === "complete" ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <small className="text-[10px] font-bold tracking-wider uppercase">
                    {t.stageStates[stage.state]}
                  </small>
                </div>
                <strong className="mt-3 block text-xs">
                  {t.stages[stage.id]}
                </strong>
              </li>
            ))}
          </ol>
        </details>
        <ol className="mt-5 hidden min-w-0 gap-2 sm:grid sm:grid-cols-3 xl:grid-cols-6">
          {value.stages.map((stage, index) => (
            <li
              aria-current={stage.state === "current" ? "step" : undefined}
              className={`min-w-0 rounded-2xl border p-3 ${stageStyles[stage.state]}`}
              data-case-stage-card
              key={stage.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-[var(--an-surface)] text-xs font-black">
                  {stage.state === "complete" ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <small className="text-[10px] font-bold tracking-wider uppercase">
                  {t.stageStates[stage.state]}
                </small>
              </div>
              <strong className="mt-3 block text-xs sm:text-sm">
                {t.stages[stage.id as AdminNextCaseStageId]}
              </strong>
            </li>
          ))}
        </ol>
      </section>

      <AdminNextCaseWorkspacePanelSwitcher
        labels={{
          "case-customer-record": t.contextCustomerRecord,
          "case-evidence": t.contextEvidence,
          "case-history": t.contextHistory,
        }}
        navigationLabel={t.contextNavigation}
      >
        <div>
          {value.customerRecord ? (
            <section
              className="an-surface scroll-mt-36 rounded-3xl border p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--an-focus-ring)] sm:p-6"
              aria-labelledby="case-customer-record-title"
              data-customer-record
              id="case-customer-record"
              tabIndex={-1}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2
                    className="text-lg font-bold text-[var(--an-text)]"
                    id="case-customer-record-title"
                  >
                    {t.customerRecord}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm text-[var(--an-muted)]">
                    {t.customerRecordIntro}
                  </p>
                </div>
                <div
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${value.customerRecord.questions.unresolved ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)] text-[var(--an-danger)]" : "border-[color:rgba(103,217,170,.3)] bg-[var(--an-success-soft)] text-[var(--an-success)]"}`}
                  data-customer-question-state={
                    value.customerRecord.questions.unresolved
                      ? "unresolved"
                      : "resolved"
                  }
                >
                  <MessageCircleQuestion
                    aria-hidden="true"
                    className="size-4"
                  />
                  <span>
                    {t.questions}: {value.customerRecord.questions.total} ·{" "}
                    {value.customerRecord.questions.unresolved
                      ? t.unresolvedQuestion
                      : t.questionsResolved}
                  </span>
                </div>
              </div>

              {value.customerRecord.questions.active ? (
                <section
                  aria-labelledby="case-active-question-title"
                  className="mt-5 rounded-2xl border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-4 sm:p-5"
                  data-customer-question-focus
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-[var(--an-danger)] uppercase">
                        <MessageCircleQuestion
                          aria-hidden="true"
                          className="size-4"
                        />
                        {t.activeQuestion}
                      </p>
                      <h3
                        className="mt-2 text-base font-bold break-words text-[var(--an-text)]"
                        id="case-active-question-title"
                      >
                        {value.customerRecord.questions.active.subject}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--an-subtle)]">
                        {t.questionReceived}:{" "}
                        {auditTimestamp(
                          locale,
                          value.customerRecord.questions.active.receivedAt,
                        )}{" "}
                        · {t.customerPortal}
                      </p>
                    </div>
                    <span className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-[var(--an-danger)] px-3 text-xs font-bold text-[var(--an-danger)]">
                      {
                        t.questionReplyStages[
                          value.customerRecord.questions.active.replyStage
                        ]
                      }
                    </span>
                  </div>

                  <p className="mt-4 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-4 text-sm leading-6 whitespace-pre-wrap text-[var(--an-text)]">
                    {value.customerRecord.questions.active.bodyText}
                  </p>

                  {value.customerRecord.questions.active.documentReferences
                    .length ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <strong className="text-[var(--an-muted)]">
                        {t.relatedDocuments}:
                      </strong>
                      {value.customerRecord.questions.active.documentReferences.map(
                        (reference) => (
                          <span
                            className="rounded-full border border-[var(--an-border)] bg-[var(--an-elevated)] px-2.5 py-1 font-bold text-[var(--an-text)]"
                            key={reference}
                          >
                            {reference}
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}

                  {value.customerRecord.questions.active.reply ? (
                    <details className="group mt-4 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)]">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-bold text-[var(--an-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]">
                        <span>{t.replyPreview}</span>
                        <span className="flex items-center gap-2 text-[var(--an-muted)]">
                          {humanLabel(
                            t.messageStatuses,
                            value.customerRecord.questions.active.reply.status,
                            t.otherMessageStatus,
                          )}
                          <ChevronDown
                            aria-hidden="true"
                            className="size-4 transition-transform group-open:rotate-180"
                          />
                        </span>
                      </summary>
                      <div className="border-t border-[var(--an-border)] p-3">
                        <strong className="block text-sm text-[var(--an-text)]">
                          {value.customerRecord.questions.active.reply.subject}
                        </strong>
                        <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[var(--an-muted)]">
                          {value.customerRecord.questions.active.reply.bodyText}
                        </p>
                        <p className="mt-2 text-[10px] text-[var(--an-subtle)]">
                          {auditTimestamp(
                            locale,
                            value.customerRecord.questions.active.reply.at,
                          )}
                        </p>
                      </div>
                    </details>
                  ) : (
                    <p className="mt-4 text-xs font-semibold text-[var(--an-danger)]">
                      {t.noReply}
                    </p>
                  )}

                  <Link
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--an-action)] bg-[var(--an-surface-base)] px-4 text-sm font-bold text-[var(--an-action)] hover:bg-[var(--an-action-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
                    href={value.customerRecord.questions.active.fallbackHref}
                  >
                    {t.openReplyWorkspace}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </section>
              ) : null}

              <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)]">
                <AdminNextCaseCommunications
                  copy={{
                    allLoaded: t.communicationAllLoaded,
                    attachments: t.attachments,
                    categoryLabels: t.messageCategories,
                    channelLabels: t.messageChannels,
                    customerPortal: t.customerPortal,
                    deliveredAt: t.deliveredAt,
                    empty: t.communicationsEmpty,
                    inbound: t.inbound,
                    loadFailed: t.communicationLoadFailed,
                    loadingOlder: t.communicationLoadingOlder,
                    of: t.of,
                    openThread: t.openThread,
                    otherCategory: t.otherMessageCategory,
                    otherChannel: t.otherMessageChannel,
                    otherStatus: t.otherMessageStatus,
                    outbound: t.outbound,
                    rawCategory: t.rawCategory,
                    rawChannel: t.rawChannel,
                    rawDirection: t.rawDirection,
                    rawStatus: t.rawStatus,
                    recordId: t.recordId,
                    replyTo: t.replyTo,
                    sentAt: t.sentAt,
                    showOlder: t.communicationShowOlder,
                    statusLabels: t.messageStatuses,
                    technicalDetails: t.technicalDetails,
                    title: t.communications,
                  }}
                  initialItems={value.customerRecord.communications}
                  initialPageInfo={value.customerRecord.communicationPage}
                  locale={locale}
                />

                <div className="min-w-0 space-y-5">
                  <details className="an-elevated group rounded-2xl border">
                    <summary
                      className="flex min-h-14 cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 text-sm font-bold text-[var(--an-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
                      id="case-commercial-versions-title"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <FileSignature
                            aria-hidden="true"
                            className="size-4 text-[var(--an-amber)]"
                          />
                          {t.commercialVersions} ·{" "}
                          {value.customerRecord.commercialVersions.length}
                        </span>
                        {commercialVersionSummary.length ? (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            <span className="sr-only">
                              {t.activeCommercialVersions}:
                            </span>
                            {commercialVersionSummary.map((item) => (
                              <span
                                className="rounded-full border border-[var(--an-border)] bg-[var(--an-surface-base)] px-2 py-1 text-[10px] font-bold text-[var(--an-muted)]"
                                key={`summary-${item.id}`}
                              >
                                {item.kind === "quote" ? t.quote : t.contract}{" "}
                                {item.reference} ·{" "}
                                {commercialStatusLabel(locale, item.status)} ·{" "}
                                {t.commercialRoles[item.role]}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className="mt-1 size-4 shrink-0 text-[var(--an-subtle)] transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="px-3 pb-3">
                      {value.customerRecord.commercialVersions.length ? (
                        <ol
                          className="mt-3 space-y-2 sm:max-h-[24rem] sm:overflow-auto sm:pr-1"
                          data-commercial-versions
                        >
                          {value.customerRecord.commercialVersions.map(
                            (item) => (
                              <li
                                className="an-elevated rounded-2xl border p-3"
                                key={item.id}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold tracking-wider text-[var(--an-amber)] uppercase">
                                      {item.kind === "quote"
                                        ? t.quote
                                        : t.contract}{" "}
                                      · {t.versionShort}
                                      {item.version}
                                    </p>
                                    <strong className="mt-1 block truncate text-sm text-[var(--an-text)]">
                                      {item.reference}
                                    </strong>
                                  </div>
                                  <span className="shrink-0 rounded-full border border-[var(--an-border)] px-2 py-1 text-[10px] font-bold text-[var(--an-muted)]">
                                    {commercialStatusLabel(locale, item.status)}{" "}
                                    · {t.commercialRoles[item.role]}
                                  </span>
                                </div>
                                <dl className="mt-2 space-y-1 text-[11px] text-[var(--an-subtle)]">
                                  <div>
                                    <dt className="sr-only">{t.version}</dt>
                                    <dd>
                                      {auditTimestamp(locale, item.createdAt)}
                                    </dd>
                                  </div>
                                  {item.supersedesReference ? (
                                    <div>
                                      <dt className="inline font-bold">
                                        {t.supersedes}:{" "}
                                      </dt>
                                      <dd className="inline">
                                        {item.supersedesReference}
                                      </dd>
                                    </div>
                                  ) : null}
                                  {item.signedAt ? (
                                    <div>
                                      <dt className="inline font-bold">
                                        {t.customerSigned}:{" "}
                                      </dt>
                                      <dd className="inline">
                                        {auditTimestamp(locale, item.signedAt)}
                                      </dd>
                                    </div>
                                  ) : null}
                                  {item.companySignedAt ? (
                                    <div>
                                      <dt className="inline font-bold">
                                        {t.companySigned}:{" "}
                                      </dt>
                                      <dd className="inline">
                                        {auditTimestamp(
                                          locale,
                                          item.companySignedAt,
                                        )}
                                      </dd>
                                    </div>
                                  ) : null}
                                  {item.documentHash ? (
                                    <div className="break-all">
                                      <dt className="inline font-bold">
                                        Hash:{" "}
                                      </dt>
                                      <dd className="inline">
                                        {item.documentHash}
                                      </dd>
                                    </div>
                                  ) : null}
                                </dl>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {item.pdfHref ? (
                                    <Link
                                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--an-amber)] hover:bg-[var(--an-amber-soft)]"
                                      href={item.pdfHref}
                                      target="_blank"
                                    >
                                      {t.openPdf}
                                      <ArrowRight
                                        aria-hidden="true"
                                        className="size-3.5"
                                      />
                                    </Link>
                                  ) : null}
                                  <Link
                                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--an-muted)] hover:bg-[var(--an-soft)]"
                                    href={item.fallbackHref}
                                  >
                                    {t.openThread}
                                  </Link>
                                </div>
                              </li>
                            ),
                          )}
                        </ol>
                      ) : (
                        <p className="mt-3 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4 text-sm text-[var(--an-muted)]">
                          {t.commercialVersionsEmpty}
                        </p>
                      )}
                    </div>
                  </details>

                  <details className="an-elevated group rounded-2xl border">
                    <summary
                      className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[var(--an-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
                      id="case-document-register-title"
                    >
                      <span className="flex items-center gap-2">
                        <Files
                          aria-hidden="true"
                          className="size-4 text-[var(--an-amber)]"
                        />
                        {t.documentRegister} ·{" "}
                        {value.customerRecord.documents.length}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className="size-4 shrink-0 text-[var(--an-subtle)] transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="px-3 pb-3">
                      {value.customerRecord.documents.length ? (
                        <ul
                          className="mt-3 space-y-2 sm:max-h-64 sm:overflow-auto sm:pr-1"
                          data-document-register
                        >
                          {value.customerRecord.documents.map((document) => (
                            <li key={document.id}>
                              <Link
                                className="an-elevated flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3 hover:border-[var(--an-amber)]"
                                href={document.href}
                                target="_blank"
                              >
                                <span className="min-w-0">
                                  <strong className="block truncate text-xs text-[var(--an-text)]">
                                    {document.filename}
                                  </strong>
                                  <small className="mt-1 block truncate text-[var(--an-subtle)]">
                                    {document.classification} ·{" "}
                                    {document.mimeType} ·{" "}
                                    {auditTimestamp(locale, document.createdAt)}
                                    {document.ownerType
                                      ? ` · ${t.relatedTo}: ${document.ownerType}${document.ownerId ? ` #${document.ownerId}` : ""}`
                                      : ""}
                                  </small>
                                </span>
                                <ArrowRight
                                  aria-hidden="true"
                                  className="size-4 shrink-0 text-[var(--an-amber)]"
                                />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4 text-sm text-[var(--an-muted)]">
                          {t.documentRegisterEmpty}
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              </div>

              <details className="group mt-6 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)]">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]">
                  <span>
                    <strong
                      className="block text-sm text-[var(--an-text)]"
                      id="case-business-history-title"
                    >
                      {t.businessHistory} ·{" "}
                      {value.customerRecord.history.length}
                    </strong>
                    <span className="mt-1 block text-xs text-[var(--an-muted)]">
                      {t.businessHistoryIntro}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[var(--an-subtle)] transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="px-4 pb-4">
                  {value.customerRecord.history.length ? (
                    <ol
                      className="mt-3 grid gap-2 sm:max-h-80 sm:grid-cols-2 sm:overflow-auto sm:pr-1 xl:grid-cols-3"
                      data-business-history
                    >
                      {value.customerRecord.history.map((item) => (
                        <li
                          className="an-elevated flex min-w-0 items-start justify-between gap-3 rounded-xl border p-3"
                          key={item.id}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[var(--an-text)]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[10px] text-[var(--an-subtle)]">
                              {humanLabel(
                                t.historyKinds,
                                item.kind,
                                t.otherHistoryKind,
                              )}{" "}
                              ·{" "}
                              {humanLabel(
                                t.historyStatuses,
                                item.status,
                                t.otherHistoryStatus,
                              )}{" "}
                              · {auditTimestamp(locale, item.at)}
                            </p>
                            <details
                              className="mt-2 text-[10px] text-[var(--an-subtle)]"
                              data-business-history-diagnostics
                            >
                              <summary className="min-h-8 cursor-pointer font-bold">
                                {t.technicalDetails}
                              </summary>
                              <p className="break-all">
                                {t.recordId}: {item.id} · {t.rawKind}:{" "}
                                {item.kind} · {t.rawStatus}: {item.status}
                              </p>
                            </details>
                          </div>
                          {item.href ? (
                            <Link
                              aria-label={`${t.openSource}: ${item.title}`}
                              className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--an-amber)] hover:bg-[var(--an-amber-soft)]"
                              href={item.href}
                            >
                              <ArrowRight
                                aria-hidden="true"
                                className="size-4"
                              />
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--an-muted)]">
                      {t.timelineEmpty}
                    </p>
                  )}
                </div>
              </details>
            </section>
          ) : (
            <section
              className="an-surface rounded-3xl border p-5 sm:p-6"
              id="case-customer-record"
            >
              <h2 className="text-lg font-bold text-[var(--an-text)]">
                {t.customerRecord}
              </h2>
              <p className="mt-3 text-sm text-[var(--an-muted)]">
                {t.communicationsEmpty}
              </p>
            </section>
          )}
        </div>

        <div>
          <section
            className="an-surface min-w-0 scroll-mt-36 rounded-3xl border p-5 sm:p-6"
            aria-labelledby="case-evidence-title"
            id="case-evidence"
            tabIndex={-1}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-lg font-bold text-[var(--an-text)]"
                  id="case-evidence-title"
                >
                  {t.evidence}
                </h2>
                <p className="mt-1 text-sm text-[var(--an-muted)]">
                  {t.evidenceIntro}
                </p>
              </div>
              <ShieldCheck
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--an-success)]"
              />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {value.evidence.map((item) => {
                const Icon = evidenceIcons[item.kind];
                const evidenceHref = item.previewHref || item.fallbackHref;
                const actionLabel =
                  item.previewAction === "review_measurement"
                    ? t.reviewMeasurement
                    : item.previewAction === "document_preflight"
                      ? t.documentPreflight
                      : t.openEvidence;
                return (
                  <article
                    className="an-elevated flex min-h-56 flex-col rounded-2xl border p-4"
                    key={item.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-[var(--an-amber-soft)] text-[var(--an-amber)]">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold ${evidenceStateStyles[item.state]}`}
                      >
                        {t.evidenceStates[item.state]}
                      </span>
                    </div>
                    <h3 className="mt-4 font-bold text-[var(--an-text)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--an-muted)]">
                      {item.summary}
                    </p>
                    {item.metric ? (
                      <strong className="mt-3 block text-sm text-[var(--an-amber)]">
                        {item.metric}
                      </strong>
                    ) : null}
                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <small className="text-[var(--an-subtle)]">
                        {item.recordedAt}
                      </small>
                      {evidenceHref ? (
                        <Link
                          aria-label={`${actionLabel}: ${item.title}`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[var(--an-amber)] hover:bg-[var(--an-amber-soft)]"
                          href={evidenceHref}
                        >
                          {actionLabel}
                          <ArrowRight aria-hidden="true" className="size-3.5" />
                        </Link>
                      ) : (
                        <span className="text-right text-xs font-semibold text-[var(--an-text-subtle)]">
                          {t.evidenceUnavailable}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <div>
          <aside
            className="an-surface min-w-0 scroll-mt-36 rounded-3xl border p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--an-focus-ring)] sm:p-6"
            aria-labelledby="case-timeline-title"
            id="case-history"
            tabIndex={-1}
          >
            <AdminNextCaseWorkspaceHistoryRail
              controlsId="case-history-content"
              state={historyState}
              stateLabel={t.historyStates[historyState]}
              toggleLabel={t.historyToggle}
            >
              <h2
                className="text-lg font-bold text-[var(--an-text)]"
                id="case-timeline-title"
              >
                {t.timeline}
              </h2>
              <p className="mt-1 text-sm text-[var(--an-muted)]">
                {t.timelineIntro}
              </p>
              {value.timelineState.status === "ready" &&
              value.timeline.length > 0 ? (
                <ol className="mt-6 space-y-0" data-audit-history-state="ready">
                  {value.timeline.map((item, index) => {
                    const Icon = timelineIcons[item.kind];
                    const audit = item.audit;
                    return (
                      <li
                        className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-6 last:pb-0"
                        key={item.id}
                      >
                        {index < value.timeline.length - 1 ? (
                          <span
                            aria-hidden="true"
                            className="absolute top-10 bottom-0 left-5 w-px bg-[var(--an-border)]"
                          />
                        ) : null}
                        <span className="relative z-10 grid size-10 place-items-center rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] text-[var(--an-amber)]">
                          <Icon aria-hidden="true" className="size-[18px]" />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <div className="flex items-start justify-between gap-3">
                            <strong className="text-sm text-[var(--an-text)]">
                              {audit?.label ||
                                (/[_\.]/u.test(item.title)
                                  ? t.otherHistoryKind
                                  : item.title)}
                            </strong>
                            <small className="shrink-0 text-[var(--an-subtle)]">
                              {audit
                                ? auditTimestamp(locale, audit.atUtc)
                                : item.at}
                            </small>
                          </div>
                          {audit ? (
                            <details
                              className="mt-2 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] px-3 py-2 text-xs leading-5 text-[var(--an-muted)]"
                              data-audit-event-diagnostics
                            >
                              <summary className="min-h-8 cursor-pointer font-bold text-[var(--an-text)]">
                                {t.technicalDetails}
                              </summary>
                              <div className="mt-2 space-y-2">
                                <p className="break-all">
                                  {t.rawKind}: {audit.action}
                                </p>
                                <p>
                                  <strong className="text-[var(--an-text)]">
                                    {t.changedFields}:
                                  </strong>{" "}
                                  {audit.changedFields.length
                                    ? audit.changedFields.join(", ")
                                    : t.changedFieldsStatuses[
                                        audit.changedFieldsStatus
                                      ]}
                                </p>
                                <dl className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--an-subtle)]">
                                  {audit.result ? (
                                    <div>
                                      <dt className="inline font-bold">
                                        {t.result}:{" "}
                                      </dt>
                                      <dd className="inline">{audit.result}</dd>
                                    </div>
                                  ) : null}
                                  {audit.reason ? (
                                    <div>
                                      <dt className="inline font-bold">
                                        {t.reason}:{" "}
                                      </dt>
                                      <dd className="inline">{audit.reason}</dd>
                                    </div>
                                  ) : null}
                                  {audit.version !== null ? (
                                    <div>
                                      <dt className="inline font-bold">
                                        {t.version}:{" "}
                                      </dt>
                                      <dd className="inline">
                                        {audit.version}
                                      </dd>
                                    </div>
                                  ) : null}
                                  {audit.source ? (
                                    <div>
                                      <dt className="inline font-bold">
                                        {t.sourceLabel}:{" "}
                                      </dt>
                                      <dd className="inline">{audit.source}</dd>
                                    </div>
                                  ) : null}
                                </dl>
                                {audit.trace?.length ? (
                                  <p
                                    className="text-[11px] text-[var(--an-subtle)]"
                                    data-audit-event-trace
                                  >
                                    {audit.trace.join(" · ")}
                                  </p>
                                ) : null}
                                <p className="text-[10px] break-all text-[var(--an-subtle)]">
                                  {t.correlation}: {audit.correlationId} ·{" "}
                                  {t.hashStatus}:{" "}
                                  {t.hashStatuses[audit.integrity.hashStatus]} ·{" "}
                                  {
                                    t.tamperStatuses[
                                      audit.integrity.tamperStatus
                                    ]
                                  }
                                </p>
                              </div>
                            </details>
                          ) : (
                            <p className="mt-1 text-xs leading-5 text-[var(--an-muted)]">
                              {item.summary}
                            </p>
                          )}
                          <small className="mt-2 flex items-center gap-1.5 font-semibold text-[var(--an-subtle)]">
                            <CircleAlert
                              aria-hidden="true"
                              className="size-3"
                            />
                            {audit ? auditActor(audit, t) : item.actor}
                          </small>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : value.timelineState.status === "ready" ? (
                <p
                  className="mt-5 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4 text-sm text-[var(--an-muted)]"
                  data-audit-history-state="empty"
                  role="status"
                >
                  {t.timelineEmpty}
                </p>
              ) : (
                <p
                  className="mt-5 rounded-2xl border border-[var(--an-border)] bg-[var(--an-elevated)] p-4 text-sm text-[var(--an-muted)]"
                  data-audit-history-state={value.timelineState.status}
                  role="status"
                >
                  {value.timelineState.status === "denied"
                    ? t.timelineDenied
                    : t.timelineUnavailable}
                </p>
              )}
            </AdminNextCaseWorkspaceHistoryRail>
          </aside>
        </div>
      </AdminNextCaseWorkspacePanelSwitcher>

      <details
        className="an-surface group rounded-3xl border"
        data-case-fallback-tools
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-bold text-[var(--an-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)] sm:px-6">
          <span>{t.fallbackTitle}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-[var(--an-subtle)] transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-[var(--an-border)] px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <p className="text-sm text-[var(--an-muted)]">{t.fallbackIntro}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:flex">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface)] px-3 text-xs font-bold text-[var(--an-text)] hover:bg-[var(--an-soft)]"
              href={value.fallback.documentsHref}
            >
              <FolderOpen aria-hidden="true" className="size-4" />
              {t.openDocuments}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface)] px-3 text-xs font-bold text-[var(--an-text)] hover:bg-[var(--an-soft)]"
              href={value.fallback.workHref}
            >
              <ImageIcon aria-hidden="true" className="size-4" />
              {t.openWork}
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}
