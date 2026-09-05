import { siteConfig } from "@/lib/site";
import type { LeadAttribution } from "@/lib/lead-attribution";
import type { PanelLocale } from "@/lib/panel-i18n";

export type LeadEmailInput = LeadAttribution & {
  id: string | number;
  token: string;
  name: string;
  phone?: string;
  postal: string;
  type: string;
  locale: string;
  email?: string;
  address?: string;
  approxSqm?: number;
  message?: string;
  photoUrls: string[];
};

const adminNotificationCopies = {
  nb: {
    address: "Adresse",
    ad: "Annonse",
    advertisingSource: "Reklamekilde",
    admin: "Admin",
    area: "Ca. m²",
    campaign: "Kampanje",
    contact: "Kontakt",
    customerLanguage: "Kundespråk",
    customerMessage: "Kundens opprinnelige melding",
    details: "Detaljer",
    email: "E-post",
    emailHtmlLang: "nb",
    gallery: "Åpne bilder",
    image: "Bilde",
    images: "Bilder",
    internalExplanation:
      "Dette er et internt administrasjonsvarsel. Det er ikke sendt til kunden.",
    internalLabel: "Internt administrasjonsvarsel",
    keyword: "Søkeord",
    landingPage: "Landingsside",
    lead: "Henvendelse",
    marketingConsent: "Markedsføringssamtykke",
    moreImages: "flere bilder i galleriet",
    name: "Navn",
    openAdmin: "Åpne i admin",
    pdfIncluded: "PDF-vedlegg med henvendelsesinfo er inkludert (uten bilder).",
    phone: "Telefon",
    postal: "Postnummer",
    replyHint: "Svar på denne e-posten for å kontakte kunden",
    referrer: "Henviser",
    seeAllImages: "Se alle bilder",
    service: "Tjeneste",
    subject: "Internt adminvarsel | Ny henvendelse",
    title: "Ny henvendelse",
  },
  lt: {
    address: "Adresas",
    ad: "Skelbimas",
    advertisingSource: "Reklamos šaltinis",
    admin: "Administravimas",
    area: "Apytikslis plotas, m²",
    campaign: "Kampanija",
    contact: "Kontaktai",
    customerLanguage: "Kliento kalba",
    customerMessage: "Originali kliento žinutė",
    details: "Informacija",
    email: "El. paštas",
    emailHtmlLang: "lt",
    gallery: "Atidaryti nuotraukas",
    image: "Nuotrauka",
    images: "Nuotraukos",
    internalExplanation:
      "Tai vidinis administratoriaus pranešimas. Klientui jis nesiunčiamas.",
    internalLabel: "Vidinis administratoriaus pranešimas",
    keyword: "Paieškos žodis",
    landingPage: "Nukreipimo puslapis",
    lead: "Užklausa",
    marketingConsent: "Rinkodaros sutikimas",
    moreImages: "daugiau nuotraukų galerijoje",
    name: "Vardas",
    openAdmin: "Atidaryti administravimo skydelyje",
    pdfIncluded: "Pridėta užklausos PDF santrauka (be nuotraukų).",
    phone: "Telefonas",
    postal: "Pašto kodas",
    replyHint: "Atsakykite į šį laišką, kad susisiektumėte su klientu",
    referrer: "Nukreipimo šaltinis",
    seeAllImages: "Peržiūrėti visas nuotraukas",
    service: "Paslauga",
    subject: "Vidinis administratoriaus pranešimas | Nauja užklausa",
    title: "Nauja užklausa",
  },
  en: {
    address: "Address",
    ad: "Advertisement",
    advertisingSource: "Advertising source",
    admin: "Admin",
    area: "Approx. m²",
    campaign: "Campaign",
    contact: "Contact",
    customerLanguage: "Customer language",
    customerMessage: "Original customer message",
    details: "Details",
    email: "Email",
    emailHtmlLang: "en",
    gallery: "Open images",
    image: "Image",
    images: "Images",
    internalExplanation:
      "This is an internal administrator notification. It was not sent to the customer.",
    internalLabel: "Internal administrator notification",
    keyword: "Keyword",
    landingPage: "Landing page",
    lead: "Enquiry",
    marketingConsent: "Marketing consent",
    moreImages: "more images in the gallery",
    name: "Name",
    openAdmin: "Open in admin",
    pdfIncluded: "An enquiry summary PDF is attached (without images).",
    phone: "Phone",
    postal: "Postal code",
    replyHint: "Reply to this email to contact the customer",
    referrer: "Referrer",
    seeAllImages: "View all images",
    service: "Service",
    subject: "Internal admin notification | New enquiry",
    title: "New enquiry",
  },
} as const;

