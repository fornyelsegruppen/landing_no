import { createHash } from "node:crypto";

export type ExtractedFikenInvoice = {
  confidence: number;
  invoiceNumber?: string;
  issuedAt?: string;
  dueAt?: string;
  subtotalExVatOre?: number;
  vatOre?: number;
  totalIncVatOre?: number;
  missing: string[];
  textHash: string;
};

function amountOre(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function isoDate(value: string | undefined) {
  if (!value) return undefined;
  const [day, month, yearValue] = value.split(/[.\-/]/).map(Number);
  const year = yearValue < 100 ? 2000 + yearValue : yearValue;
  if (!day || !month || !year || month > 12 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString();
}

function labelled(text: string, labels: string, value: string) {
  const anchored = text.match(new RegExp(`(?:^|\\n)\\s*(?:${labels})\\s*[:#]?\\s*${value}`, "im"))?.[1];
  return anchored ?? text.match(new RegExp(`(?:${labels})\\s*[:#]?\\s*${value}`, "i"))?.[1];
}

function labelledAmount(text: string, labels: string) {
  return amountOre(labelled(text, labels, "(?:NOK|kr)?\\s*([0-9][0-9 .]*(?:,[0-9]{1,2})?)"));
}

export function parseFikenInvoiceText(rawText: string): ExtractedFikenInvoice {
  const text = rawText.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\r/g, "");
  const datePattern = "([0-3]?\\d[.\-/][01]?\\d[.\-/](?:20)?\\d{2})";
  const invoiceNumber = labelled(text, "fakturan(?:ummer|r\\.?|r)|faktura\\s*nr\\.?", "([A-Z0-9][A-Z0-9\-/]{1,40})")?.trim();
  const issuedAt = isoDate(labelled(text, "fakturadato|dato", datePattern));
  const dueAt = isoDate(labelled(text, "forfallsdato|forfall", datePattern));
  let totalIncVatOre = labelledAmount(text, "beløp å betale|sum å betale|totalt å betale|total(?:t)? inkl\\.? mva\\.?");
  const subtotalExVatOre = labelledAmount(text, "sum ekskl\\.? mva\\.?|total(?:t)? ekskl\\.? mva\\.?|netto");
  const vatOre = labelledAmount(text, "mva(?:\\.?)?(?: 25 ?%)?|merverdiavgift");
  if (totalIncVatOre === undefined && subtotalExVatOre !== undefined && vatOre !== undefined) totalIncVatOre = subtotalExVatOre + vatOre;
  const fields = { invoiceNumber, issuedAt, dueAt, subtotalExVatOre, vatOre, totalIncVatOre };
  const missing = Object.entries(fields).filter(([, value]) => value === undefined).map(([key]) => key);
  const consistency = subtotalExVatOre !== undefined && vatOre !== undefined && totalIncVatOre !== undefined
    ? subtotalExVatOre + vatOre === totalIncVatOre
    : false;
  const confidence = Math.max(0, Math.min(1, (6 - missing.length) / 6 + (consistency ? 0.08 : 0)));
  return { ...fields, confidence, missing, textHash: createHash("sha256").update(text).digest("hex") };
}

export async function extractFikenInvoice(data: Uint8Array): Promise<ExtractedFikenInvoice> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const parts: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      parts.push(item.str);
      if (item.hasEOL) parts.push("\n");
    }
    pages.push(parts.join(" "));
  }
  return parseFikenInvoiceText(pages.join("\n"));
}
