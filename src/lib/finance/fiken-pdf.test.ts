import { describe, expect, it } from "vitest";
import { parseFikenInvoiceText } from "./fiken-pdf";

describe("parseFikenInvoiceText", () => {
  it("extracts the core fields from Norwegian invoice text", () => {
    const value = parseFikenInvoiceText(`
      Fakturanummer: 1042
      Fakturadato: 26.08.2026
      Forfallsdato: 09.09.2026
      Sum ekskl. mva.: 10 000,00
      MVA 25 %: 2 500,00
      Beløp å betale: NOK 12 500,00
    `);
    expect(value).toMatchObject({ invoiceNumber: "1042", subtotalExVatOre: 1_000_000, vatOre: 250_000, totalIncVatOre: 1_250_000, missing: [] });
    expect(value.issuedAt).toContain("2026-08-26");
    expect(value.dueAt).toContain("2026-09-09");
    expect(value.confidence).toBeGreaterThanOrEqual(1);
  });

  it("does not invent missing fields", () => {
    const value = parseFikenInvoiceText("Fakturanr: 55\nBeløp å betale: 1 000,00");
    expect(value.invoiceNumber).toBe("55");
    expect(value.totalIncVatOre).toBe(100_000);
    expect(value.missing).toContain("issuedAt");
    expect(value.missing).toContain("vatOre");
  });
});