const serviceLabels: Record<PanelLocale, Record<string, string>> = {
  nb: {
    impregnering: "Impregnering",
    kledning: "Kledning (eldre)",
    nytt_tak: "Nytt tak",
    takmaling: "Takmaling",
    takvask: "Takvask",
    takvask_impregnering: "Takvask + impregnering",
    usikker: "Usikker – taksjekk",
    vedlikehold: "Vedlikehold (eldre)",
  },
  lt: {
    impregnering: "Impregnavimas",
    kledning: "Apdaila (senesnė paslauga)",
    nytt_tak: "Naujas stogas",
    takmaling: "Stogo dažymas",
    takvask: "Stogo plovimas",
    takvask_impregnering: "Stogo plovimas ir impregnavimas",
    usikker: "Nežinoma – stogo patikra",
    vedlikehold: "Priežiūra (senesnė paslauga)",
  },
  en: {
    impregnering: "Impregnation",
    kledning: "Cladding (legacy)",
    nytt_tak: "New roof",
    takmaling: "Roof painting",
    takvask: "Roof cleaning",
    takvask_impregnering: "Roof cleaning + impregnation",
    usikker: "Unsure – roof inspection",
    vedlikehold: "Maintenance (legacy)",
  },
};

export function getLeadAdminNotificationCopy(locale: PanelLocale) {
  return adminNotificationCopies[locale];
}

export function leadAdminServiceLabel(type: string, locale: PanelLocale) {
  return serviceLabels[locale][type] || type;
}

export function leadCustomerLanguageLabel(
  customerLocale: string,
  adminLocale: PanelLocale,
) {
  const english = customerLocale === "en";
  if (adminLocale === "lt") return english ? "Anglų" : "Norvegų";
  if (adminLocale === "en") return english ? "English" : "Norwegian";
  return english ? "Engelsk" : "Norsk";
}

