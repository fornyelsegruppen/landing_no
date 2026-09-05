import type { AdminCaseWorkspace } from "./case-read-model";
import type { PanelLocale } from "@/lib/panel-i18n";

export type CaseCommercialPackageRule = {
  serviceKey: string;
  serviceName: string;
  unitPriceExVatOre: number;
};

export type CaseCommercialPackageWorkbenchModel =
  | {
      status: "ready";
      editor: {
        currentService?: string;
        expectedRevision: number;
        leadId: number;
        locale: PanelLocale;
        rules: CaseCommercialPackageRule[];
        sourceQuoteId: number;
        unitPriceExVatOre?: number;
      };
    }
  | {
      status: "unavailable";
      reason:
        | "mutations_disabled"
        | "quote_missing"
        | "quote_not_editable"
        | "price_missing";
    };

export function projectCaseCommercialPackageWorkbench(input: {
  caseData: Pick<AdminCaseWorkspace, "lead" | "price" | "quote">;
  locale: PanelLocale;
  mutationsAllowed: boolean;
  rules: CaseCommercialPackageRule[];
}): CaseCommercialPackageWorkbenchModel {
  if (!input.mutationsAllowed) {
    return { status: "unavailable", reason: "mutations_disabled" };
  }
  if (!input.caseData.quote) {
    return { status: "unavailable", reason: "quote_missing" };
  }
  if (
    !["draft", "declined"].includes(input.caseData.quote.status || "")
  ) {
    return { status: "unavailable", reason: "quote_not_editable" };
  }
  if (!input.caseData.price) {
    return { status: "unavailable", reason: "price_missing" };
  }

  return {
    status: "ready",
    editor: {
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
    },
  };
}
