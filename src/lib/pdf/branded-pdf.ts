import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { siteConfig } from "@/lib/site";

export const A4 = { width: 595.28, height: 841.89 } as const;
export const PDF_MARGIN = 48;
const HEADER_HEIGHT = 82;
const FOOTER_HEIGHT = 58;

export function pdfSafe(value: string) {
  return value
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/•/g, "-")
    .replace(/·/g, "|")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

export function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const lines: string[] = [];
  for (const paragraph of pdfSafe(text).split(/\r?\n/)) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function attachUriLink(
  page: PDFPage,
  uri: string,
  rect: [number, number, number, number],
) {
  const linkRef = page.doc.context.register(
    page.doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(uri) },
    }),
  );
  const key = PDFName.of("Annots");
  const existing = page.node.lookup(key);
  if (existing instanceof PDFArray) existing.push(linkRef);
  else page.node.set(key, page.doc.context.obj([linkRef]));
}

async function embedLogo(document: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "brand", "logo.png"),
    );
    return await document.embedPng(bytes);
  } catch {
    return null;
  }
}

export type BrandedPdf = Awaited<ReturnType<typeof createBrandedPdf>>;

export async function createBrandedPdf(input: {
  title: string;
  subject: string;
}) {
  const document = await PDFDocument.create();
  document.setTitle(input.title);
  document.setAuthor(siteConfig.parentOrg);
  document.setSubject(input.subject);
  document.setCreator("Takfornyelse dokumentplattform");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(document);
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const drawChrome = (target: PDFPage) => {
    target.drawRectangle({
      x: 0,
      y: A4.height - HEADER_HEIGHT,
      width: A4.width,
      height: HEADER_HEIGHT,
      color: rgb(0.025, 0.035, 0.055),
    });
    target.drawRectangle({
      x: 0,
      y: A4.height - HEADER_HEIGHT,
      width: A4.width,
      height: 4,
      color: rgb(0.94, 0.66, 0.08),
    });
    if (logo) {
      const scaled = logo.scaleToFit(174, 56);
      target.drawImage(logo, {
        x: PDF_MARGIN,
        y: A4.height - 68,
        width: scaled.width,
        height: scaled.height,
      });
    } else {
      target.drawText("TAKFORNYELSE", {
        x: PDF_MARGIN,
        y: A4.height - 51,
        size: 16,
        font: bold,
        color: rgb(0.94, 0.66, 0.08),
      });
    }
  };

  const addPage = () => {
    page = document.addPage([A4.width, A4.height]);
    pages.push(page);
    drawChrome(page);
    y = A4.height - HEADER_HEIGHT - 28;
    return page;
  };

  addPage();
  const contentBottom = FOOTER_HEIGHT + 24;
  const contentWidth = A4.width - PDF_MARGIN * 2;

  const ensure = (needed: number) => {
    if (y - needed < contentBottom) addPage();
  };

  const text = (
    value: string,
    options: {
      size?: number;
      strong?: boolean;
      gap?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      maxWidth?: number;
    } = {},
  ) => {
    const size = options.size ?? 10;
    const font = options.strong ? bold : regular;
    const x = PDF_MARGIN + (options.indent ?? 0);
    const maxWidth = options.maxWidth ?? contentWidth - (options.indent ?? 0);
    const lines = wrapPdfText(value, font, size, maxWidth);
    for (const line of lines) {
      ensure(size * 1.55);
      if (line)
        page.drawText(line, {
          x,
          y,
          size,
          font,
          color: options.color ?? rgb(0.08, 0.09, 0.12),
        });
      y -= size * 1.45;
    }
    y -= options.gap ?? 3;
  };

  const section = (title: string) => {
    ensure(34);
    y -= 4;
    text(title, {
      size: 12.5,
      strong: true,
      color: rgb(0.08, 0.09, 0.12),
      gap: 5,
    });
    page.drawLine({
      start: { x: PDF_MARGIN, y: y + 2 },
      end: { x: A4.width - PDF_MARGIN, y: y + 2 },
      thickness: 0.8,
      color: rgb(0.88, 0.71, 0.29),
    });
    y -= 7;
  };

  const field = (label: string, value?: string | number | null) => {
    if (value === undefined || value === null || String(value).trim() === "")
      return;
    text(`${label}: ${String(value)}`);
  };

  const link = (label: string, uri: string) => {
    const size = 10;
    const safeLabel = pdfSafe(label);
    const w = Math.min(
      contentWidth,
      bold.widthOfTextAtSize(safeLabel, size) + 22,
    );
    ensure(34);
    page.drawRectangle({
      x: PDF_MARGIN,
      y: y - 22,
      width: w,
      height: 28,
      color: rgb(0.96, 0.97, 0.98),
      borderColor: rgb(0.94, 0.66, 0.08),
      borderWidth: 1,
    });
    page.drawText(safeLabel, {
      x: PDF_MARGIN + 11,
      y: y - 13,
      size,
      font: bold,
      color: rgb(0.12, 0.28, 0.55),
    });
    attachUriLink(page, uri, [PDF_MARGIN, y - 22, PDF_MARGIN + w, y + 6]);
    y -= 36;
  };

  const embedSignature = async (dataUrl: string) => {
    const bytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
    return document.embedPng(bytes);
  };

  const finish = async () => {
    pages.forEach((target, index) => {
      target.drawRectangle({
        x: 0,
        y: 0,
        width: A4.width,
        height: FOOTER_HEIGHT,
        color: rgb(0.055, 0.07, 0.1),
      });
      target.drawText(
        pdfSafe(`Takfornyelse - en del av ${siteConfig.parentOrg}`),
        { x: PDF_MARGIN, y: 36, size: 8.5, font: bold, color: rgb(1, 1, 1) },
      );
      target.drawText(
        pdfSafe(
          `${siteConfig.phone}  |  ${siteConfig.email}  |  Org.nr. ${siteConfig.orgNr}`,
        ),
        {
          x: PDF_MARGIN,
          y: 22,
          size: 7.8,
          font: regular,
          color: rgb(0.88, 0.9, 0.94),
        },
      );
      target.drawText(
        pdfSafe(
          `${siteConfig.address.street}, ${siteConfig.address.postal} ${siteConfig.address.city}`,
        ),
        {
          x: PDF_MARGIN,
          y: 10,
          size: 7.8,
          font: regular,
          color: rgb(0.88, 0.9, 0.94),
        },
      );
      const pageLabel = `${index + 1} / ${pages.length}`;
      target.drawText(pageLabel, {
        x: A4.width - PDF_MARGIN - regular.widthOfTextAtSize(pageLabel, 8),
        y: 22,
        size: 8,
        font: regular,
        color: rgb(0.88, 0.9, 0.94),
      });
    });
    return document.save();
  };

  return {
    document,
    regular,
    bold,
    page: () => page,
    y: () => y,
    setY: (value: number) => {
      y = value;
    },
    addPage,
    ensure,
    text,
    section,
    field,
    link,
    embedSignature,
    finish,
    contentWidth,
  };
}
