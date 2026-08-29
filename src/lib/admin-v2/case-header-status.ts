import { statusLabel } from "./labels";
import type { CaseNextActionKind } from "./case-read-model";
import type { PanelLocale } from "../panel-i18n";

const declinedLabels: Record<PanelLocale, string> = {
  nb: "Kunden avslo tilbudet",
  lt: "Klientas atsisakė pasiūlymo",
  en: "Customer declined the offer",
};

export function caseHeaderStatus(input: {
  leadStatus?: string;
  locale: PanelLocale;
  nextActionKind: CaseNextActionKind;
}) {
  if (input.nextActionKind === "follow_up_decline") {
    return {
      label: declinedLabels[input.locale],
      tone: "danger" as const,
    };
  }

  return {
    label: statusLabel(input.locale, input.leadStatus),
    tone: "accent" as const,
  };
}
