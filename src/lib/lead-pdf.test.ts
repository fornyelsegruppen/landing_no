import { describe, expect, it } from "vitest";
import type { PanelLocale } from "@/lib/panel-i18n";
import type { LeadEmailInput } from "./lead-email";
import { buildLeadPdf, leadPdfFilename } from "./lead-pdf";

const input: LeadEmailInput = {
  contentSourcePath: "",
  fbclid: "",
  gbraid: "",
  gclid: "",
  id: 55,
  landingPage: "/no",
  marketingConsent: "granted",
  msclkid: "",
  name: "Živilė Østergård",
  phone: "+47 900 00 000",
  photoUrls: [],
  postal: "1182",
  referrer: "",
  token: "test-token",
  type: "takvask",
  locale: "no",
  message: "Originali kliento žinutė: stogas šlapias – ikke oversett.",
  utmCampaign: "",
  utmContent: "",
  utmMedium: "",
  utmSource: "",
  utmTerm: "",
  wbraid: "",
};

async function extractedText(locale: PanelLocale) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = await buildLeadPdf(input, locale, { VERCEL_ENV: "preview" });
  const document = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join(" ");
}

describe("localized internal lead PDF", () => {
  it("keeps Lithuanian labels and the original customer message intact", async () => {
    const text = await extractedText("lt");

    expect(text).toContain("PREVIEW TEST | VIDINIS ADMIN");
    expect(text).toContain("Vidinis administratoriaus pranešimas");
    expect(text).toContain("Kliento kalba: Norvegų");
    expect(text).toContain(input.message);
    expect(text).not.toContain("?");
    expect(leadPdfFilename(input, "lt")).toBe("uzklausa-55-zivile-ostergard.pdf");
  });

  it.each([
    ["nb", "Internt administrasjonsvarsel", "Kundespråk: Norsk"],
    ["en", "Internal administrator notification", "Customer language: Norwegian"],
  ] as const)("renders the %s administrator locale", async (locale, role, language) => {
    const text = await extractedText(locale);
    expect(text).toContain(role);
    expect(text).toContain(language);
    expect(text).toContain(input.message);
  });
});
