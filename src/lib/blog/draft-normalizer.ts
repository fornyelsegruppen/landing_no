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
  [/taket\s+må\s+ha\s+andre\s+tiltak/gi, "taket trenger andre tiltak"],
  [/\bindikasjonar\b/gi, "indikasjoner"],
  [/\btaket\s+har\s+det\s+vanskelig\b/gi, "taket kan være i dårlig stand"],
  [/\bsamt\s+sende\s+gjerne\b/gi, "og gjerne sende"],
  [/\bKunden\s+får\s+alltid\s+et\b/g, "Du får alltid et"],
  [
    /organisk\s+materiale\s+som\s+mose\s+og\s+sot/gi,
    "mose, lav, alger og smuss",
  ],
  [
    /Når\s+man\s+vurderer\s+å\s+friske\s+opp\s+boligens\s+øverste\s+flater,\s*dukker\s+spørsmålet\s+om\s+timing\s+naturlig\s+opp\./gi,
    "Når du vurderer å vaske taket, er tidspunktet viktig.",
  ],
  [
    /For\s+at\s+en\s+takvask\s+og\s+påfølgende\s+behandlinger\s+skal\s+få\s+gode\s+vilkår,\s*må\s+klimaet\s+spille\s+på\s+lag\./gi,
    "For at takvask og eventuell etterbehandling skal kunne gjennomføres under gode forhold, må været være egnet.",
  ],
  [
    /Lang\s+soltid\s+og\s+varmere\s+luft\s+tørker\s+opp\s+taket\s+raskt\./gi,
    "Lange, varme dager kan bidra til at taket tørker raskere.",
  ],
  [
    /Mange\s+opplever\s+at\s+høsten\s+bringer\s+mye\s+fuktighet\s+og\s+nedfall\s+i\s+form\s+av\s+blader\./gi,
    "Høsten byr ofte på høyere luftfuktighet og løv som samler seg på taket og i takrennene.",
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
  [
    /For\s+å\s+forberede\s+vurderingen\s+kan\s+kunden\s+oppgi\s+postnummer,\s*valgfri\s+adresse\s+og\s+gjerne\s+sende\s+bilder\.\s*Dette\s+er\s+bakgrunnsinformasjon,\s*ikke\s+en\s+teknisk\s+konklusjon\s+eller\s+et\s+bindende\s+pristilbud\./gi,
    "Be om en gratis og uforpliktende vurdering. Oppgi gjerne postnummer og valgfri adresse, og send gjerne bilder av taket. Bildene hjelper oss å forberede vurderingen, men er ikke en teknisk konklusjon eller et bindende pristilbud.",
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
        /^\s*[-*]\s+\*{0,2}(Basic|Standard|Premium)\b.*$/i,
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
