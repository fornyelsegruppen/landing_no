import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createBrandedPdf, wrapPdfText } from "./branded-pdf";

describe("branded PDF text safety", () => {
  it("breaks a long uninterrupted URL within the available width", async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const maxWidth = 90;
    const lines = wrapPdfText(
      "https://example.no/this-is-a-very-long-uninterrupted-path-token",
      font,
      10,
      maxWidth,
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(
      lines.every((line) => font.widthOfTextAtSize(line, 10) <= maxWidth),
    ).toBe(true);
  });

  it("fails closed when a caller requires unavailable Unicode fonts", async () => {
    await expect(
      createBrandedPdf({
        fontDirectory: "Z:/definitely-missing-font-directory",
        requireUnicodeFonts: true,
        subject: "Vidinis pranešimas",
        title: "Užklausa",
      }),
    ).rejects.toThrow("PDF generation was stopped");
  });
});
