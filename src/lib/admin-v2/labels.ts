import type { PanelLocale } from "@/lib/panel-i18n";

const statuses: Record<PanelLocale, Record<string, string>> = {
  nb: {
    new: "Ny", contacted: "Kontaktet", qualified: "Kvalifisert", measuring: "Måles", draft_ready: "Utkast klart", quoted: "Tilbud klargjort", customer_waiting: "Kunden venter på svar", waiting_customer: "Venter på kunden", converted: "Bekreftet kunde", closed: "Lukket",
    draft: "Utkast", review_required: "Må kontrolleres", approved: "Godkjent", blocked: "Blokkert", ready: "Klar", sent: "Sendt", viewed: "Sett", accepted: "Akseptert", declined: "Avslått", expired: "Utløpt", revoked: "Tilbakekalt", superseded: "Erstattet", issued: "Utstedt",
    signed: "Signert", customer_signed: "Kunden signerte", fully_signed: "Begge parter signerte", queued: "I sendekø", delivered: "Levert", failed: "Mislykket", attention: "Krever oppfølging", pending: "Venter",
    unassigned: "Ikke tildelt", assigned: "Tildelt", scheduled: "Planlagt", on_way: "På vei", arrived: "Ankommet", precheck: "Forhåndskontroll", in_progress: "Pågår", completed: "Fullført", documented: "Dokumentert", cancelled: "Kansellert",
    ai_qa: "AI-kontroll", human_review: "Menneskelig kontroll", published: "Publisert",
    active: "Aktiv", exported: "Eksportert", needs_review: "Må kontrolleres", awaiting_payment: "Venter på betaling", paid: "Betalt", overdue: "Forfalt", credited: "Kreditert",
    received: "Mottatt", admin_review: "Til administratorvurdering", alternative_requested: "Alternativt tilbud ønsket", follow_up_scheduled: "Oppfølging planlagt", recovered: "Kunden beholdt", do_not_contact: "Ikke kontakt",
  },
  lt: {
    new: "Nauja", contacted: "Susisiekta", qualified: "Tinkama", measuring: "Matuojama", draft_ready: "Juodraštis paruoštas", quoted: "Pasiūlymas paruoštas", customer_waiting: "Klientas laukia atsakymo", waiting_customer: "Laukiama kliento", converted: "Patvirtintas klientas", closed: "Uždaryta",
    draft: "Juodraštis", review_required: "Reikia patikrinti", approved: "Patvirtinta", blocked: "Sustabdyta", ready: "Paruošta", sent: "Išsiųsta", viewed: "Peržiūrėta", accepted: "Priimta", declined: "Atmesta", expired: "Nebegalioja", revoked: "Atšaukta", superseded: "Pakeista nauja versija", issued: "Pateikta klientui",
    signed: "Pasirašyta", customer_signed: "Klientas pasirašė", fully_signed: "Pasirašė abi šalys", queued: "Laukia siuntimo", delivered: "Pristatyta", failed: "Nepavyko", attention: "Reikia dėmesio", pending: "Laukiama",
    unassigned: "Nepriskirta", assigned: "Priskirta", scheduled: "Suplanuota", on_way: "Vykstama", arrived: "Atvykta", precheck: "Pirminė patikra", in_progress: "Vykdoma", completed: "Baigta", documented: "Dokumentuota", cancelled: "Atšaukta",
    ai_qa: "DI patikra", human_review: "Žmogaus peržiūra", published: "Publikuota",
    active: "Aktyvi", exported: "Eksportuota", needs_review: "Reikia patikrinti", awaiting_payment: "Laukiama apmokėjimo", paid: "Apmokėta", overdue: "Vėluoja", credited: "Kredituota",
    received: "Gauta", admin_review: "Laukia administratoriaus sprendimo", alternative_requested: "Ruošiamas alternatyvus pasiūlymas", follow_up_scheduled: "Kontaktas suplanuotas", recovered: "Klientas išsaugotas", do_not_contact: "Nebekontaktuoti",
  },
  en: {
    new: "New", contacted: "Contacted", qualified: "Qualified", measuring: "Measuring", draft_ready: "Draft ready", quoted: "Quote prepared", customer_waiting: "Customer awaiting reply", waiting_customer: "Waiting for customer", converted: "Confirmed customer", closed: "Closed",
    draft: "Draft", review_required: "Review required", approved: "Approved", blocked: "Blocked", ready: "Ready", sent: "Sent", viewed: "Viewed", accepted: "Accepted", declined: "Declined", expired: "Expired", revoked: "Revoked", superseded: "Superseded", issued: "Issued",
    signed: "Signed", customer_signed: "Customer signed", fully_signed: "Both parties signed", queued: "Queued", delivered: "Delivered", failed: "Failed", attention: "Needs attention", pending: "Pending",
    unassigned: "Unassigned", assigned: "Assigned", scheduled: "Scheduled", on_way: "On the way", arrived: "Arrived", precheck: "Pre-check", in_progress: "In progress", completed: "Completed", documented: "Documented", cancelled: "Cancelled",
    ai_qa: "AI QA", human_review: "Human review", published: "Published",
    active: "Active", exported: "Exported", needs_review: "Review required", awaiting_payment: "Awaiting payment", paid: "Paid", overdue: "Overdue", credited: "Credited",
    received: "Received", admin_review: "Awaiting administrator review", alternative_requested: "Alternative quote requested", follow_up_scheduled: "Follow-up scheduled", recovered: "Customer retained", do_not_contact: "Do not contact",
  },
};

