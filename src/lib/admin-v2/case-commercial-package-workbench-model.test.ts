import { describe, expect, it } from "vitest";
import type { AdminCaseWorkspace } from "./case-read-model";
import {
  projectCaseCommercialPackageWorkbench,
  type CaseCommercialPackageRule,
} from "./case-commercial-package-workbench-model";

const rules: CaseCommercialPackageRule[] = [
  {
    serviceKey: "takvask",
    serviceName: "Takvask",
    unitPriceExVatOre: 12_500,
  },
];

function caseData(overrides: {
  optionKind?: string;
  price?: false;
  quote?: false;
  quoteStatus?: string;
} = {}): Pick<AdminCaseWorkspace, "lead" | "price" | "quote"> {
  return {
    lead: {
      id: 17,
      inquiryType: "takvask",
      revision: 9,
    } as AdminCaseWorkspace["lead"],
    price:
      overrides.price === false
        ? undefined
        : ({ unitPriceExVatOre: 14_900 } as AdminCaseWorkspace["price"]),
    quote:
      overrides.quote === false
        ? undefined
        : ({
            id: 71,
            optionKind: overrides.optionKind,
            status: overrides.quoteStatus ?? "draft",
          } as AdminCaseWorkspace["quote"]),
  };
}

function legacyInlineProjection(input: {
  caseData: Pick<AdminCaseWorkspace, "lead" | "price" | "quote">;
  locale: "lt";
  mutationsAllowed: boolean;
  rules: CaseCommercialPackageRule[];
}) {
  if (
    !input.mutationsAllowed ||
    !input.caseData.quote ||
    !["draft", "declined"].includes(input.caseData.quote.status || "") ||
    !input.caseData.price
  ) {
    return null;
  }
  return {
    currentService: input.caseData.lead.inquiryType,
    expectedRevision: input.caseData.lead.revision,
    leadId: input.caseData.lead.id,
    locale: input.locale,
    rules: input.rules,
    sourceQuoteId: input.caseData.quote.id,
    unitPriceExVatOre:
      input.caseData.quote.optionKind === "recommended"
        ? undefined
        : input.caseData.price.unitPriceExVatOre,
  };
}

describe("case commercial package workbench projection", () => {
  it.each([
    ["draft", caseData(), true],
    ["declined", caseData({ quoteStatus: "declined" }), true],
    ["recommended", caseData({ optionKind: "recommended" }), true],
    ["mutations disabled", caseData(), false],
    ["quote missing", caseData({ quote: false }), true],
    ["quote immutable", caseData({ quoteStatus: "approved" }), true],
    ["price missing", caseData({ price: false }), true],
  ])(
    "preserves the legacy inline eligibility and props for %s",
    (_scenario, value, mutationsAllowed) => {
      const input = {
        caseData: value,
        locale: "lt" as const,
        mutationsAllowed,
        rules,
      };
      const legacy = legacyInlineProjection(input);
      const projected = projectCaseCommercialPackageWorkbench(input);

      expect(projected.status === "ready" ? projected.editor : null).toEqual(
        legacy,
      );
    },
  );

  it("pins the exact case revision and source quote while preserving recommended-price behavior", () => {
    const base = projectCaseCommercialPackageWorkbench({
      caseData: caseData(),
      locale: "en",
      mutationsAllowed: true,
      rules,
    });
    const recommended = projectCaseCommercialPackageWorkbench({
      caseData: caseData({ optionKind: "recommended" }),
      locale: "en",
      mutationsAllowed: true,
      rules,
    });

    expect(base).toEqual({
      status: "ready",
      editor: {
        currentService: "takvask",
        expectedRevision: 9,
        leadId: 17,
        locale: "en",
        rules,
        sourceQuoteId: 71,
        unitPriceExVatOre: 14_900,
      },
    });
    expect(recommended).toMatchObject({
      status: "ready",
      editor: { unitPriceExVatOre: undefined },
    });
  });

  it.each([
    ["mutations_disabled", caseData(), false],
    ["quote_missing", caseData({ quote: false }), true],
    ["quote_not_editable", caseData({ quoteStatus: "issued" }), true],
    ["price_missing", caseData({ price: false }), true],
  ] as const)("fails closed with %s", (reason, value, mutationsAllowed) => {
    expect(
      projectCaseCommercialPackageWorkbench({
        caseData: value,
        locale: "nb",
        mutationsAllowed,
        rules,
      }),
    ).toEqual({ status: "unavailable", reason });
  });
});
