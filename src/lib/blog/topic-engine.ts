import type { SearchSignal } from "@/lib/providers/contracts";

export type TopicFactors = {
  serviceRelevance: number;
  demand: number;
  commercialValue: number;
  contentGap: number;
  seasonalRelevance: number;
  originalEvidence: number;
  localRelevance: number;
};

export type ExistingTopic = {
  title: string;
  primaryKeyword?: string | null;
};

export type TopicCandidate = {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: "informational" | "commercial" | "local" | "comparison";
  source: "search_console" | "ads" | "trends" | "lead" | "manual";
  serviceKey: string;
  location?: string;
  season?: string;
  factors: TopicFactors;
  reason: string;
  /** Aggregated evidence only; omitted for manually curated topics. */
  sourceSignal?: SearchSignal;
};

export type EditorialTarget = "Oslo" | "Bærum" | "Asker" | "Lillestrøm" | "Lørenskog" | "Ski";

const serviceMatchers: Array<{ key: string; pattern: RegExp }> = [
  { key: "nytt-tak", pattern: /\b(nytt\s+tak|takbytte|bytte\s+tak|legge\s+nytt\s+tak)\b/i },
  { key: "takmaling", pattern: /\b(takmaling|taksteinmaling|male\s+tak(?:et|stein(?:en)?)?|maling\s+(?:av\s+)?tak(?:et|stein(?:en)?)?)\b/i },
  { key: "impregnering", pattern: /\b(takimpregnering|impregner(?:ing|e)\s+(?:av\s+)?tak(?:et|stein(?:en)?)?)\b/i },
  { key: "takfornying", pattern: /\b(takfornying|takfornyelse)\b/i },
  { key: "takvask", pattern: /\b(takvask|taksteinvask|vask(?:e|ing)?\s+(?:av\s+)?tak(?:et|stein(?:en)?)?|høytrykksvask\s+(?:av\s+)?tak(?:et|stein(?:en)?)?|mose\s+(?:på|av)\s+tak(?:et|stein(?:en)?)?|alger\s+(?:på|av)\s+tak(?:et|stein(?:en)?)?|lav\s+(?:på|av)\s+tak(?:et|stein(?:en)?)?)\b/i },
];

const editorialTargetMatchers: Array<{ target: EditorialTarget; pattern: RegExp }> = [
  { target: "Oslo", pattern: /\boslo\b/i },
  { target: "Bærum", pattern: /\bbærum\b/i },
  { target: "Asker", pattern: /\basker\b/i },
  { target: "Lillestrøm", pattern: /\blillestrøm\b/i },
  { target: "Lørenskog", pattern: /\blørenskog\b/i },
  { target: "Ski", pattern: /\bski\b/i },
];

// Deliberately bounded. This rejects only explicit known out-of-area city
// terms; it is not a parser or proof of a searcher's physical location.
const unsupportedEditorialTargetMatchers = [
  /(^|[^\p{L}])ålesund(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])bergen(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])trondheim(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])stavanger(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])tromsø(?=$|[^\p{L}])/iu,
];

const weights: Record<keyof TopicFactors, number> = {
  serviceRelevance: 25,
  demand: 20,
  commercialValue: 15,
  contentGap: 15,
  seasonalRelevance: 10,
  originalEvidence: 10,
  localRelevance: 5,
};

const stopWords = new Set([
  "og",
  "i",
  "på",
  "for",
  "er",
  "det",
  "en",
  "et",
  "til",
  "av",
  "med",
  "hva",
  "når",
]);