const types: Record<PanelLocale, Record<string, string>> = {
  nb: { lead: "Henvendelse", message: "Melding", measurement: "Takmåling", price: "Prisberegning", quote: "Tilbud", contract: "Kontrakt", contract_request: "Angre- eller endringsmelding", work: "Arbeid", change: "Endringsavtale", invoice: "Fakturautkast", warranty: "Garanti" },
  lt: { lead: "Užklausa", message: "Žinutė", measurement: "Stogo matavimas", price: "Kainos skaičiavimas", quote: "Pasiūlymas", contract: "Sutartis", contract_request: "Atsisakymo arba pakeitimo pranešimas", work: "Darbas", change: "Pakeitimų susitarimas", invoice: "Sąskaitos juodraštis", warranty: "Garantija" },
  en: { lead: "Enquiry", message: "Message", measurement: "Roof measurement", price: "Price calculation", quote: "Quote", contract: "Contract", contract_request: "Withdrawal or change notice", work: "Work", change: "Change agreement", invoice: "Invoice draft", warranty: "Warranty" },
};

const metadata: Record<PanelLocale, Record<string, string>> = {
  nb: { inbound: "Innkommende", outbound: "Utgående", email: "E-post", sms: "SMS", receipt: "Mottaksbekreftelse", ai_reply: "AI-svar", quote: "Tilbud", contract: "Kontrakt", customer_question: "Kundespørsmål", follow_up: "Oppfølging", information_request: "Informasjonsforespørsel", completion: "Sluttdokumentasjon", invoice: "Faktura", reminder: "Påminnelse" },
  lt: { inbound: "Gaunama", outbound: "Siunčiama klientui", email: "El. paštas", sms: "SMS", receipt: "Užklausos patvirtinimas", ai_reply: "DI atsakymas", quote: "Pasiūlymas", contract: "Sutartis", customer_question: "Kliento klausimas", follow_up: "Tolesnis susisiekimas", information_request: "Informacijos prašymas", completion: "Baigiamieji dokumentai", invoice: "Sąskaita", reminder: "Priminimas" },
  en: { inbound: "Inbound", outbound: "Outbound", email: "Email", sms: "SMS", receipt: "Receipt", ai_reply: "AI reply", quote: "Quote", contract: "Contract", customer_question: "Customer question", follow_up: "Follow-up", information_request: "Information request", completion: "Completion documents", invoice: "Invoice", reminder: "Reminder" },
};

export function statusLabel(locale: PanelLocale, value?: string, options: { contract?: boolean; companySignedAt?: string } = {}) {
  if (!value) return "";
  if (options.contract && value === "issued") return locale === "lt" ? "Laukiama kliento parašo" : locale === "en" ? "Waiting for customer signature" : "Venter på kundens signatur";
  if (options.contract && value === "signed") {
    if (options.companySignedAt) return locale === "lt" ? "Pasirašyta abiejų šalių" : locale === "en" ? "Signed by both parties" : "Signert av begge parter";
    return locale === "lt" ? "Klientas pasirašė – laukiama mūsų parašo" : locale === "en" ? "Customer signed – awaiting our signature" : "Kunden har signert – venter på vår signatur";
  }
  return statuses[locale][value] || value.replaceAll("_", " ");
}

export function timelineTypeLabel(locale: PanelLocale, value: string) {
  return types[locale][value] || value;
}

export function metadataLabel(locale: PanelLocale, value: string) {
  return metadata[locale][value] || value.replaceAll("_", " ");
}
