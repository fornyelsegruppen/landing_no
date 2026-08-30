import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CasePriceCalculationDetail } from "./case-price-calculation-detail";

const base = {
  id: 18,
  href: "/admin/collections/price-calculations/18",
  reference: "PB-17-V1",
  status: "superseded",
  lineItems: [
    {
      code: "takvask",
      quantityTenths: 1000,
      unitPriceExVatOre: 10000,
      totalExVatOre: 1000000,
    },
  ],
  quantityTenths: 1000,
  subtotalExVatOre: 1000000,
  vatOre: 250000,
  totalIncVatOre: 1250000,
  maximumTotalIncVatOre: 1375000,
  priceRuleId: 4,
  priceRuleVersion: 2,
  inputHash: "a".repeat(64),
};

describe("case price calculation detail", () => {
  it("renders the real calculation, lineage and generated quote without a backend CTA", () => {
    const html = renderToStaticMarkup(
      createElement(CasePriceCalculationDetail, {
        calculation: base,
        comparison: {
          from: base,
          to: {
            ...base,
            id: 19,
            reference: "PB-17-V2",
            totalIncVatOre: 1300000,
          },
        },
        formatMoney: (value?: number) =>
          typeof value === "number" ? `${value / 100} NOK` : "—",
        locale: "lt",
        measurementReference: "TM-17-V1",
        quoteReferences: ["T-17-V1"],
      }),
    );

    expect(html).toContain('data-price-calculation-detail="18"');
    expect(html).toContain("Skaičiavimo detalės");
    expect(html).toContain("PB-17-V1");
    expect(html).toContain("PB-17-V2");
    expect(html).toContain("TM-17-V1");
    expect(html).toContain("T-17-V1");
    expect(html).toContain("13000 NOK");
    expect(html).toContain("Techninis vientisumo patvirtinimas");
    expect(html).not.toContain("/admin/collections/price-calculations/18");
  });
});
