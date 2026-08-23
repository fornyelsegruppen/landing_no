import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { quoteDisplayModel, type ContractSnapshot, type SignatureEvidenceRecord } from "./document";

function safe(value: string) {
  return value.normalize("NFKC").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function formatNok(value: number) {
  return value.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function buildQuoteContractPdf(input: {
  contract: ContractSnapshot;
  signatureData?: string;
  evidence?: SignatureEvidenceRecord;
}) {
  const document = await PDFDocument.create();
  document.setTitle(`Tilbud og kontrakt ${input.contract.contractReference}`);
  document.setAuthor(input.contract.supplier.name);
  document.setSubject("Tilbud, håndverkerkontrakt og angrerettinformasjon");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28; const height = 841.89; const margin = 48;
  let page = document.addPage([width, height]); let y = height - margin;

  const wrap = (text: string, font: PDFFont, size: number, maxWidth = width - margin * 2) => {
    const lines: string[] = [];
    for (const paragraph of safe(text).split(/\r?\n/)) {
      const words = paragraph.split(/\s+/); let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
        else { if (line) lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines;
  };
  const ensure = (needed: number) => { if (y - needed < margin) { page = document.addPage([width, height]); y = height - margin; } };
  const text = (value: string, options: { size?: number; strong?: boolean; gap?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const size = options.size ?? 10; const font = options.strong ? bold : regular; const lines = wrap(value, font, size);
    for (const line of lines) { ensure(size * 1.5); if (line) page.drawText(line, { x: margin, y, size, font, color: options.color ?? rgb(.08, .09, .12) }); y -= size * 1.45; }
    y -= options.gap ?? 3;
  };
  const field = (label: string, value: string) => text(`${label}: ${value}`);
  const model = quoteDisplayModel(input.contract.quote);

  text("TAKFORNYELSE", { size: 18, strong: true, color: rgb(.9, .58, .05), gap: 2 });
  text(`Tilbud og håndverkerkontrakt ${input.contract.contractReference}`, { size: 16, strong: true, gap: 12 });
  field("Leverandør", `${input.contract.supplier.name}, org.nr. ${input.contract.supplier.orgNumber}`);
  field("Adresse", input.contract.supplier.address);
  field("Kontakt", `${input.contract.supplier.email} | ${input.contract.supplier.phone}`);
  field("Kunde", input.contract.customer.name);
  field("Arbeidssted", input.contract.customer.address);
  text("Oppdrag og beregningsgrunnlag", { size: 13, strong: true, gap: 6 });
  field("Tjeneste", model.service);
  field("Estimert takareal", `${model.estimatedAreaMin.toLocaleString("nb-NO")} - ${model.estimatedAreaMax.toLocaleString("nb-NO")} m²`);
  field("Enhetspris eks. mva.", `${formatNok(model.unitPriceExVatNok)} kr/m²`);
  field("Pris eks. mva.", `${formatNok(model.subtotalExVatNok)} kr`);
  field(`Mva. ${model.vatPercent}%`, `${formatNok(model.vatNok)} kr`);
  field("Pris inkl. mva.", `${formatNok(model.totalIncVatNok)} kr`);
  if (model.maximumTotalIncVatNok != null) field("Avtalt maksimalpris inkl. mva.", `${formatNok(model.maximumTotalIncVatNok)} kr`);
  field("Tillatt måleavvik", `${model.tolerancePercent}%`);
  field("Tilbud gyldig til", new Date(model.validUntil).toLocaleDateString("nb-NO"));
  text("Forutsetninger", { size: 13, strong: true, gap: 6 });
  model.assumptions.forEach((assumption) => text(`- ${assumption}`));
  text(`Kart-/målekilde: ${model.source}. ${model.credits}`);
  text("Avtalevilkår", { size: 13, strong: true, gap: 6 });
  text(input.contract.terms.text, { gap: 8 });
  text("Angrerett", { size: 13, strong: true, gap: 6 });
  text(input.contract.terms.withdrawalInstructions);
  field("Standard angreskjema", input.contract.terms.withdrawalFormUrl);

  if (input.evidence) {
    text("Elektronisk signatur", { size: 13, strong: true, gap: 6 });
    field("Signert av", input.evidence.signerName);
    field("Signert", new Date(input.evidence.signedAt).toLocaleString("nb-NO"));
    field("Dokumenthash", input.evidence.documentHash);
    field("Signaturhash", input.evidence.signatureHash);
    field("Tidlig oppstart uttrykkelig bedt om", input.evidence.earlyStartRequested ? "Ja" : "Nei");
    if (input.signatureData) {
      const bytes = Buffer.from(input.signatureData.split(",")[1] ?? "", "base64");
      const image = await document.embedPng(bytes);
      ensure(100); page.drawImage(image, { x: margin, y: y - 80, width: 180, height: 80 }); y -= 94;
    }
  }

  page = document.addPage([width, height]); y = height - margin;
  text("Standard angreskjema - tjenesteavtale", { size: 16, strong: true, gap: 12 });
  text("Fyll ut og send denne siden eller en annen utvetydig melding dersom du vil bruke angreretten. Fristen er normalt 14 dager fra avtaleinngåelsen, med forbehold om gjeldende lov og opplysningene du har mottatt.");
  field("Til", `${input.contract.supplier.name}, ${input.contract.supplier.address}, ${input.contract.supplier.email}`);
  text("Jeg meddeler herved at jeg ønsker å gå fra avtalen om følgende tjeneste:", { gap: 20 });
  field("Tilbuds-/kontraktsreferanse", input.contract.contractReference);
  field("Kundens navn", input.contract.customer.name);
  field("Kundens adresse", input.contract.customer.address);
  text("Dato: ______________________________________________", { gap: 16 });
  text("Signatur (bare dersom skjemaet sendes på papir): ______________________________");
  return document.save();
}
