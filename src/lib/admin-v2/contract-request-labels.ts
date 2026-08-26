import type { PanelLocale } from "@/lib/panel-i18n";

type Localized = Record<PanelLocale, string>;

const reasons: Record<string, Localized> = {
  price: { nb: "Prisen passer ikke", lt: "Netinka kaina", en: "Price does not fit" },
  wait: { nb: "Vil vente / ikke nå", lt: "Nori palaukti / ne dabar", en: "Wants to wait / not now" },
  timing: { nb: "Tidspunktet passer ikke", lt: "Netinka laikas", en: "Timing does not fit" },
  other_supplier: { nb: "Valgte en annen leverandør", lt: "Pasirinko kitą tiekėją", en: "Chose another supplier" },
  scope: { nb: "Omfanget passer ikke", lt: "Netinka darbų apimtis", en: "Scope does not fit" },
  need_information: { nb: "Trenger mer informasjon", lt: "Reikia daugiau informacijos", en: "Needs more information" },
  personal_financial: { nb: "Personlige eller økonomiske årsaker", lt: "Asmeninės arba finansinės priežastys", en: "Personal or financial reasons" },
  communication: { nb: "Kommunikasjonen fungerte ikke", lt: "Netenkino komunikacija", en: "Communication did not work" },
  not_needed: { nb: "Tjenesten er ikke lenger nødvendig", lt: "Paslauga nebereikalinga", en: "No longer needed" },
  other: { nb: "Annen årsak", lt: "Kita priežastis", en: "Other reason" },
  prefer_not_to_say: { nb: "Ønsker ikke å oppgi årsak", lt: "Nenori nurodyti priežasties", en: "Prefers not to say" },
};

const statuses: Record<string, Localized> = {
  received: { nb: "Mottatt", lt: "Gauta", en: "Received" },
  admin_review: { nb: "Til administratorvurdering", lt: "Laukia administratoriaus sprendimo", en: "Awaiting administrator review" },
  alternative_requested: { nb: "Alternativt tilbud ønsket", lt: "Ruošiamas alternatyvus pasiūlymas", en: "Alternative quote requested" },
  follow_up_scheduled: { nb: "Oppfølging planlagt", lt: "Kontaktas suplanuotas", en: "Follow-up scheduled" },
  recovered: { nb: "Kunden beholdt", lt: "Klientas išsaugotas", en: "Customer retained" },
  closed: { nb: "Avsluttet", lt: "Užbaigta", en: "Closed" },
  do_not_contact: { nb: "Ikke kontakt", lt: "Nebekontaktuoti", en: "Do not contact" },
};

const recovery: Record<string, Localized> = {
  green: { nb: "Grønn", lt: "Žalia", en: "Green" },
  yellow: { nb: "Gul", lt: "Geltona", en: "Yellow" },
  red: { nb: "Rød", lt: "Raudona", en: "Red" },
};

const workStatuses: Record<string, Localized> = {
  not_created: { nb: "Arbeidsordre er ikke opprettet", lt: "Darbo užsakymas nesukurtas", en: "Work order not created" },
  unassigned: { nb: "Ikke tildelt", lt: "Darbuotojas nepaskirtas", en: "Unassigned" },
  assigned: { nb: "Tildelt", lt: "Darbuotojas paskirtas", en: "Assigned" },
  scheduled: { nb: "Planlagt", lt: "Suplanuota", en: "Scheduled" },
  on_way: { nb: "På vei", lt: "Vykstama į objektą", en: "On the way" },
  arrived: { nb: "Ankommet", lt: "Atvyko", en: "Arrived" },
  precheck: { nb: "Før-kontroll", lt: "Pirminė patikra", en: "Pre-check" },
  ready: { nb: "Klar til start", lt: "Paruošta pradėti", en: "Ready to start" },
  blocked: { nb: "Blokkert", lt: "Sustabdyta", en: "Blocked" },
  in_progress: { nb: "Startet", lt: "Darbai pradėti", en: "In progress" },
  completed: { nb: "Arbeid fullført", lt: "Darbai baigti", en: "Work completed" },
  documented: { nb: "Dokumentasjon levert", lt: "Dokumentai pateikti", en: "Documentation delivered" },
  cancelled: { nb: "Avbrutt", lt: "Atšaukta", en: "Cancelled" },
};

const followUps: Record<string, Localized> = {
  one_month: { nb: "Om 1 måned", lt: "Po 1 mėnesio", en: "In 1 month" },
  three_months: { nb: "Om 3 måneder", lt: "Po 3 mėnesių", en: "In 3 months" },
  six_months: { nb: "Om 6 måneder", lt: "Po 6 mėnesių", en: "In 6 months" },
  next_spring: { nb: "Neste vår", lt: "Kitą pavasarį", en: "Next spring" },
  custom: { nb: "Egendefinert dato", lt: "Pasirinkta data", en: "Custom date" },
  never: { nb: "Ikke kontakt igjen", lt: "Daugiau nebekontaktuoti", en: "Do not contact again" },
};

const suggestions: Record<string, Localized> = {
  "Kontroller rettslig og operativ status, og vurder ett relevant alternativ innen samtykket.": {
    nb: "Kontroller rettslig og operativ status, og vurder ett relevant alternativ innen samtykket.",
    lt: "Patikrinkite teisinę ir darbų būseną; jei klientas sutiko, apsvarstykite vieną tinkamą alternatyvą.",
    en: "Check the legal and operational status, then consider one relevant alternative within the customer's consent.",
  },
  "Behandle meldingen uten salgsoppfølging.": {
    nb: "Behandle meldingen uten salgsoppfølging.",
    lt: "Apdorokite pranešimą be papildomo pardavimo kontakto.",
    en: "Process the notice without a sales follow-up.",
  },
  "Administrator må vurdere saken uten automatisk salgsoppfølging.": {
    nb: "Administrator må vurdere saken uten automatisk salgsoppfølging.",
    lt: "Administratorius turi įvertinti bylą be automatinio pardavimo kontakto.",
    en: "An administrator must review the case without an automatic sales follow-up.",
  },
};

function label(values: Record<string, Localized>, value: string | null | undefined, locale: PanelLocale) {
  if (!value) return "—";
  return values[value]?.[locale] || value;
}

export const contractRequestReasonLabel = (value: string | null | undefined, locale: PanelLocale) => label(reasons, value, locale);
export const contractRequestStatusLabel = (value: string | null | undefined, locale: PanelLocale) => label(statuses, value, locale);
export const contractRequestRecoveryLabel = (value: string | null | undefined, locale: PanelLocale) => label(recovery, value, locale);
export const contractRequestWorkStatusLabel = (value: string | null | undefined, locale: PanelLocale) => label(workStatuses, value, locale);
export const contractRequestFollowUpLabel = (value: string | null | undefined, locale: PanelLocale) => label(followUps, value, locale);
export const contractRequestSuggestionLabel = (value: string | null | undefined, locale: PanelLocale) => label(suggestions, value, locale);
