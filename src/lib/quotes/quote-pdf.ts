import { rgb, type PDFImage } from "pdf-lib";
import {
  NORGE_I_BILDER_EXACT_ATTRIBUTION,
  assertNorgeIBilderScreenshotEvidence,
  isNorgeIBilderScreenshotSource,
} from "@/lib/measurements/evidence-policy";
import { createBrandedPdf, PDF_MARGIN, pdfSafe } from "@/lib/pdf/branded-pdf";
import { formatNorwayDateTime } from "@/lib/norway-time";
import { withdrawalFormCopy } from "@/content/withdrawal";
import { previewNonbindingDocumentBrand } from "@/lib/platform/preview-nonbinding-documents";
import {
  quoteDisplayModel,
  type CompanySignatureEvidenceRecord,
  type ContractSnapshot,
  type SignatureEvidenceRecord,
} from "./document";
import type { PdfMeasurementEvidence } from "./measurement-evidence";

function formatNok(value: number) {
  return value.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Signature = {
  evidence: { signerName: string; signedAt: string; signatureHash: string };
  image?: PDFImage;
  label: string;
  pendingLabel: string;
};

function drawSignatureBox(
  pdf: Awaited<ReturnType<typeof createBrandedPdf>>,
  signature: Signature,
  x: number,
  top: number,
  width: number,
) {
  const page = pdf.page();
  const height = 132;
  page.drawRectangle({
    x,
    y: top - height,
    width,
    height,
    color: rgb(0.975, 0.978, 0.985),
    borderColor: rgb(0.82, 0.84, 0.88),
    borderWidth: 1,
  });
  page.drawText(pdfSafe(signature.label), {
    x: x + 12,
    y: top - 20,
    size: 9,
    font: pdf.bold,
    color: rgb(0.35, 0.38, 0.44),
  });
  if (signature.image) {
    const scaled = signature.image.scaleToFit(width - 24, 52);
    page.drawImage(signature.image, {
      x: x + 12,
      y: top - 77,
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    page.drawText(pdfSafe(signature.pendingLabel), {
      x: x + 12,
      y: top - 58,
      size: 9,
      font: pdf.regular,
      color: rgb(0.5, 0.52, 0.57),
    });
  }
  page.drawLine({
    start: { x: x + 12, y: top - 83 },
    end: { x: x + width - 12, y: top - 83 },
    thickness: 0.6,
    color: rgb(0.55, 0.57, 0.62),
  });
  if (signature.evidence.signedAt) {
    page.drawText(pdfSafe(signature.evidence.signerName), {
      x: x + 12,
      y: top - 100,
      size: 9,
      font: pdf.bold,
      color: rgb(0.08, 0.09, 0.12),
    });
    page.drawText(
      pdfSafe(
        `${formatNorwayDateTime(signature.evidence.signedAt, "nb-NO", {
          dateStyle: "medium",
          timeStyle: "medium",
        })} (norsk tid)`,
      ),
      {
        x: x + 12,
        y: top - 116,
        size: 7.8,
        font: pdf.regular,
        color: rgb(0.35, 0.38, 0.44),
      },
    );
  }
}

export async function buildQuoteContractPdf(input: {
  contract: ContractSnapshot;
  signatureData?: string;
  evidence?: SignatureEvidenceRecord;
  companySignatureData?: string;
  companyEvidence?: CompanySignatureEvidenceRecord;
  measurementEvidence?: PdfMeasurementEvidence;
}) {
  const nonbindingBrand = previewNonbindingDocumentBrand("nb");
  const pdf = await createBrandedPdf({
    title: `${nonbindingBrand ? `${nonbindingBrand.marker} ` : ""}Tilbud og kontrakt ${input.contract.contractReference}`,
    subject: `${nonbindingBrand ? `${nonbindingBrand.marker} ` : ""}Tilbud, håndverkerkontrakt og angrerettinformasjon`,
    ...(nonbindingBrand ? { documentMarker: nonbindingBrand.marker } : {}),
  });
  const model = quoteDisplayModel(input.contract.quote);

  if (nonbindingBrand) {
    pdf.text(nonbindingBrand.marker, {
      size: 12.5,
      strong: true,
      color: rgb(0.58, 0.06, 0.06),
      gap: 5,
    });
    pdf.text(nonbindingBrand.description, {
      strong: true,
      color: rgb(0.42, 0.08, 0.08),
      gap: 12,
    });
  }
  pdf.text(`Tilbud og håndverkerkontrakt ${input.contract.contractReference}`, {
    size: 17,
    strong: true,
    gap: 12,
  });
  pdf.field(
    "Leverandør",
    `${input.contract.supplier.name}, org.nr. ${input.contract.supplier.orgNumber}`,
  );
  pdf.field("Adresse", input.contract.supplier.address);
  pdf.field(
    "Kontakt",
    `${input.contract.supplier.email} | ${input.contract.supplier.phone}`,
  );
  pdf.field("Kunde", input.contract.customer.name);
  pdf.field(
    "Kundekontakt",
    [input.contract.customer.email, input.contract.customer.phone]
      .filter(Boolean)
      .join(" | "),
  );
  pdf.field("Arbeidssted", input.contract.customer.address);

  pdf.section("Beregnet tak");
  const measurement = model.measurement;
  pdf.field(
    "Målereferanse",
    `TM-${input.contract.quote.leadId}-V${measurement.version}`,
  );
  if (measurement.mode !== "manual_no_visual") {
    pdf.field("Målt bygning", input.contract.quote.propertyAddress);
    pdf.field(
      "Horisontalt areal",
      `${(measurement.horizontalAreaTenths / 10).toLocaleString("nb-NO")} m²`,
    );
    if (
      measurement.angleMinDegrees != null &&
      measurement.angleMaxDegrees != null
    )
      pdf.field(
        "Takvinkel brukt i beregningen",
        `${measurement.angleMinDegrees}–${measurement.angleMaxDegrees}°`,
      );
    if (input.measurementEvidence) {
      pdf.ensure(245);
      const image =
        input.measurementEvidence.mimeType === "image/jpeg"
          ? await pdf.document.embedJpg(input.measurementEvidence.data)
          : await pdf.document.embedPng(input.measurementEvidence.data);
      const scaled = image.scaleToFit(pdf.contentWidth, 215);
      const top = pdf.y();
      pdf
        .page()
        .drawImage(image, {
          x: PDF_MARGIN,
          y: top - scaled.height,
          width: scaled.width,
          height: scaled.height,
        });
      pdf.setY(top - scaled.height - 9);
    } else if (
      measurement.mode === "schematic" ||
      measurement.mode === "schematic_with_context"
    ) {
      throw new Error(
        "Visual measurement evidence is required for this contract snapshot",
      );
    }
    if (isNorgeIBilderScreenshotSource(measurement.evidenceSource)) {
      assertNorgeIBilderScreenshotEvidence({
        source: measurement.evidenceSource,
        attribution: measurement.evidenceAttribution,
        capturedAt: measurement.imageryCapturedAt,
        trainingProhibited: measurement.evidenceTrainingProhibited,
      });
    }
    pdf.text(
      `Målekilde og attribusjon: ${
        isNorgeIBilderScreenshotSource(measurement.evidenceSource)
          ? NORGE_I_BILDER_EXACT_ATTRIBUTION
          : measurement.evidenceAttribution || model.credits
      }.`,
    );
  } else {
    pdf.field("Målemetode", "Manuelt kontrollert takareal uten kartvedlegg");
    pdf.field(
      "Kontrollert areal",
      `${(measurement.actualAreaMaxTenths / 10).toLocaleString("nb-NO")} m²`,
    );
    pdf.field("Grunnlag", measurement.manualAreaSource);
    pdf.field("Begrunnelse", measurement.manualAreaReason);
    pdf.field(
      "Kontrollert av",
      measurement.approvedByName || "Takfornyelse administrator",
    );
    pdf.field(
      "Kontrollert",
      measurement.approvedAt
        ? `${formatNorwayDateTime(measurement.approvedAt, "nb-NO", {
            dateStyle: "medium",
            timeStyle: "short",
          })} (norsk tid)`
        : undefined,
    );
  }
  pdf.text(
    "Takareal og takvinkel kontrolleres på stedet før arbeid starter. Et vesentlig avvik utover avtalt toleranse eller maksimalpris krever en skriftlig endringsavtale før arbeidet fortsetter.",
  );

  pdf.section("Oppdrag og prisgrunnlag");
  pdf.field("Tjeneste", model.service);
  pdf.field(
    "Estimert takareal",
    `${model.estimatedAreaMin.toLocaleString("nb-NO")} - ${model.estimatedAreaMax.toLocaleString("nb-NO")} m²`,
  );
  pdf.field(
    "Enhetspris eks. mva.",
    `${formatNok(model.unitPriceExVatNok)} kr/m²`,
  );
  pdf.field("Pris eks. mva.", `${formatNok(model.subtotalExVatNok)} kr`);
  pdf.field(`Mva. ${model.vatPercent}%`, `${formatNok(model.vatNok)} kr`);
  pdf.field("Pris inkl. mva.", `${formatNok(model.totalIncVatNok)} kr`);
  if (model.maximumTotalIncVatNok != null)
    pdf.field(
      "Avtalt maksimalpris inkl. mva.",
      `${formatNok(model.maximumTotalIncVatNok)} kr`,
    );
  if (model.depositPercent > 0) {
    pdf.field(
      `Avtalt forskudd (${formatNok(model.depositPercent)} %)`,
      `${formatNok(model.depositAmountIncVatNok)} kr`,
    );
    pdf.text(
      "Forskuddet forfaller senest 2 kalenderdager etter at avtalen er signert. Betaling og mottak følges opp skriftlig av Takfornyelse.",
    );
  } else {
    pdf.field("Forskudd", "Ingen forskuddsbetaling avtalt");
  }
  pdf.field("Tillatt måleavvik", `${model.tolerancePercent}%`);
  pdf.field(
    "Tilbud gyldig til",
    new Date(model.validUntil).toLocaleDateString("nb-NO"),
  );

  pdf.section("Forutsetninger");
  model.assumptions.forEach((assumption) =>
    pdf.text(`- ${assumption}`, { gap: 7 }),
  );
  pdf.text(`Kart-/målekilde: ${model.source}. ${model.credits}`);

  pdf.section("Avtalevilkår");
  pdf.text(input.contract.terms.text, { gap: 8 });

  // Keep the withdrawal information and its form together as one intentional
  // document section. Without this break, a long terms version can leave only
  // one or two continuation lines on an otherwise empty page before the form.
  pdf.addPage();
  pdf.section("Angrerett");
  pdf.text(input.contract.terms.withdrawalInstructions);
  pdf.field("Standard angreskjema", input.contract.terms.withdrawalFormUrl);

  if (input.evidence) {
    pdf.ensure(178);
    pdf.section("Signaturer");
    const customerImage = input.signatureData
      ? await pdf.embedSignature(input.signatureData)
      : undefined;
    const companyImage = input.companySignatureData
      ? await pdf.embedSignature(input.companySignatureData)
      : undefined;
    const top = pdf.y();
    const gap = 12;
    const boxWidth = (pdf.contentWidth - gap) / 2;
    drawSignatureBox(
      pdf,
      {
        evidence: input.evidence,
        image: customerImage,
        label: "Kunde",
        pendingLabel: "Kundens signatur er registrert",
      },
      PDF_MARGIN,
      top,
      boxWidth,
    );
    drawSignatureBox(
      pdf,
      {
        evidence: input.companyEvidence ?? {
          signerName: "Takfornyelse",
          signedAt: "",
          signatureHash: "",
        },
        image: companyImage,
        label: "Leverandør",
        pendingLabel: input.companyEvidence
          ? "Signaturen er registrert"
          : "Avventer leverandørens signatur",
      },
      PDF_MARGIN + boxWidth + gap,
      top,
      boxWidth,
    );
    pdf.setY(top - 143);
    pdf.text(
      `Dokumentkontroll: ${input.evidence.documentHash.slice(0, 16)}… | Kundesignatur: ${input.evidence.signatureHash.slice(0, 16)}…${input.companyEvidence ? ` | Leverandørsignatur: ${input.companyEvidence.signatureHash.slice(0, 16)}…` : ""}`,
      { size: 7.3, color: rgb(0.38, 0.4, 0.46), gap: 8 },
    );
  }

  // In an unsigned draft the form fits below the withdrawal information. A
  // signed document includes the signature block above, so ensure() starts a
  // fresh page only when the complete form would no longer fit.
  pdf.ensure(330);
  const withdrawal = withdrawalFormCopy.no;
  pdf.text(withdrawal.title, { size: 16, strong: true, gap: 12 });
  pdf.text(`${withdrawal.intro} ${withdrawal.deadline}`);
  pdf.field(
    "Til",
    `${input.contract.supplier.name}, ${input.contract.supplier.address}, ${input.contract.supplier.email}`,
  );
  pdf.text(withdrawal.declaration, { gap: 20 });
  pdf.field(withdrawal.fields.reference, input.contract.contractReference);
  pdf.field(
    withdrawal.fields.service,
    `${model.service} – ${input.contract.quote.propertyAddress}`,
  );
  pdf.field(
    withdrawal.fields.agreementDate,
    input.evidence
      ? formatNorwayDateTime(input.evidence.signedAt, "nb-NO", {
          dateStyle: "short",
        })
      : "________________________________",
  );
  pdf.field(withdrawal.fields.customerName, input.contract.customer.name);
  pdf.field(withdrawal.fields.customerAddress, input.contract.customer.address);
  pdf.text(
    `${withdrawal.fields.date}: ______________________________________________`,
    { gap: 16 },
  );
  pdf.text(`${withdrawal.fields.signature}: ______________________________`);
  return pdf.finish();
}
