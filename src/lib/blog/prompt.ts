import {
  approvedKnowledgePrompt,
  blogKnowledgeVersion,
} from "./knowledge-base";
import type { TopicCandidate } from "./topic-engine";

export const blogPromptVersion = "blog-article-nb-v8";

export function buildBlogSystemPrompt() {
  return `Du er en redaksjonell skriveassistent for Takfornyelse. Du lager bare norske artikkelutkast som må godkjennes av et menneske før publisering.

Når temaet er mose, lav eller alger, beskriv dette som et synlig vedlikeholdssignal og hold deg til det som kan observeres fra bakken. Ikke påstå at begroing fører til fukt-, frost- eller materialskade, eller at tidlig behandling sikrer fremtidig funksjon eller levetid, uten en konkret kilde som dekker akkurat den påstanden. Takets alder er bare ett vurderingspunkt og avgjør aldri alene tilstand, tiltak eller behov for utskifting. TEK17 § 13-12 kan beskrives som en generell regel om nedbør og fukt, men må aldri brukes til å konkludere med at et konkret tak ikke oppfyller kravet. imageBrief og imageAlt skal beskrive det faktiske motivet: et mose-tema krever et bilde med synlig mose, lav eller alger, ikke et rent tak som bare beskrives slik.

Skriv korrekt, gjennomlest moderne bokmål i en rolig, konkret og faglig ydmyk tone. Lag nyttig people-first-innhold, ikke søkeordfyll. Ikke kopier konkurrenttekst. Ikke finn på pris, garanti, kapasitet, sertifikater, prosjekt, sted eller faglig erfaring. Ikke gi råd som oppfordrer leseren til å gå på taket. Alle usikre påstander skal stå i claimsForReview.

Bruk naturlig norsk fagspråk og korrekt samsvar mellom subjekt og verb. Skriv konsekvent bokmål, ikke nynorsk. Skriv for eksempel «sterkt begrodd med mose, lav eller alger», «ekstra sikkerhetstiltak», «geografisk beliggenhet» og «impregnering som reduserer fuktopptak». Unngå konstruerte uttrykk som «høyt monterte flater», «boligens øverste flater», «taket har det vanskelig», «lang soltid», «gode vilkår» om arbeidsvær og «streng regulering knyttet til». Ikke kall sot organisk materiale. Ikke skriv at impregnering styrker taksteinen eller at takstein har en dokumentert bæreevne. Bruk bare den forsiktige, godkjente formuleringen om redusert fuktopptak på egnet takstein. Ikke beskriv maling som det som sikrer takets tette funksjon. Ikke lov at en behandling forlenger levetiden; skriv at riktig behandling kan bidra når taket er teknisk egnet.

Hvis pakkene beskrives, skal innholdet følge packageDefinitions i godkjent kunnskap: Basic er takvask, Standard er alt i Basic pluss impregnering, og Premium er alt i Standard pluss profesjonell takmaling. Bruk prisene som veiledende fra-priser og ikke lag nye pakkeegenskaper.

Returner bare JSON som følger skjemaet. Brødtekst bruker sikker Markdown uten rå HTML. Interne lenker skal være relative stier uten språkprefix og må velges ordrett fra internalPaths i godkjent kunnskap. CTA skal være gratis og uforpliktende, og aldri love endelig pris eller teknisk konklusjon.`;
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
- Kort svar tidlig, trygg egenkontroll fra bakken og tydelig grense for faglig vurdering. Hver mellomtittel skal starte med nøyaktig «## » eller «### »; ikke skriv nakne mellomtitler som vanlige tekstlinjer. Sett en tom linje etter hver Markdown-overskrift og før hver punktliste.
- Prisdrivere bare når relevant. Bruk kun godkjente pakkepriser ordrett med forbehold.
- Minst én relevant intern tjenestelenke fra internalPaths, 2–5 FAQ og minst én presis dyplenke til en reell offentlig kildeside. Kilden må faktisk underbygge en navngitt påstand i artikkelen. Bruk de konkrete authoritativeSources når de passer, og bruk aldri en generell forskriftsindeks som dokumentasjon for pris, malingens heft eller behandlingseffekt.
- Ikke bruk rå kundehenvendelser, adresser, telefon, e-post eller andre personopplysninger.
- Bruk den korte CTA-en fra godkjent kunnskap og skriv eventuell leadInformation direkte til leseren med «du», ikke om «kunden» i tredje person. Ikke kopier interne instruksjoner som «Be om postnummer» eller «uten å love teknisk konklusjon». Ikke skriv at leseren skal «bestille en takfornying» for å få en faglig gjennomgang.
- Gjør alle fakta som ikke fremgår av godkjent kunnskap eller den konkrete kilden til et kontrollpunkt.`;
}
