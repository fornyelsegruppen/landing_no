import { rgb, type PDFImage } from "pdf-lib";
import { createBrandedPdf, PDF_MARGIN, pdfSafe } from "@/lib/pdf/branded-pdf";
import {
  quoteDisplayModel,
  type CompanySignatureEvidenceRecord,
  type ContractSnapshot,
  type SignatureEvidenceRecord,
} from "./document";

function formatNok(value: number) {
  return value.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Signature = {
  evidence: { signerName: string; signedAt: string; signatureHash: string };
  image?: PDFImage;
  label: string;
  pendingLabel: string;
};

function drawSignatureBox(pdf: Awaited<ReturnType<typeof createBrandedPdf>>, signature: Signature, x: number, top: number, width: number) {
  const page = pdf.page();
  const height = 132;
  page.drawRectangle({ x, y: top - height, width, height, color: rgb(.975, .978, .985), borderColor: rgb(.82, .84, .88), borderWidth: 1 });
  page.drawText(pdfSafe(signature.label), { x: x + 12, y: top - 20, size: 9, font: pdf.bold, color: rgb(.35, .38, .44) });
  if (signature.image) {
    const scaled = signature.image.scaleToFit(width - 24, 52);
    page.drawImage(signature.image, { x: x + 12, y: top - 77, width: scaled.width, height: scaled.height });
  } else {
    page.drawText(pdfSafe(signature.pendingLabel), { x: x + 12, y: top - 58, size: 9, font: pdf.regular, color: rgb(.5, .52, .57) });
  }
  page.drawLine({ start: { x: x + 12, y: top - 83 }, end: { x: x + width - 12, y: top - 83 }, thickness: .6, color: rgb(.55, .57, .62) });
  if (signature.evidence.signedAt) {
    page.drawText(pdfSafe(signature.evidence.signerName), { x: x + 12, y: top - 100, size: 9, font: pdf.bold, color: rgb(.08, .09, .12) });
    page.drawText(pdfSafe(new Date(signature.evidence.signedAt).toLocaleString("nb-NO")), { x: x + 12, y: top - 116, size: 7.8, font: pdf.regular, color: rgb(.35, .38, .44) });
  }
}

export async function buildQuoteContractPdf(input: {
  contract: ContractSnapshot;
  signatureData?: string;
  evidence?: SignatureEvidenceRecord;
  companySignatureData?: string;
  companyEvidence?: CompanySignatureEvidenceRecord;
}) {
  const pdf = await createBrandedPdf({
    title: `Tilbud og kontrakt ${input.contract.contractReference}`,
    subject: "Tilbud, håndverkerkontrakt og angrerettinformasjon",
  });
  const model = quoteDisplayModel(input.contract.quote);

  pdf.text(`Tilbud og håndverkerkontrakt ${input.contract.contractReference}`, { size: 17, strong: true, gap: 12 });
  pdf.field("Leverandør", `${input.contract.supplier.name}, org.nr. ${input.contract.supplier.orgNumber}`);
  pdf.field("Adresse", input.contract.supplier.address);
  pdf.field("Kontakt", `${input.contract.supplier.email} | ${input.contract.supplier.phone}`);
  pdf.field("Kunde", input.contract.customer.name);
  pdf.field("Arbeidssted", input.contract.customer.address);

  pdf.section("Oppdrag og beregningsgrunnlag");
  pdf.field("Tjeneste", model.service);
  pdf.field("Estimert takareal", `${model.estimatedAreaMin.toLocaleString("nb-NO")} - ${model.estimatedAreaMax.toLocaleString("nb-NO")} m²`);
  pdf.field("Enhetspris eks. mva.", `${formatNok(model.unitPriceExVatNok)} kr/m²`);
  pdf.field("Pris eks. mva.", `${formatNok(model.subtotalExVatNok)} kr`);
  pdf.field(`Mva. ${model.vatPercent}%`, `${formatNok(model.vatNok)} kr`);
  pdf.field("Pris inkl. mva.", `${formatNok(model.totalIncVatNok)} kr`);
  if (model.maximumTotalIncVatNok != null) pdf.field("Avtalt maksimalpris inkl. mva.", `${formatNok(model.maximumTotalIncVatNok)} kr`);
  pdf.field("Tillatt måleavvik", `${model.tolerancePercent}%`);
  pdf.field("Tilbud gyldig til", new Date(model.validUntil).toLocaleDateString("nb-NO"));

  pdf.section("Forutsetninger");
  model.assumptions.forEach((assumption) => pdf.text(`- ${assumption}`));
  pdf.text(`Kart-/målekilde: ${model.source}. ${model.credits}`);

  pdf.section("Avtalevilkår");
  pdf.text(input.contract.terms.text, { gap: 8 });
  pdf.section("Angrerett");
  pdf.text(input.contract.terms.withdrawalInstructions);
  pdf.field("Standard angreskjema", input.contract.terms.withdrawalFormUrl);

  if (input.evidence) {
    pdf.ensure(178);
    pdf.section("Signaturer");
    const customerImage = input.signatureData ? await pdf.embedSignature(input.signatureData) : undefined;
    const companyImage = input.companySignatureData ? await pdf.embedSignature(input.companySignatureData) : undefined;
    const top = pdf.y();
    const gap = 12;
    const boxWidth = (pdf.contentWidth - gap) / 2;
    drawSignatureBox(pdf, { evidence: input.evidence, image: customerImage, label: "Kunde", pendingLabel: "Kundens signatur er registrert" }, PDF_MARGIN, top, boxWidth);
    drawSignatureBox(pdf, {
      evidence: input.companyEvidence ?? { signerName: "Takfornyelse", signedAt: "", signatureHash: "" },
      image: companyImage,
      label: "Leverandør",
      pendingLabel: input.companyEvidence ? "Signaturen er registrert" : "Avventer leverandørens signatur",
    }, PDF_MARGIN + boxWidth + gap, top, boxWidth);
    pdf.setY(top - 143);
    pdf.text(`Dokumentkontroll: ${input.evidence.documentHash.slice(0, 16)}… | Kundesignatur: ${input.evidence.signatureHash.slice(0, 16)}…${input.companyEvidence ? ` | Leverandørsignatur: ${input.companyEvidence.signatureHash.slice(0, 16)}…` : ""}`, { size: 7.3, color: rgb(.38, .4, .46), gap: 8 });
  }

  pdf.addPage();
  pdf.text("Standard angreskjema - tjenesteavtale", { size: 16, strong: true, gap: 12 });
  pdf.text("Fyll ut og send denne siden eller en annen utvetydig melding dersom du vil bruke angreretten. Fristen er normalt 14 dager fra avtaleinngåelsen, med forbehold om gjeldende lov og opplysningene du har mottatt.");
  pdf.field("Til", `${input.contract.supplier.name}, ${input.contract.supplier.address}, ${input.contract.supplier.email}`);
  pdf.text("Jeg meddeler herved at jeg ønsker å gå fra avtalen om følgende tjeneste:", { gap: 20 });
  pdf.field("Tilbuds-/kontraktsreferanse", input.contract.contractReference);
  pdf.field("Kundens navn", input.contract.customer.name);
  pdf.field("Kundens adresse", input.contract.customer.address);
  pdf.text("Dato: ______________________________________________", { gap: 16 });
  pdf.text("Signatur (bare dersom skjemaet sendes på papir): ______________________________");
  return pdf.finish();
}
