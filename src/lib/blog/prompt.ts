import { approvedKnowledgePrompt, blogKnowledgeVersion } from "./knowledge-base";
import type { TopicCandidate } from "./topic-engine";

export const blogPromptVersion = "blog-article-nb-v1";

export function buildBlogSystemPrompt() {
  return `Du er en redaksjonell skriveassistent for Takfornyelse. Du lager bare norske artikkelutkast som må godkjennes av et menneske før publisering.

Skriv moderne bokmål i en rolig, konkret og faglig ydmyk tone. Lag nyttig people-first-innhold, ikke søkeordfyll. Ikke kopier konkurrenttekst. Ikke finn på pris, garanti, kapasitet, sertifikater, prosjekt, sted eller faglig erfaring. Ikke gi råd som oppfordrer leseren til å gå på taket. Alle usikre påstander skal stå i claimsForReview.

Returner bare JSON som følger skjemaet. Brødtekst bruker sikker Markdown uten rå HTML. Interne lenker skal være relative stier uten språkprefix. CTA skal være gratis og uforpliktende, og aldri love endelig pris eller teknisk konklusjon.`;
}

export function buildBlogArticlePrompt(
  topic: TopicCandidate,
  existingTitles: string[],
) {
  return `PROMPT_VERSION: ${blogPromptVersion}
KNOWLEDGE_VERSION: ${blogKnowledgeVersion}

GODKJENT KUNNSKAP:
${approvedKnowledgePrompt()}

TEMA:
${JSON.stringify({
  topic: topic.topic,
  primaryKeyword: topic.primaryKeyword,
  secondaryKeywords: topic.secondaryKeywords,
  searchIntent: topic.searchIntent,
  serviceKey: topic.serviceKey,
  location: topic.location || null,
  season: topic.season || null,
  source: topic.source,
  reason: topic.reason,
})}

EKSISTERENDE TITLER SOM IKKE SKAL KOPIERES ELLER KANNIBALISERES:
${JSON.stringify(existingTitles.slice(0, 100))}

KRAV:
- 900–1400 ord nyttig norsk fagtekst.
- Kort svar tidlig, logisk H2/H3-struktur, trygg egenkontroll fra bakken og tydelig grense for faglig vurdering.
- Prisdrivere bare når relevant. Bruk kun godkjente pakkepriser ordrett med forbehold.
- Minst én relevant intern tjenestelenke, 2–5 FAQ og minst én reell offentlig kilde.
- Ikke bruk rå kundehenvendelser, adresser, telefon, e-post eller andre personopplysninger.
- Gjør alle fakta som ikke fremgår av godkjent kunnskap eller kilden til et kontrollpunkt.`;
}
