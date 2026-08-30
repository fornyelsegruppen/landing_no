import type { PanelLocale } from "@/lib/panel-i18n";

export type WorkerDraftState =
  "saved" | "sending" | "registered" | "error" | "unsent";

export function workerDraftStatusLabel(
  state: WorkerDraftState | null,
  locale: PanelLocale,
) {
  if (state === null) return null;
  if (state === "unsent")
    return locale === "lt"
      ? "Neišsiųsta"
      : locale === "en"
        ? "Not sent"
        : "Ikke sendt";
  if (state === "saved")
    return locale === "lt"
      ? "Juodraštis saugomas šiame telefone"
      : locale === "en"
        ? "Draft saved on this phone"
        : "Utkast lagret på denne telefonen";
  if (state === "sending")
    return locale === "lt"
      ? "Siunčiama …"
      : locale === "en"
        ? "Sending …"
        : "Sender …";
  if (state === "error")
    return locale === "lt"
      ? "Klaida – duomenys liko telefone"
      : locale === "en"
        ? "Error – data remains on this phone"
        : "Feil – dataene er fortsatt på telefonen";
  return locale === "lt"
    ? "Užregistruota"
    : locale === "en"
      ? "Registered"
      : "Registrert";
}
