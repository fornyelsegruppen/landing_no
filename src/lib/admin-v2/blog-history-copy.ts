import type { PanelLocale } from "@/lib/panel-i18n";

export const blogHistoryCopy: Record<
  PanelLocale,
  {
    unpublish: string;
    confirm: string;
    working: string;
    done: string;
    versions: string;
    help: string;
    returnToEditor: string;
  }
> = {
  lt: {
    unpublish: "Išjungti publikaciją",
    confirm:
      "Straipsnis nebebus viešas. Versijos išliks, o patvirtinimas ir publikavimo laikas bus panaikinti. Tęsti?",
    working: "Išjungiama publikacija…",
    done: "Publikacija išjungta. Prieš skelbiant iš naujo būtina kokybės patikra ir naujas patvirtinimas.",
    versions: "Versijų istorija ir atkūrimas",
    help: "Atidaroma CMS versijų istorija naujame skirtuke. Pasirinkite versiją ir jos atkūrimą: turinys grąžinamas tik į juodraštį, be ankstesnio patvirtinimo. Nepublikuokite jo iškart. Grįžkite į šį skirtuką ir atnaujinkite puslapį, tada atlikite kokybės patikrą ir patvirtinkite.",
    returnToEditor: "Grįžti į straipsnio peržiūrą (Admin V2)",
  },
  nb: {
    unpublish: "Avpubliser",
    confirm:
      "Artikkelen blir utilgjengelig offentlig. Versjoner beholdes, men godkjenning og publiseringstid nullstilles. Fortsette?",
    working: "Avpubliserer …",
    done: "Artikkelen er avpublisert. Ny kvalitetskontroll og godkjenning kreves før publisering.",
    versions: "Versjonshistorikk og gjenoppretting",
    help: "CMS-versjonshistorikken åpnes i en ny fane. Velg en versjon og gjenopprett den: innholdet blir bare et utkast uten tidligere godkjenning. Ikke publiser direkte. Gå tilbake til denne fanen og last siden på nytt, kjør kvalitetskontroll og godkjenn på nytt.",
    returnToEditor: "Tilbake til artikkelkontroll (Admin V2)",
  },
  en: {
    unpublish: "Unpublish",
    confirm:
      "The article will no longer be public. Versions are retained, but approval and the publication schedule are cleared. Continue?",
    working: "Unpublishing …",
    done: "Article unpublished. New quality checks and approval are required before publishing again.",
    versions: "Version history and restore",
    help: "CMS version history opens in a new tab. Select and restore a version: content returns only as a draft without its old approval. Do not publish directly. Return to this tab and reload, then run quality checks and approve again.",
    returnToEditor: "Return to article review (Admin V2)",
  },
};
