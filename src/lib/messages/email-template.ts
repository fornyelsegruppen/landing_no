import { siteConfig } from "@/lib/site";

type BrandedEmailInput = {
  subject: string;
  text: string;
  preheader?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkedLine(line: string) {
  const escaped = escapeHtml(line);
  return escaped.replace(
    /(https:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#d68b00;font-weight:700;text-decoration:underline;word-break:break-all">$1</a>',
  );
}

function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 18px;line-height:1.65;color:#20242c">${paragraph.split(/\r?\n/).map(linkedLine).join("<br>")}</p>`)
    .join("");
}

export function buildBrandedEmailHtml(input: BrandedEmailInput) {
  const baseUrl = siteConfig.url.replace(/\/$/, "");
  const logoUrl = `${baseUrl}/brand/logo.webp`;
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
            ${textToHtml(input.text)}
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