function attributionSummary(input: LeadEmailInput) {
  const source = [input.utmSource, input.utmMedium].filter(Boolean).join(" / ");
  return (
    source ||
    (input.gclid || input.gbraid || input.wbraid
      ? "Google Ads"
      : input.fbclid
        ? "Meta"
        : "Direct / unknown")
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function leadGalleryUrl(id: string | number, token: string) {
  const base = siteConfig.url.replace(/\/$/, "");
  return `${base}/henvendelse/${id}?token=${encodeURIComponent(token)}`;
}

export function leadBlobUrl(opts: {
  id: string | number;
  token: string;
  url: string;
  download?: boolean;
}) {
  const base = siteConfig.url.replace(/\/$/, "");
  const params = new URLSearchParams({
    id: String(opts.id),
    token: opts.token,
    url: opts.url,
  });
  if (opts.download) params.set("download", "1");
  return `${base}/api/lead/blob?${params.toString()}`;
}

export function leadAdminUrl(id: string | number) {
  const base = siteConfig.url.replace(/\/$/, "");
  return `${base}/admin/collections/leads/${id}`;
}

function row(label: string, valueHtml: string) {
  return `
    <tr>
      <td style="padding:8px 0;color:#9aa3b2;font-size:13px;width:120px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;color:#f4f6f8;font-size:15px;font-weight:600;vertical-align:top;">${valueHtml}</td>
    </tr>`;
}

export function buildLeadEmailSubject(
  input: LeadEmailInput,
  adminLocale: PanelLocale = "nb",
) {
  const copy = getLeadAdminNotificationCopy(adminLocale);
  const typeLabel = leadAdminServiceLabel(input.type, adminLocale);
  return `${copy.subject}: ${input.name} (${typeLabel})`;
}

export function buildLeadEmailText(
  input: LeadEmailInput,
  adminLocale: PanelLocale = "nb",
) {
  const copy = getLeadAdminNotificationCopy(adminLocale);
  const gallery = leadGalleryUrl(input.id, input.token);
  const originalMessage = input.message?.trim() ? input.message : null;
  const lines = [
    `${copy.internalLabel} – Takfornyelse`,
    copy.internalExplanation,
    "",
    `${copy.name}: ${input.name}`,
    input.phone ? `${copy.phone}: ${input.phone}` : null,
    `${copy.postal}: ${input.postal}`,
    input.email ? `${copy.email}: ${input.email}` : null,
    input.address ? `${copy.address}: ${input.address}` : null,
    input.approxSqm ? `${copy.area}: ${input.approxSqm}` : null,
    `${copy.service}: ${leadAdminServiceLabel(input.type, adminLocale)}`,
    `${copy.customerLanguage}: ${leadCustomerLanguageLabel(input.locale, adminLocale)}`,
    `${copy.advertisingSource}: ${attributionSummary(input)}`,
    input.utmCampaign ? `${copy.campaign}: ${input.utmCampaign}` : null,
    input.utmContent ? `${copy.ad}: ${input.utmContent}` : null,
    input.utmTerm ? `${copy.keyword}: ${input.utmTerm}` : null,
    input.landingPage ? `${copy.landingPage}: ${input.landingPage}` : null,
    input.referrer ? `${copy.referrer}: ${input.referrer}` : null,
    input.marketingConsent
      ? `${copy.marketingConsent}: ${input.marketingConsent}`
      : null,
    input.photoUrls.length
      ? `${copy.images}: ${input.photoUrls.length} – ${gallery}`
      : null,
    "",
    originalMessage ? `${copy.customerMessage}:` : null,
    originalMessage,
    "",
    `${copy.gallery}: ${gallery}`,
    `${copy.admin}: ${leadAdminUrl(input.id)}`,
    "",
    copy.pdfIncluded,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

export function buildLeadEmailHtml(
  input: LeadEmailInput,
  adminLocale: PanelLocale = "nb",
) {
  const copy = getLeadAdminNotificationCopy(adminLocale);
  const typeLabel = leadAdminServiceLabel(input.type, adminLocale);
  const originalMessage = input.message?.trim() ? input.message : null;
  const gallery = leadGalleryUrl(input.id, input.token);
  const admin = leadAdminUrl(input.id);
  const preview = input.photoUrls.slice(0, 4);
  const more = Math.max(0, input.photoUrls.length - preview.length);

  const thumbs = preview
    .map((url, i) => {
      const src = leadBlobUrl({ id: input.id, token: input.token, url });
      return `
        <td style="padding:4px;width:25%;">
          <a href="${escapeHtml(gallery)}" style="display:block;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
            <img src="${escapeHtml(src)}" alt="${copy.image} ${i + 1}" width="140" height="105" style="display:block;width:100%;height:auto;object-fit:cover;" />
          </a>
        </td>`;
    })
    .join("");

  const phoneHref = input.phone
    ? `tel:${input.phone.replace(/\s+/g, "")}`
    : null;
  const emailHref = input.email ? `mailto:${input.email}` : null;

  return `<!DOCTYPE html>
<html lang="${copy.emailHtmlLang}">
<body style="margin:0;padding:0;background:#0b0d10;font-family:Manrope,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d10;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12151c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;">
              <p style="margin:0 0 6px;color:#e8a317;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Takfornyelse · ${copy.internalLabel}</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.25;">${copy.title}</h1>
              <p style="margin:10px 0 0;color:#f4f6f8;font-size:13px;line-height:1.5;">${copy.internalExplanation}</p>
              <p style="margin:12px 0 0;">
                <span style="display:inline-block;background:rgba(232,163,23,0.18);color:#e8a317;border:1px solid rgba(232,163,23,0.35);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;">${escapeHtml(typeLabel)}</span>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 28px 20px;">
              <p style="margin:0 0 8px;color:#9aa3b2;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${copy.contact}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row(copy.name, escapeHtml(input.name))}
                ${
                  input.phone && phoneHref
                    ? row(
                        copy.phone,
                        `<a href="${escapeHtml(phoneHref)}" style="color:#e8a317;text-decoration:none;">${escapeHtml(input.phone)}</a>`,
                      )
                    : ""
                }
                ${row(copy.postal, escapeHtml(input.postal))}
                ${
                  input.email && emailHref
                    ? row(
                        copy.email,
                        `<a href="${escapeHtml(emailHref)}" style="color:#e8a317;text-decoration:none;">${escapeHtml(input.email)}</a>`,
                      )
                    : ""
                }
                ${input.address ? row(copy.address, escapeHtml(input.address)) : ""}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 20px;">
              <p style="margin:0 0 8px;color:#9aa3b2;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${copy.details}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${input.approxSqm ? row(copy.area, String(input.approxSqm)) : ""}
                ${row(copy.customerLanguage, leadCustomerLanguageLabel(input.locale, adminLocale))}
                ${row(copy.advertisingSource, escapeHtml(attributionSummary(input)))}
                ${input.utmCampaign ? row(copy.campaign, escapeHtml(input.utmCampaign)) : ""}
                ${input.utmContent ? row(copy.ad, escapeHtml(input.utmContent)) : ""}
                ${input.utmTerm ? row(copy.keyword, escapeHtml(input.utmTerm)) : ""}
                ${
                  originalMessage
                    ? row(
                        copy.customerMessage,
                        `<span style="font-weight:500;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(originalMessage)}</span>`,
                      )
                    : ""
                }
              </table>
            </td>
          </tr>

          ${
            input.photoUrls.length
              ? `<tr>
            <td style="padding:0 28px 24px;">
              <p style="margin:0 0 8px;color:#9aa3b2;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${copy.images} (${input.photoUrls.length})</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${thumbs}</tr></table>
              ${
                more
                  ? `<p style="margin:8px 0 0;color:#9aa3b2;font-size:13px;">+${more} ${copy.moreImages}</p>`
                  : ""
              }
              <p style="margin:16px 0 0;">
                <a href="${escapeHtml(gallery)}" style="display:inline-block;background:#e8a317;color:#0c0e12;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:10px;">${copy.seeAllImages}</a>
              </p>
            </td>
          </tr>`
              : ""
          }

          <tr>
            <td style="padding:0 28px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:16px 0 0;color:#9aa3b2;font-size:12px;line-height:1.5;">
                ${copy.lead} #${escapeHtml(String(input.id))}
                · <a href="${escapeHtml(admin)}" style="color:#9aa3b2;">${copy.openAdmin}</a>
                ${input.email ? ` · ${copy.replyHint}` : ""}
                <br />${copy.pdfIncluded}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
