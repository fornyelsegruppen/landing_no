import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CasePriceOutcomeSummary,
  selectMaximumPriceChange,
} from "./case-price-outcome-summary";

const formatMoney = (value?: number) =>
  typeof value === "number" ? `${Math.round(value / 100)} NOK` : "—";

function render(
  overrides: Partial<Parameters<typeof CasePriceOutcomeSummary>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(CasePriceOutcomeSummary, {
      afterTotalIncVatOre: 3_400_000,
      beforeMaximumTotalIncVatOre: 2_975_600,
      changeReference: "E-6-V1",
      changeStatus: "accepted",
      changeStatusAt: "2026-08-30 02:16",
      changeStatusLabel: "Priimta",
      formatMoney,
      locale: "lt",
      reasonCode: "over_maximum",
      workOrderStatus: "documented",
      ...overrides,
    }),
  );
}

describe("case price outcome summary", () => {
  it("selects only a proven breach from the current work order", () => {
    const selected = selectMaximumPriceChange({
      approvedChangeAgreementId: 12,
      workOrderId: 6,
      changes: [
        {
          id: 11,
          href: "/other",
          reference: "E-OTHER-V1",
          status: "accepted",
          workOrderId: 5,
          beforeMaximumTotalIncVatOre: 2_000_000,
          afterTotalIncVatOre: 3_000_000,
        },
        {
          id: 12,
          href: "/current",
          reference: "E-6-V1",
          status: "accepted",
          workOrderId: 6,
          beforeMaximumTotalIncVatOre: 2_975_600,
          afterTotalIncVatOre: 3_400_000,
        },
      ],
    });

    expect(selected?.reference).toBe("E-6-V1");
  });

  it("does not infer a breach from incomplete or non-exceeding snapshots", () => {
    expect(
      selectMaximumPriceChange({
        workOrderId: 6,
        changes: [
          {
            id: 12,
            href: "/current",
            reference: "E-6-V1",
            status: "accepted",
            workOrderId: 6,
            beforeMaximumTotalIncVatOre: 2_975_600,
          },
        ],
      }),
    ).toBeUndefined();
  });

  it("renders nothing for work that did not exceed the maximum", () => {
    expect(render({ reasonCode: "within_contract" })).toBe("");
  });

  it("shows the exceeded limit, exact delta and accepted resolution", () => {
    const html = render();

    expect(html).toContain("Maksimali kaina buvo viršyta");
    expect(html).toContain("E-6-V1");
    expect(html).toContain("29756 NOK");
    expect(html).toContain("34000 NOK");
    expect(html).toContain("+4244 NOK");
    expect(html).toContain("Klientas priėmė rašytinį pakeitimo susitarimą");
    expect(html).toContain("Darbas užbaigtas ir dokumentuotas");
    expect(html).toContain("2026-08-30 02:16");
    expect(html).toContain("text-success");
  });

  it("keeps pending work explicitly blocked", () => {
    const html = render({
      changeStatus: "sent",
      changeStatusLabel: "Išsiųsta",
      workOrderStatus: "blocked",
    });

    expect(html).toContain("turi būti sustabdyti");
    expect(html).toContain("Reikia sprendimo");
    expect(html).not.toContain("Darbą buvo galima tęsti");
  });

  it("keeps an accepted agreement in warning state until the repeat inspection", () => {
    const html = render({ workOrderStatus: "blocked" });

    expect(html).toContain("Reikia pakartotinės patikros");
    expect(html).toContain("būtina pakartotinė patikra");
    expect(html).toContain("text-warning");
    expect(html).not.toContain("Išspręsta");
  });

  it.each([
    ["ready", "Darbą galima tęsti"],
    ["in_progress", "Darbas vykdomas"],
    ["completed", "Liko galutinė dokumentų patikra"],
    ["documented", "Dabar veiksmų nereikia"],
  ] as const)(
    "describes the resolved incident truthfully when work is %s",
    (workOrderStatus, expected) => {
      const html = render({ workOrderStatus });

      expect(html).toContain("Išspręsta");
      expect(html).toContain(expected);
      expect(html).not.toContain("Reikia pakartotinės patikros");
    },
  );

  it("does not request another inspection after the work was cancelled", () => {
    const html = render({ workOrderStatus: "cancelled" });

    expect(html).toContain("Darbas atšauktas");
    expect(html).toContain("darbas buvo atšauktas");
    expect(html).not.toContain("Reikia pakartotinės patikros");
  });

  it("does not invent amounts when the historical snapshot is incomplete", () => {
    const html = render({
      afterTotalIncVatOre: undefined,
      beforeMaximumTotalIncVatOre: null,
    });

    expect(html).not.toContain("NaN");
    expect(html).not.toContain("+-");
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["lt", "Maksimali kaina buvo viršyta"],
    ["nb", "Maksimalprisen ble overskredet"],
    ["en", "The maximum price was exceeded"],
  ] as const)("keeps the incident localized in %s", (locale, title) => {
    expect(render({ locale })).toContain(title);
  });

  it("uses a compact overflow-safe responsive grid", () => {
    const html = render();

    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:grid-cols-3");
    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain("max-w-full");
    expect(html).toContain("break-words");
    expect(html).toContain("whitespace-normal");
  });
});
