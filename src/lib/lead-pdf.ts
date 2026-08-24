import type { LeadEmailInput } from "@/lib/lead-email";
import { leadAdminUrl, leadGalleryUrl } from "@/lib/lead-email";
import { inquiryTypeLabelNo, languageLabelNo } from "@/lib/inquiry-labels";
import { createBrandedPdf } from "@/lib/pdf/branded-pdf";

function slugName(name: string) {
  return name.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).toLowerCase() || "kunde";
}

export function leadPdfFilename(input: LeadEmailInput) {
  return `henvendelse-${input.id}-${slugName(input.name)}.pdf`;
}

export async function buildLeadPdf(input: LeadEmailInput): Promise<Uint8Array> {
  const pdf = await createBrandedPdf({ title: `Henvendelse ${input.id}`, subject: "Kundens henvendelse til Takfornyelse" });
  const created = new Date().toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" });
  pdf.text("Ny henvendelse", { size: 19, strong: true, gap: 3 });
  pdf.text(`Sak #${input.id} | ${created}`, { size: 9, gap: 8 });
  pdf.text(inquiryTypeLabelNo(input.type), { size: 12, strong: true, gap: 10 });

  pdf.section("Kontakt");
  pdf.field("Navn", input.name);
  pdf.field("Telefon", input.phone);
  pdf.field("Postnummer", input.postal);
  pdf.field("E-post", input.email);
  pdf.field("Adresse", input.address);

  pdf.section("Detaljer");
  pdf.field("Tjeneste", inquiryTypeLabelNo(input.type));
  pdf.field("Ca. m²", input.approxSqm);
  pdf.field("Språk", languageLabelNo(input.locale));
  pdf.field("Antall bilder", String(input.photoUrls.length));
  pdf.field("UTM-kilde", input.utmSource);
  pdf.field("UTM-medium", input.utmMedium);
  pdf.field("Kampanje", input.utmCampaign);
  pdf.field("Annonse", input.utmContent);
  pdf.field("Søkeord", input.utmTerm);
  pdf.field("Landingsside", input.landingPage);

  if (input.message?.trim()) {
    pdf.section("Kundens melding");
    pdf.text(input.message.trim(), { gap: 8 });
  }

  pdf.section("Lenker");
  pdf.link("Åpne bildegalleri", leadGalleryUrl(input.id, input.token));
  pdf.link("Åpne saken i administrasjonen", leadAdminUrl(input.id));
  pdf.text("Kundebilder er ikke lagt inn i PDF-en. Bruk den beskyttede gallerilenken.", { size: 8.5 });
  return pdf.finish();
}
