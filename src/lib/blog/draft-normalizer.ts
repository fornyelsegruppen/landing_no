import { approvedPackageDefinitions } from "./knowledge-base";

const approvedNorwegianReplacements: Array<[RegExp, string]> = [
  [
    /sterkt\s+angrepet\s+av\s+tilstoppinger/gi,
    "sterkt begrodd med mose, lav eller alger",
  ],
  [/ekstra\s+omtanke\s+under\s+utførelsen/gi, "ekstra sikkerhetstiltak"],
  [/geografiske\s+beliggenhet/gi, "geografisk beliggenhet"],
  [/som\s+redusere\s+fuktopptak/gi, "som reduserer fuktopptak"],
  [/høyt\s+monterte\s+flater/gi, "vanskelig tilgjengelige takflater"],
  [/streng\s+regulering\s+knyttet\s+til/gi, "tydelige sikkerhetskrav for"],
  [
    /organisk\s+materiale\s+som\s+mose\s+og\s+sot/gi,
    "mose, lav, alger og smuss",
  ],
  [
    /impregnering\s+som\s+(styrker|forsterker)\s+taksteinen/gi,
    "impregnering som reduserer fuktopptak på egnet takstein",
  ],
  [
    /forlenger\s+du\s+takets\s+levetid\s+(betraktelig|betydelig)/gi,
    "kan riktig behandling bidra til å forlenge takets levetid når taket er teknisk egnet",
  ],
  [
    /Be\s+om\s+postnummer,\s*valgfri\s+adresse\s+og\s+gjerne\s+bilder,\s*uten\s+å\s+love\s+endelig\s+teknisk\s+konklusjon\s+eller\s+pris\.?/g,
    "For å forberede vurderingen kan du oppgi postnummer, valgfri adresse og gjerne sende bilder.",
  ],
];

function normalizeNorwegianText(value: string) {
  return approvedNorwegianReplacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

function normalizePackageLines(content: string) {
  return content
    .split("\n")
    .map((line) => {
      const match = line.match(
        /^\s*[-*]\s+\*{0,2}(Basic|Standard|Premium)\*{0,2}\s*:.*$/i,
      );
      if (!match) return line;
      const name =
        `${match[1]?.[0]?.toUpperCase()}${match[1]?.slice(1).toLowerCase()}` as keyof typeof approvedPackageDefinitions;
      return `- ${approvedPackageDefinitions[name]}`;
    })
    .join("\n");
}

export function normalizeGeneratedArticleDraft(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const article = input as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...article };

  for (const field of [
    "title",
    "excerpt",
    "seoTitle",
    "seoDescription",
  ] as const) {
    if (typeof article[field] === "string") {
      normalized[field] = normalizeNorwegianText(article[field]);
    }
  }
  if (typeof article.content === "string") {
    normalized.content = normalizePackageLines(
      normalizeNorwegianText(article.content),
    );
  }
  if (Array.isArray(article.faq)) {
    normalized.faq = article.faq.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const faq = item as Record<string, unknown>;
      return {
        ...faq,
        ...(typeof faq.question === "string"
          ? { question: normalizeNorwegianText(faq.question) }
          : {}),
        ...(typeof faq.answer === "string"
          ? { answer: normalizeNorwegianText(faq.answer) }
          : {}),
      };
    });
  }

  return normalized;
}
