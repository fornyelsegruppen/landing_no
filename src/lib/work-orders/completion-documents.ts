import { createBrandedPdf } from "@/lib/pdf/branded-pdf";
import { documentHash } from "@/lib/quotes/document";

export type InvoiceDraftSnapshot = {
  schemaVersion: "invoice-draft.v1";
  reference: string;
  workOrderReference: string;
  contractReference: string;
  customer: { name: string; address: string; email?: string };
  serviceDescription: string;
  issuedAt: string;
  dueAt: string;
  amounts: { subtotalExVatOre: number; vatOre: number; totalIncVatOre: number };
  notice: string;
};

export type WarrantySnapshot = {
  schemaVersion: "warranty.v1";
  reference: string;
  workOrderReference: string;
  contractReference: string;
  customer: { name: string; address: string };
  serviceDescription: string;
  scope: string;
  startsAt: string;
  endsAt: string;
  termsVersion: string;
};

export type CompletionConfirmationSnapshot = {
  schemaVersion: "completion-confirmation.v1";
  reference: string;
  workOrderReference: string;
  contractReference: string;
  customer: { name: string; address: string };
  serviceDescription: string;
  completedAt: string;
  reviewedAt: string;
  actualAreaTenths?: number;
  amounts: { subtotalExVatOre: number; vatOre: number; totalIncVatOre: number };
  beforePhotoCount: number;
  afterPhotoCount: number;
  completionNotes: string;
  reviewNote: string;
};

function nok(ore: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(ore / 100);
}

function norwayDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeZone: "Europe/Oslo" }).format(new Date(value));
}

export function completionDocumentHash(value: InvoiceDraftSnapshot | WarrantySnapshot | CompletionConfirmationSnapshot) {
  return documentHash(value);
}

export async function buildCompletionConfirmationPdf(snapshot: CompletionConfirmationSnapshot) {
  const pdf = await createBrandedPdf({ title: `Arbeids- og ferdigbekreftelse ${snapshot.reference}`, subject: "Dokumentasjon av utført takarbeid" });
  pdf.text("ARBEIDS- OG FERDIGBEKREFTELSE", { size: 18, strong: true, gap: 12 });
  pdf.section("Kunde og oppdrag");
  pdf.field("Kunde", snapshot.customer.name);
  pdf.field("Adresse", snapshot.customer.address);
  pdf.field("Oppdrag", snapshot.workOrderReference);
  pdf.field("Kontrakt", snapshot.contractReference);
  pdf.field("Tjeneste", snapshot.serviceDescription);
  pdf.section("Utført og kontrollert");
  pdf.field("Arbeid fullført", norwayDate(snapshot.completedAt));
  pdf.field("Administrativ sluttkontroll", norwayDate(snapshot.reviewedAt));
  if (typeof snapshot.actualAreaTenths === "number") pdf.field("Kontrollert takareal", `${(snapshot.actualAreaTenths / 10).toLocaleString("nb-NO")} m²`);
  pdf.field("Før-bilder", String(snapshot.beforePhotoCount));
  pdf.field("Etterbilder", String(snapshot.afterPhotoCount));
  pdf.text(snapshot.completionNotes, { gap: 8 });
  pdf.section("Kontrollert sluttgrunnlag");
  pdf.field("Ekskl. mva.", nok(snapshot.amounts.subtotalExVatOre));
  pdf.field("Mva.", nok(snapshot.amounts.vatOre));
  pdf.field("Totalt inkl. mva.", nok(snapshot.amounts.totalIncVatOre));
  pdf.text(snapshot.reviewNote, { gap: 8 });
  pdf.section("Dokumentkontroll");
  pdf.field("Dokument-ID", completionDocumentHash(snapshot));
  pdf.text("Dette dokumentet bekrefter utført arbeid og administrativ sluttkontroll. Det er ikke et kommersielt garantibevis. Kundens ufravikelige rettigheter etter håndverkertjenesteloven gjelder uavhengig av dokumentet.", { size: 8.5 });
  return pdf.finish();
}

export async function buildInvoiceDraftPdf(snapshot: InvoiceDraftSnapshot) {
  const pdf = await createBrandedPdf({ title: `Fakturautkast ${snapshot.reference}`, subject: "Internt fakturautkast – ikke bokført" });
  pdf.text("FAKTURAUTKAST – IKKE BOKFØRT", { size: 18, strong: true, gap: 8 });
  pdf.text(snapshot.notice, { size: 9.5, gap: 12 });
  pdf.section("Kunde og oppdrag");
  pdf.field("Kunde", snapshot.customer.name);
  pdf.field("Adresse", snapshot.customer.address);
  pdf.field("E-post", snapshot.customer.email);
  pdf.field("Oppdrag", snapshot.workOrderReference);
  pdf.field("Kontrakt", snapshot.contractReference);
  pdf.field("Tjeneste", snapshot.serviceDescription);
  pdf.section("Beløp");
  pdf.field("Ekskl. mva.", nok(snapshot.amounts.subtotalExVatOre));
  pdf.field("Mva.", nok(snapshot.amounts.vatOre));
  pdf.field("Totalt inkl. mva.", nok(snapshot.amounts.totalIncVatOre));
  pdf.field("Utkast opprettet", norwayDate(snapshot.issuedAt));
  pdf.field("Foreslått forfallsdato", norwayDate(snapshot.dueAt));
  pdf.section("Dokumentkontroll");
  pdf.field("Dokument-ID", completionDocumentHash(snapshot));
  pdf.text("Dette dokumentet er kun et administrativt utkast. Det er ikke et betalingskrav og må godkjennes og bokføres i valgt regnskapssystem før utsendelse.", { size: 8.5 });
  return pdf.finish();
}

export async function buildWarrantyPdf(snapshot: WarrantySnapshot) {
  const pdf = await createBrandedPdf({ title: `Garantibekreftelse ${snapshot.reference}`, subject: "Garantibekreftelse for utført takarbeid" });
  pdf.text("GARANTIBEKREFTELSE", { size: 18, strong: true, gap: 12 });
  pdf.section("Kunde og oppdrag");
  pdf.field("Kunde", snapshot.customer.name);
  pdf.field("Adresse", snapshot.customer.address);
  pdf.field("Oppdrag", snapshot.workOrderReference);
  pdf.field("Kontrakt", snapshot.contractReference);
  pdf.field("Tjeneste", snapshot.serviceDescription);
  pdf.section("Garanti");
  pdf.field("Gjelder fra", norwayDate(snapshot.startsAt));
  pdf.field("Gjelder til", norwayDate(snapshot.endsAt));
  pdf.field("Vilkårsversjon", snapshot.termsVersion);
  pdf.text(snapshot.scope, { gap: 10 });
  pdf.text("Garantien gjelder bare det skriftlig beskrevne arbeidsomfanget. Ved spørsmål eller reklamasjon, kontakt Takfornyelse med oppdragsreferansen over.", { size: 9 });
  pdf.section("Dokumentkontroll");
  pdf.field("Dokument-ID", completionDocumentHash(snapshot));
  return pdf.finish();
}