export function normalizeTopicTokens(value: string) {
  return [...new Set(
    value
      .toLocaleLowerCase("nb-NO")
      .normalize("NFKD")
      .replace(/[^a-z0-9æøå\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((token) => token.length > 1 && !stopWords.has(token)),
  )];
}

export function topicOverlap(left: string, right: string) {
  const a = new Set(normalizeTopicTokens(left));
  const b = new Set(normalizeTopicTokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return Math.round((intersection / new Set([...a, ...b]).size) * 100);
}

export function highestTopicOverlap(
  candidate: Pick<TopicCandidate, "topic" | "primaryKeyword">,
  existing: ExistingTopic[],
) {
  return existing.reduce(
    (highest, item) =>
      Math.max(
        highest,
        topicOverlap(
          `${candidate.topic} ${candidate.primaryKeyword}`,
          `${item.title} ${item.primaryKeyword || ""}`,
        ),
      ),
    0,
  );
}

export function topicScore(factors: TopicFactors) {
  return Math.round(
    (Object.keys(weights) as (keyof TopicFactors)[]).reduce((total, key) => {
      const normalized = Math.min(1, Math.max(0, factors[key]));
      return total + normalized * weights[key];
    }, 0),
  );
}

export function containsPersonalData(value: string) {
  return (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /(?:\+?47)?[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}/.test(value) ||
    /\b\d{1,4}\s+[A-Za-zÆØÅæøå][A-Za-zÆØÅæøå-]+(?:veien|gata|gate|vei)\b/i.test(
      value,
    )
  );
}

function osloMonth(now: Date) {
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    month: "numeric",
  }).formatToParts(now).find((part) => part.type === "month")?.value;
  return Number(month || 0);
}

export function seasonalRelevanceForTopic(value: string, now = new Date()) {
  const month = osloMonth(now);
  const topic = value.toLocaleLowerCase("nb-NO");
  const winter = /\b(vinter(?:en)?|snø|frost|is)\b/.test(topic);
  const spring = /\b(vår|etter vinter(?:en)?)\b/.test(topic);
  const autumn = /\b(høst|høstregn|løv)\b/.test(topic);
  const roofCare = /\b(takvask|impregner|takmaling|takfornying|takfornyelse)\b/.test(topic);

  if (spring) return month >= 3 && month <= 5 ? 1 : 0.3;
  if (winter) return month === 11 || month === 12 || month <= 2 ? 1 : 0.25;
  if (autumn) return month >= 8 && month <= 10 ? 1 : 0.3;
  if (roofCare) return month >= 4 && month <= 10 ? 0.75 : 0.45;
  return 0.5;
}

export function serviceKeyForSignal(query: string) {
  return serviceMatchers.find(({ pattern }) => pattern.test(query))?.key;
}

export function editorialTargetForSignal(query: string): EditorialTarget | undefined {
  return editorialTargetMatchers.find(({ pattern }) => pattern.test(query))?.target;
}

export function hasUnsupportedEditorialTarget(query: string) {
  return unsupportedEditorialTargetMatchers.some((pattern) => pattern.test(query));
}

export function candidateFromSignal(signal: SearchSignal, now = new Date()): TopicCandidate | null {
  if (containsPersonalData(signal.query)) return null;
  const sourceMap = {
    "search-console": "search_console",
    ads: "ads",
    trends: "trends",
    lead: "lead",
    manual: "manual",
  } as const;
  const query = signal.query.trim();
  if (query.length < 5 || query.length > 140) return null;
  if (hasUnsupportedEditorialTarget(query)) return null;
  const serviceKey = serviceKeyForSignal(query);
  if (!serviceKey) return null;
  const editorialTarget = editorialTargetForSignal(query);
  const commercial = /pris|kost|tilbud|befaring|m2/.test(query.toLowerCase());
  return {
    topic: query.charAt(0).toUpperCase() + query.slice(1),
    primaryKeyword: query.toLowerCase(),
    secondaryKeywords: [],
    searchIntent: commercial ? "commercial" : "informational",
    source: sourceMap[signal.source],
    serviceKey,
    factors: {
      serviceRelevance: 1,
      demand: Math.min(
        1,
        signal.impressions !== undefined
          ? signal.impressions / 500
          : signal.score !== undefined
            ? signal.score / 100
            : 0.2,
      ),
      commercialValue: commercial ? 0.9 : 0.55,
      contentGap: 0.8,
      seasonalRelevance: seasonalRelevanceForTopic(query, now),
      originalEvidence: 0.5,
      // This is only a curated editorial priority; it does not claim that the
      // source measured demand in this city or that the searcher was local.
      localRelevance: editorialTarget ? 1 : 0.35,
    },
    reason: `Aggregert signal fra ${signal.source}; ingen kundeidentitet er brukt.${editorialTarget ? ` Redaksjonelt prioritert for ${editorialTarget}; søkesignalets geografi er ikke målt.` : ""}`,
    sourceSignal: signal,
  };
}

/**
 * Keeps evidence in the schema-free sourceMetrics JSON without inferring data
 * that a query alone cannot establish (notably geographic coverage).
 */
export function sourceMetricsFromSignal(signal: SearchSignal, importedAt: string) {
  const metrics = {
    ...(signal.impressions !== undefined ? { impressions: signal.impressions } : {}),
    ...(signal.clicks !== undefined ? { clicks: signal.clicks } : {}),
    ...(signal.score !== undefined ? { score: signal.score } : {}),
  };
  const hasCompletePeriod = Boolean(signal.periodStart && signal.periodEnd);

  return {
    kind: "aggregated-search-signal",
    source: signal.source,
    origin: signal.origin || "unknown",
    importedAt,
    ...(Object.keys(metrics).length ? { metrics } : {}),
    ...(signal.periodStart || signal.periodEnd
      ? {
          observationPeriod: {
            ...(signal.periodStart ? { start: signal.periodStart } : {}),
            ...(signal.periodEnd ? { end: signal.periodEnd } : {}),
          },
        }
      : {}),
    provenanceCoverage: {
      observationPeriod: hasCompletePeriod ? "known" : "unknown",
      geography: "unknown",
    },
  };
}

const manualTopicSeedDefinitions = [
  ["Hva koster takvask per m2?", "takvask pris", "commercial", "takvask"],
  ["Takfornying eller nytt tak – hva bør vurderes?", "takfornying eller nytt tak", "comparison", "takfornying"],
  ["Hva påvirker prisen på takmaling?", "takmaling pris", "commercial", "takmaling"],
  ["Når lønner det seg å impregnere takstein?", "impregnering av takstein", "commercial", "impregnering"],
  ["Mose på taket: når er det et vedlikeholdsproblem?", "mose på taket", "informational", "takvask"],
  ["Kan alle typer tak høytrykksvaskes?", "høytrykksvask av tak", "informational", "takvask"],
  ["Tegn på at takstein ikke bør males", "male takstein", "informational", "takmaling"],
  ["Slik vurderes taket etter vinteren", "sjekk tak etter vinter", "informational", "takfornying"],
  ["Når på året er det best å vaske taket?", "beste tid for takvask", "informational", "takvask"],
  ["Takfornying i Oslo: hva bør boligeiere vurdere?", "takfornying Oslo", "local", "takfornying"],
];

/**
 * Inject `now` for seasonal ranking. The legacy constant remains for callers
 * that only need the seed list; scheduled generation should call this factory.
 */
export function getManualTopicSeeds(now = new Date()): TopicCandidate[] {
  return manualTopicSeedDefinitions.map(([topic, keyword, intent, serviceKey]) => ({
  topic,
  primaryKeyword: keyword,
  secondaryKeywords: [],
  searchIntent: intent as TopicCandidate["searchIntent"],
  source: "manual" as const,
  serviceKey,
  ...(intent === "local" ? { location: "Oslo" } : {}),
  factors: {
    serviceRelevance: 1,
    demand: 0.55,
    commercialValue: intent === "commercial" ? 0.9 : 0.65,
    contentGap: 0.8,
    seasonalRelevance: seasonalRelevanceForTopic(`${topic} ${keyword}`, now),
    originalEvidence: 0.5,
    localRelevance: intent === "local" ? 1 : 0,
  },
  reason: "Godkjent manuell fagplan for Takfornyelse.",
  }));
}

export const manualTopicSeeds = getManualTopicSeeds();
