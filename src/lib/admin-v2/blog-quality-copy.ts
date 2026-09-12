import type { PanelLocale } from "@/lib/panel-i18n";

type Issue = {
  code?: string | null;
  gate?: string | null;
  message?: string | null;
};
const copy = {
  lt: {
    content:
      "Publikavimo kokybės patikrai reikia 700–15000 simbolių straipsnio teksto. Trumpesnį tekstą galite išsaugoti kaip juodraštį.",
    internalLinks:
      "Patikrinkite vidines nuorodas techninėje straipsnio peržiūroje: reikia 1–6 tinkamų nuorodų su pavadinimais ir paskirties paaiškinimais.",
    faq: "Patikrinkite DUK techninėje straipsnio peržiūroje: reikia 2–6 klausimų su išsamiais atsakymais.",
    imageBrief:
      "Papildykite nuotraukos aprašą techninėje straipsnio peržiūroje: reikia 20–500 simbolių.",
    imageAlt:
      "Patikrinkite alternatyvų nuotraukos tekstą: reikia 10–180 simbolių.",
    title:
      "Kokybės patikrai pavadinimas turi būti 20–90 simbolių. Trumpą darbinį pavadinimą galima išsaugoti juodraštyje.",
    excerpt: "Papildykite santrauką: kokybės patikrai reikia 60–320 simbolių.",
    seoTitle: "Patikrinkite SEO pavadinimą: reikia 20–70 simbolių.",
    seoDescription: "Papildykite SEO aprašymą: reikia 80–170 simbolių.",
    primaryKeyword: "Nurodykite pagrindinį raktažodį: reikia 2–100 simbolių.",
    sources:
      "Patikrinkite šaltinių duomenis: reikia 1–10 tikslių nuorodų su pavadinimu ir leidėju.",
    generic:
      "Trūksta tinkamų straipsnio duomenų. Patikrinkite turinio ir techninės straipsnio peržiūros laukelius, tada pakartokite kokybės patikrą.",
    shortWords:
      "Straipsnyje mažiau nei 700 žodžių. Tai įspėjimas patikrinti turinio išsamumą.",
    issue: "Peržiūrėkite straipsnio kokybės pastabą.",
  },
  nb: {
    content:
      "Publiseringskontrollen krever 700–15000 tegn i artikkelteksten. Kortere tekst kan lagres som utkast.",
    internalLinks:
      "Kontroller interne lenker i den tekniske artikkelvisningen: det kreves 1–6 gyldige lenker med lenketekst og begrunnelse.",
    faq: "Kontroller spørsmål og svar i den tekniske artikkelvisningen: det kreves 2–6 spørsmål med utfyllende svar.",
    imageBrief:
      "Fyll ut bildebeskrivelsen i den tekniske artikkelvisningen: det kreves 20–500 tegn.",
    imageAlt: "Kontroller bildets alternative tekst: det kreves 10–180 tegn.",
    title:
      "Kvalitetskontrollen krever en tittel på 20–90 tegn. En kort arbeidstittel kan lagres i utkastet.",
    excerpt: "Fyll ut ingressen: kvalitetskontrollen krever 60–320 tegn.",
    seoTitle: "Kontroller SEO-tittelen: det kreves 20–70 tegn.",
    seoDescription: "Fyll ut SEO-beskrivelsen: det kreves 80–170 tegn.",
    primaryKeyword: "Oppgi primært søkeord: det kreves 2–100 tegn.",
    sources:
      "Kontroller kildene: det kreves 1–10 presise lenker med tittel og utgiver.",
    generic:
      "Artikkelen mangler gyldige opplysninger. Kontroller innholdsfeltene og den tekniske artikkelvisningen, og kjør kvalitetskontrollen igjen.",
    shortWords:
      "Artikkelen har færre enn 700 ord. Dette er en advarsel om å kontrollere om innholdet er utfyllende nok.",
    issue: "Se gjennom artikkelens kvalitetsmerknad.",
  },
  en: {
    content:
      "The publication quality check requires 700–15000 characters of article text. Shorter text can be saved as a draft.",
    internalLinks:
      "Check internal links in the technical article view: 1–6 valid links with anchor text and a reason are required.",
    faq: "Check the FAQ in the technical article view: 2–6 questions with complete answers are required.",
    imageBrief:
      "Complete the image brief in the technical article view: 20–500 characters are required.",
    imageAlt:
      "Check the image alternative text: 10–180 characters are required.",
    title:
      "The quality check requires a 20–90 character title. A short working title can be saved in the draft.",
    excerpt:
      "Complete the excerpt: the quality check requires 60–320 characters.",
    seoTitle: "Check the SEO title: 20–70 characters are required.",
    seoDescription:
      "Complete the SEO description: 80–170 characters are required.",
    primaryKeyword: "Enter the primary keyword: 2–100 characters are required.",
    sources:
      "Check the sources: 1–10 precise links with a title and publisher are required.",
    generic:
      "Required article details are missing or invalid. Check the content fields and technical article view, then run the quality check again.",
    shortWords:
      "The article has fewer than 700 words. This is a warning to review whether the content is sufficiently detailed.",
    issue: "Review the article quality finding.",
  },
};

/** Presentation only: preserve stored QA codes, scores and thresholds. */
export function blogQualityIssueMessage(issue: Issue, locale: PanelLocale) {
  if (issue.code === "content_too_short") return copy[locale].shortWords;
  if (issue.code === "invalid_output" || issue.gate === "schema") {
    // Support the stored schema field prefix, not Zod's unstable English text.
    const field = issue.message?.match(/^([a-zA-Z]+)(?:[.:]|$)/)?.[1];
    const known = [
      "content",
      "internalLinks",
      "faq",
      "imageBrief",
      "imageAlt",
      "title",
      "excerpt",
      "seoTitle",
      "seoDescription",
      "primaryKeyword",
      "sources",
    ];
    return field && known.includes(field)
      ? copy[locale][field as keyof typeof copy.en]
      : copy[locale].generic;
  }
  return issue.message || copy[locale].issue;
}

const gateLabels = {
  schema: {
    lt: "Turinio struktūra",
    nb: "Innholdsstruktur",
    en: "Content structure",
  },
  facts: { lt: "Faktai", nb: "Fakta", en: "Facts" },
  language: { lt: "Kalba", nb: "Språk", en: "Language" },
  originality: { lt: "Originalumas", nb: "Originalitet", en: "Originality" },
  seo: { lt: "SEO", nb: "SEO", en: "SEO" },
  conversion: {
    lt: "Kitas skaitytojo veiksmas",
    nb: "Neste steg for leseren",
    en: "Reader's next step",
  },
};
export function blogQualityGateLabel(gate: string, locale: PanelLocale) {
  return Object.hasOwn(gateLabels, gate)
    ? gateLabels[gate as keyof typeof gateLabels][locale]
    : copy[locale].issue;
}
