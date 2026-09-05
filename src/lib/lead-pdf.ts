import type { LeadEmailInput } from "@/lib/lead-email";
import {
  getLeadAdminNotificationCopy,
  leadAdminServiceLabel,
  leadAdminUrl,
  leadCustomerLanguageLabel,
  leadGalleryUrl,
} from "@/lib/lead-email";
import type { PanelLocale } from "@/lib/panel-i18n";
import { createBrandedPdf } from "@/lib/pdf/branded-pdf";

function slugName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[øØ]/g, "o")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
      .toLowerCase() || "kunde"
  );
}

export function leadPdfFilename(
  input: LeadEmailInput,
  adminLocale: PanelLocale = "nb",
) {
  const prefix =
    adminLocale === "lt" ? "uzklausa" : adminLocale === "en" ? "enquiry" : "henvendelse";
  return `${prefix}-${input.id}-${slugName(input.name)}.pdf`;
}

export async function buildLeadPdf(
  input: LeadEmailInput,
  adminLocale: PanelLocale = "nb",
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Uint8Array> {
  const copy = getLeadAdminNotificationCopy(adminLocale);
  const isPreview = environment.VERCEL_ENV === "preview";
  const previewMarker = isPreview ? "PREVIEW TEST | " : "";
  const internalMarker =
    adminLocale === "lt"
      ? "VIDINIS ADMIN"
      : adminLocale === "en"
        ? "INTERNAL ADMIN"
        : "INTERN ADMIN";
  const caseLabel =
    adminLocale === "lt" ? "Byla" : adminLocale === "en" ? "Case" : "Sak";
  const noPhotos =
    adminLocale === "lt"
      ? "Kliento nuotraukos į PDF neįtrauktos. Naudokite apsaugotą galerijos nuorodą."
      : adminLocale === "en"
        ? "Customer images are not included in the PDF. Use the protected gallery link."
        : "Kundebilder er ikke lagt inn i PDF-en. Bruk den beskyttede gallerilenken.";
  const pdf = await createBrandedPdf({
    documentMarker: `${previewMarker}${internalMarker}`,
    requireUnicodeFonts: true,
    title: `${copy.lead} ${input.id}`,
    subject: copy.internalExplanation,
  });
  const dateLocale =
    adminLocale === "lt" ? "lt-LT" : adminLocale === "en" ? "en-GB" : "nb-NO";
  const created = new Date().toLocaleString(dateLocale, {
    dateStyle: "long",
    timeStyle: "short",
  });
  pdf.text(copy.internalLabel, { size: 19, strong: true, gap: 3 });
  pdf.text(copy.internalExplanation, { size: 9, gap: 6 });
  pdf.text(`${caseLabel} #${input.id} | ${created}`, { size: 9, gap: 8 });
  pdf.text(leadAdminServiceLabel(input.type, adminLocale), {
    size: 12,
    strong: true,
    gap: 10,
  });

  pdf.section(copy.contact);
  pdf.field(copy.name, input.name);
  pdf.field(copy.phone, input.phone);
  pdf.field(copy.postal, input.postal);
  pdf.field(copy.email, input.email);
  pdf.field(copy.address, input.address);

  pdf.section(copy.details);
  pdf.field(copy.service, leadAdminServiceLabel(input.type, adminLocale));
  pdf.field(copy.area, input.approxSqm);
  pdf.field(
    copy.customerLanguage,
    leadCustomerLanguageLabel(input.locale, adminLocale),
  );
  pdf.field(copy.images, String(input.photoUrls.length));
  pdf.field(copy.advertisingSource, input.utmSource);
  pdf.field("UTM-medium", input.utmMedium);
  pdf.field(copy.campaign, input.utmCampaign);
  pdf.field(copy.ad, input.utmContent);
  pdf.field(copy.keyword, input.utmTerm);
  pdf.field(copy.landingPage, input.landingPage);

  if (input.message?.trim()) {
    pdf.section(copy.customerMessage);
    pdf.text(input.message, { gap: 8 });
  }

  pdf.section(adminLocale === "lt" ? "Nuorodos" : adminLocale === "en" ? "Links" : "Lenker");
  pdf.link(copy.gallery, leadGalleryUrl(input.id, input.token));
  pdf.link(copy.openAdmin, leadAdminUrl(input.id));
  pdf.text(noPhotos, { size: 8.5 });
  return pdf.finish();
}
