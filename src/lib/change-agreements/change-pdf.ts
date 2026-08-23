import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ChangeAgreementSnapshot } from "./document";

const nok = (ore: number) => (ore / 100).toLocaleString("nb-NO", { style: "currency", currency: "NOK" });

export async function buildAcceptedChangePdf(snapshot: ChangeAgreementSnapshot, evidence?: { customerName: string; acceptedAt: string; documentHash: string }) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold); let y = 790;
  const line = (value: string, strong = false, size = 11) => { page.drawText(value.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"), { x: 50, y, size, font: strong ? bold : regular, color: rgb(.05, .06, .09) }); y -= size * 1.7; };
  line("TAKFORNYELSE", true, 18); line(`Akseptert endringsavtale ${snapshot.reference}`, true, 16); y -= 8;
  line(`Årsak: ${snapshot.reasonDescription}`); line(`Areal før: ${(snapshot.before.areaTenths / 10).toLocaleString("nb-NO")} m²`); line(`Kontrollmålt areal: ${(snapshot.after.areaTenths / 10).toLocaleString("nb-NO")} m²`);
  line(`Pris før inkl. mva.: ${nok(snapshot.before.totalIncVatOre)}`); if (snapshot.before.maximumTotalIncVatOre !== null) line(`Tidligere maksimalpris: ${nok(snapshot.before.maximumTotalIncVatOre)}`);
  line(`Ny pris eks. mva.: ${nok(snapshot.after.subtotalExVatOre)}`); line(`Mva.: ${nok(snapshot.after.vatOre)}`); line(`Ny pris inkl. mva.: ${nok(snapshot.after.totalIncVatOre)}`, true);
  y -= 12;
  if (evidence) {
    line(`Skriftlig akseptert av: ${evidence.customerName}`); line(`Tidspunkt: ${new Date(evidence.acceptedAt).toLocaleString("nb-NO")}`); line(`Dokumenthash: ${evidence.documentHash}`, false, 8);
  } else {
    line("Status: Ikke akseptert", true);
  }
  return pdf.save();
}
