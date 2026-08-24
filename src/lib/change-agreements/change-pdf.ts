import { createBrandedPdf } from "@/lib/pdf/branded-pdf";
import type { ChangeAgreementSnapshot } from "./document";

const nok = (ore: number) => (ore / 100).toLocaleString("nb-NO", { style: "currency", currency: "NOK" });

export async function buildAcceptedChangePdf(snapshot: ChangeAgreementSnapshot, evidence?: { customerName: string; acceptedAt: string; documentHash: string }) {
  const pdf = await createBrandedPdf({ title: `Endringsavtale ${snapshot.reference}`, subject: "Endringsavtale til håndverkerkontrakt" });
  pdf.text(`Endringsavtale ${snapshot.reference}`, { size: 17, strong: true, gap: 12 });
  pdf.section("Endringen");
  pdf.field("Årsak", snapshot.reasonDescription);
  pdf.field("Areal før", `${(snapshot.before.areaTenths / 10).toLocaleString("nb-NO")} m²`);
  pdf.field("Kontrollmålt areal", `${(snapshot.after.areaTenths / 10).toLocaleString("nb-NO")} m²`);
  pdf.field("Pris før inkl. mva.", nok(snapshot.before.totalIncVatOre));
  if (snapshot.before.maximumTotalIncVatOre !== null) pdf.field("Tidligere maksimalpris", nok(snapshot.before.maximumTotalIncVatOre));
  pdf.field("Ny pris eks. mva.", nok(snapshot.after.subtotalExVatOre));
  pdf.field("Mva.", nok(snapshot.after.vatOre));
  pdf.text(`Ny pris inkl. mva.: ${nok(snapshot.after.totalIncVatOre)}`, { size: 12, strong: true, gap: 10 });
  pdf.section("Godkjenning");
  if (evidence) {
    pdf.field("Skriftlig akseptert av", evidence.customerName);
    pdf.field("Tidspunkt", new Date(evidence.acceptedAt).toLocaleString("nb-NO"));
    pdf.field("Dokumentkontroll", `${evidence.documentHash.slice(0, 24)}…`);
  } else {
    pdf.text("Status: Ikke akseptert", { strong: true });
  }
  return pdf.finish();
}
