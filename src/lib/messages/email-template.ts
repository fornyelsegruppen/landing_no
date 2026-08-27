import { siteConfig } from "@/lib/site";

type BrandedEmailInput = {
  subject: string;
  text: string;
  preheader?: string;
  secureLinkLabel?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function secureCustomerLinkLabel(category: string) {
  switch (category) {
    case "contract":
      return "Åpne din sikre kundeside";
    case "reminder":
      return "Åpne tilbudet";
    case "change_agreement":
    case "change_confirmation":
      return "Åpne endringsavtalen";
    case "quote":
      return "Åpne ditt sikre tilbud";
    default:
      return undefined;
  }
}

function secureActionButton(url: string, label?: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const isTakfornyelseHost =
      hostname === "takfornyelse.as" ||
      hostname === "www.takfornyelse.as" ||
      hostname.endsWith(".vercel.app");

    const isQuoteLink = parsed.pathname.startsWith("/tilbud/");
    const isChangeAgreementLink = parsed.pathname.startsWith("/endring/");
    if (
      parsed.protocol !== "https:" ||
      !isTakfornyelseHost ||
      (!isQuoteLink && !isChangeAgreementLink)
    ) {
      return null;
    }

    const buttonLabel =
      label ||
      (isChangeAgreementLink
        ? "Åpne endringsavtalen"
        : "Åpne ditt sikre tilbud");
    return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:8px 0 4px;background:#f0a914;color:#101319;text-decoration:none;font-weight:700;font-size:15px;line-height:1.2;padding:14px 20px;border-radius:10px">${escapeHtml(buttonLabel)}</a>`;
  } catch {
    return null;
  }
}

function linkedLine(line: string, secureLinkLabel?: string) {
  const parts = line.split(/(https:\/\/[^\s<]+)/g);
  return parts
    .map((part) => {
      if (!part.startsWith("https://")) return escapeHtml(part);
      return (
        secureActionButton(part, secureLinkLabel) ||
        `<a href="${escapeHtml(part)}" style="color:#d68b00;font-weight:700;text-decoration:underline;word-break:break-all">${escapeHtml(part)}</a>`
      );
    })
    .join("");
}

function textToHtml(text: string, secureLinkLabel?: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 18px;line-height:1.65;color:#20242c">${paragraph.split(/\r?\n/).map((line) => linkedLine(line, secureLinkLabel)).join("<br>")}</p>`)
    .join("");
}

export function buildBrandedEmailHtml(input: BrandedEmailInput) {
  // Email clients fetch images without the recipient's Vercel session. Keep
  // branded email assets on the public production domain even when a message
  // is generated from a protected Preview deployment.
  const emailAssetBaseUrl = (
    process.env.EMAIL_ASSET_BASE_URL || "https://www.takfornyelse.as"
  ).replace(/\/$/, "");
  const logoUrl = `${emailAssetBaseUrl}/brand/logo.png`;
  const preheader = escapeHtml(input.preheader || input.subject);
  const subject = escapeHtml(input.subject);

  return `<!doctype html>
<html lang="no">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
  <body style="margin:0;background:#f3f3f3;font-family:Arial,Helvetica,sans-serif;color:#20242c">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f3;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e4e7ec">
          <tr><td style="background:#080b12;padding:24px 30px;border-bottom:4px solid #f0a914">
            <img src="${logoUrl}" width="190" alt="Takfornyelse" style="display:block;max-width:190px;height:auto">
          </td></tr>
          <tr><td style="padding:34px 30px 18px">
            <h1 style="margin:0 0 22px;font-size:26px;line-height:1.25;color:#101319">${subject}</h1>
            ${textToHtml(input.text, input.secureLinkLabel)}
          </td></tr>
          <tr><td style="padding:22px 30px;background:#10141c;color:#d8dde6;font-size:13px;line-height:1.6">
            <strong style="color:#ffffff">Takfornyelse – en del av ${escapeHtml(siteConfig.parentOrg)}</strong><br>
            <a href="tel:+4747735888" style="color:#f0a914;text-decoration:none">${escapeHtml(siteConfig.phone)}</a>
            &nbsp;·&nbsp;
            <a href="mailto:${escapeHtml(siteConfig.email)}" style="color:#f0a914;text-decoration:none">${escapeHtml(siteConfig.email)}</a><br>
            Org.nr. ${escapeHtml(siteConfig.orgNr)} · ${escapeHtml(siteConfig.address.street)}, ${escapeHtml(siteConfig.address.postal)} ${escapeHtml(siteConfig.address.city)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
