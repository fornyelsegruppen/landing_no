import type { PanelLocale } from "@/lib/panel-i18n";

export function blogGenerationError(result: {
  error?: string; code?: string; issues?: Array<{ code: string; message: string }>;
}, locale: PanelLocale) {
  if (result.code !== "article_quality_blocked") return result.error || "Generation failed";
  const intro = {
    lt: "AI tekstas nepraėjo kokybės patikros. Straipsnis nesukurtas ir nepublikuotas.",
    no: "AI-teksten bestod ikke kvalitetskontrollen. Ingen artikkel ble opprettet eller publisert.",
    nb: "AI-teksten bestod ikke kvalitetskontrollen. Ingen artikkel ble opprettet eller publisert.",
    en: "AI text did not pass quality review. No article was created or published.",
  }[locale];
  const details = (result.issues || []).map((issue) => {
    if (locale === "lt" && issue.code === "unsafe_roof_advice") return "Tekste aptiktas galimai nesaugus patarimas dėl darbo ant stogo.";
    if (locale === "lt" && issue.code === "content_too_short") return "Tekstas per trumpas.";
    return issue.message;
  });
  return [intro, ...details].join(" ");
}
