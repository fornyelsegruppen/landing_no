import {
  generatedArticleSchema,
  type GeneratedArticle,
} from "./article-schema";
import { approvedBlogKnowledge } from "./knowledge-base";
import {
  isPreciseSourceUrl,
  isSubstantiveBlogSourceUrl,
} from "./editorial-policy";
import {
  topicOverlap,
  type ExistingTopic,
  type TopicCandidate,
} from "./topic-engine";

export type QualityIssue = {
  gate: "schema" | "facts" | "language" | "originality" | "seo" | "conversion";
  code: string;
  severity: "warning" | "blocker";
  message: string;
};

export type ArticleQualityResult = {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
  checkedAt: string;
};

const allowedPriceFragments = [
  "99 kr/m² + mva",
  "138 kr/m² + mva",
  "337 kr/m² + mva",
];

const allowedInternalPaths = new Set<string>(
  approvedBlogKnowledge.internalPaths,
);

function words(value: string): string[] {
  return value.toLocaleLowerCase("nb-NO").match(/[a-zæøå0-9]+/g) || [];
}

function add(
  issues: QualityIssue[],
  gate: QualityIssue["gate"],
  code: string,
  severity: QualityIssue["severity"],
  message: string,
) {
  issues.push({ gate, code, severity, message });
}

function unapprovedPrices(content: string) {
  const matches =
    content.match(/\b\d[\d ]{0,8}\s*kr(?:\/m(?:2|²))?(?:\s*\+\s*mva)?/gi) || [];
  return matches.filter(
    (match) =>
      !allowedPriceFragments.some((approved) =>
        approved
          .toLowerCase()
          .includes(match.toLowerCase().replace(/\s+/g, " ")),
      ),
  );
}

export function evaluateArticleQuality(
  input: unknown,
  topic: TopicCandidate,
  existing: ExistingTopic[] = [],
  now: Date = new Date(),
): ArticleQualityResult {
  const issues: QualityIssue[] = [];
  const parsed = generatedArticleSchema.safeParse(input);
  if (!parsed.success) {
    for (const error of parsed.error.issues.slice(0, 8)) {
      add(
        issues,
        "schema",
        "invalid_output",
        "blocker",
        `${error.path.join(".")}: ${error.message}`,
      );
    }
    return { passed: false, score: 0, issues, checkedAt: now.toISOString() };
  }

  const article: GeneratedArticle = parsed.data;
  const allText = `${article.title}\n${article.excerpt}\n${article.content}\n${article.seoDescription}`;
  const lower = allText.toLocaleLowerCase("nb-NO");

  for (const claim of approvedBlogKnowledge.forbiddenClaims) {
    if (lower.includes(claim.toLocaleLowerCase("nb-NO"))) {
      add(
        issues,
        "facts",
        "forbidden_claim",
        "blocker",
        `Ikke-godkjent påstand: ${claim}`,
      );
    }
  }
  if (/\b\d+\s*års?\s+garanti\b|\bgaranterer\b/i.test(allText)) {
    add(
      issues,
      "facts",
      "unsupported_guarantee",
      "blocker",
      "Garanti eller garantilengde krever menneskelig godkjenning.",
    );
  }
  if (unapprovedPrices(allText).length) {
    add(
      issues,
      "facts",
      "unapproved_price",
      "blocker",
      "Teksten inneholder pris som ikke finnes i godkjent kunnskap.",
    );
  }
  if (
    /\bdu\s+kan\s+(gå|klatre|krabbe)\w*\s+(opp\s+)?på\s+taket\b|\b(gå|klatre|krabb)\w*\s+(opp\s+)?på\s+taket\s+selv\b/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "facts",
      "unsafe_roof_advice",
      "blocker",
      "Teksten kan oppfordre kunden til arbeid i høyden.",
    );
  }
  if (/\b(š|ž|ą|ę|ė|į|ų|ū)\b|\b(kaina|stogas|paslauga)\b/i.test(allText)) {
    add(
      issues,
      "language",
      "mixed_language",
      "blocker",
      "Teksten ser ut til å blande inn et annet språk.",
    );
  }
  if (
    /sterkt\s+angrepet\s+av\s+tilstoppinger|ekstra\s+omtanke\s+under\s+utførelsen|geografiske\s+beliggenhet|som\s+redusere\s+fuktopptak|høyt\s+monterte\s+flater|streng\s+regulering\s+knyttet\s+til|boligens\s+øverste\s+flater|taket\s+har\s+det\s+vanskelig|lang\s+soltid|påfølgende\s+behandlinger\s+skal\s+få\s+gode\s+vilkår|nedfall\s+i\s+form\s+av\s+blader|\bindikasjonar\b|samt\s+sende\s+gjerne|hva\s+en\s+befant\s+viser|takets\s+faktiske\s+tåleevne|boligens\s+ytre\s+vern\s+mot\s+nedbør|type\s+begroing:\s*sterkt\s+begrodd|\betne\s+seg\s+fast\b|\bhar\s+slutten\s+å\s+regne\b|\bsterk\s+begrodd\s+mose\b/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "language",
      "unnatural_norwegian",
      "blocker",
      "Teksten inneholder unaturlig eller grammatisk feil norsk som må omskrives.",
    );
  }
  if (/organisk\s+materiale[^.]{0,100}\bsot\b/i.test(allText)) {
    add(
      issues,
      "facts",
      "material_category_error",
      "blocker",
      "Sot skal ikke beskrives som organisk materiale.",
    );
  }
  if (/takstein\w*[^.]{0,120}\bbæreevne\b/i.test(allText)) {
    add(
      issues,
      "facts",
      "unsupported_roof_tile_load_claim",
      "blocker",
      "Taksteinens bæreevne skal ikke brukes som vurderingskriterium uten en presis fagkilde.",
    );
  }
  if (
    /overflatebehandling[^.]{0,180}(sikre|ivareta)[^.]{0,80}(tett|tette)\s+funksjon/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "facts",
      "roof_system_function_claim",
      "blocker",
      "Maling eller annen overflatebehandling skal ikke beskrives som det som sikrer takets tette funksjon.",
    );
  }
  if (/\buunngåelig\s+takskifte\b/i.test(allText)) {
    add(
      issues,
      "facts",
      "overstated_replacement_claim",
      "blocker",
      "Behov for takskifte krever faglig vurdering og skal ikke fremstilles som uunngåelig.",
    );
  }
  if (
    /(?:tidlig|rask)\s+(?:vask|behandling)[^.]{0,160}\b(?:sikrer|sikre)\b[^.]{0,140}\b(?:trygt|funksjonelt|mange\s+år)\b/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "facts",
      "overstated_treatment_outcome",
      "blocker",
      "Takbehandling skal ikke beskrives som en sikker garanti for fremtidig funksjon eller levetid.",
    );
  }
  if (
    /\b(?:mose|lav|alger)\b[^.]{0,140}\b(?:fukt|frost)\b[^.]{0,140}\b(?:skade|sprekker|forverr)\w*/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "facts",
      "unsupported_growth_damage_claim",
      "blocker",
      "Påstander om begroing, fukt, frost og skade krever en presis kilde som faktisk dekker sammenhengen.",
    );
  }
  if (
    /impregnering[\s\S]{0,80}(styrker|forsterker)[\s\S]{0,50}takstein/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "facts",
      "unsupported_impregnation_claim",
      "blocker",
      "Impregnering skal ikke beskrives som om den styrker selve taksteinen.",
    );
  }
  if (
    /forlenger\s+(du\s+)?takets\s+levetid\s+(betraktelig|betydelig)/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "facts",
      "unsupported_lifetime_claim",
      "blocker",
      "Levetidseffekt må formuleres forsiktig og forutsette at taket er teknisk egnet.",
    );
  }
  if (
    /bestille\s+en\s+\[?takfornying\]?[\s\S]{0,100}faglig\s+gjennomgang/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "conversion",
      "inspection_cta_mismatch",
      "blocker",
      "CTA-en skal be om en gratis og uforpliktende vurdering, ikke bestilling av takfornying.",
    );
  }
  if (
    /be\s+om\s+postnummer[^.]{0,240}(uten\s+å\s+love|teknisk\s+konklusjon)|for\s+å\s+forberede\s+vurderingen\s+kan\s+kunden\s+oppgi/i.test(
      allText,
    )
  ) {
    add(
      issues,
      "conversion",
      "internal_instruction_leak",
      "blocker",
      "Intern CTA-instruksjon må omskrives til naturlig lesertekst.",
    );
  }

  const packageExplanation = lower.match(
    /\bbasic\b[\s\S]{0,500}\bstandard\b[\s\S]{0,500}\bpremium\b/,
  );
  if (
    packageExplanation &&
    !(
      /\bbasic\b[\s\S]{0,180}\btakvask\b/.test(lower) &&
      /\bstandard\b[\s\S]{0,220}\b(alt i basic|takvask)\b[\s\S]{0,120}\bimpregnering\b/.test(
        lower,
      ) &&
      /\bpremium\b[\s\S]{0,220}\b(alt i standard|impregnering)\b[\s\S]{0,160}\btakmaling\b/.test(
        lower,
      )
    )
  ) {
    add(
      issues,
      "facts",
      "package_definition_drift",
      "blocker",
      "Pakkeinnholdet må følge den godkjente Basic-, Standard- og Premium-strukturen.",
    );
  }

  const contentWords = words(article.content);
  const markdownHeadingCount = (
    article.content.match(/^#{2,3}\s+\S.+$/gm) || []
  ).length;
  if (markdownHeadingCount < 2) {
    add(
      issues,
      "seo",
      "missing_markdown_structure",
      "blocker",
      "Artikkelen må ha minst to mellomtitler markert som H2 eller H3 i Markdown.",
    );
  }
  if (contentWords.length < 700) {
    add(
      issues,
      "seo",
      "content_too_short",
      "warning",
      `Artikkelen har bare ${contentWords.length} ord.`,
    );
  } else if (contentWords.length > 1_600) {
    add(
      issues,
      "seo",
      "content_too_long",
      "warning",
      `Artikkelen har ${contentWords.length} ord og bør strammes inn.`,
    );
  }
  const keywordWords = words(article.primaryKeyword);
  const keywordHits = keywordWords.length
    ? contentWords.filter((word) => keywordWords.includes(word)).length
    : 0;
  if (contentWords.length && keywordHits / contentWords.length > 0.09) {
    add(
      issues,
      "seo",
      "keyword_stuffing",
      "blocker",
      "Primært søkeord gjentas unaturlig ofte.",
    );
  }

  const maximumOverlap = existing.reduce(
    (max, item) =>
      Math.max(
        max,
        topicOverlap(
          `${article.title} ${article.primaryKeyword}`,
          `${item.title} ${item.primaryKeyword || ""}`,
        ),
      ),
    0,
  );
  if (maximumOverlap >= 70) {
    add(
      issues,
      "originality",
      "high_overlap",
      "blocker",
      `Overlapp med eksisterende innhold er ${maximumOverlap} %.`,
    );
  } else if (maximumOverlap >= 50) {
    add(
      issues,
      "originality",
      "moderate_overlap",
      "warning",
      `Overlapp med eksisterende innhold er ${maximumOverlap} %.`,
    );
  }

  if (!article.internalLinks.some((link) => link.href !== "/")) {
    add(
      issues,
      "seo",
      "missing_internal_link",
      "blocker",
      "Minst én relevant intern lenke mangler.",
    );
  }
  if (
    article.internalLinks.some((link) => !allowedInternalPaths.has(link.href))
  ) {
    add(
      issues,
      "seo",
      "invalid_internal_link",
      "blocker",
      "Utkastet foreslår en intern lenke som ikke finnes i godkjent ruteliste.",
    );
  }
  const preciseSourceCount = article.sources.filter((source) =>
    isSubstantiveBlogSourceUrl(source.url),
  ).length;
  if (preciseSourceCount < 1) {
    add(
      issues,
      "facts",
      "missing_precise_source",
      "blocker",
      "Minst én presis kildeside må være oppgitt før artikkelen kan gå videre.",
    );
  }
  if (article.sources.some((source) => !isPreciseSourceUrl(source.url))) {
    add(
      issues,
      "facts",
      "source_homepage_only",
      "blocker",
      "Kilder som bare peker til en hjemmeside eller ugyldig URL må erstattes med presise kildesider.",
    );
  }
  if (
    article.sources.some(
      (source) =>
        isPreciseSourceUrl(source.url) &&
        !isSubstantiveBlogSourceUrl(source.url),
    )
  ) {
    add(
      issues,
      "facts",
      "generic_source_index",
      "blocker",
      "En generell forskriftsindeks kan ikke brukes som dokumentasjon for artikkelens faglige påstander.",
    );
  }
  if (
    !lower.includes(
      topic.primaryKeyword.toLocaleLowerCase("nb-NO").split(" ")[0] || "",
    )
  ) {
    add(
      issues,
      "seo",
      "topic_mismatch",
      "warning",
      "Artikkelen kan ha svak kobling til primærtemaet.",
    );
  }
  if (article.claimsForReview.length > 6) {
    add(
      issues,
      "facts",
      "too_many_unverified_claims",
      "warning",
      "Mange påstander krever menneskelig kontroll.",
    );
  }
  if (!/gratis|uforpliktende|vurdering|befaring/i.test(allText)) {
    add(
      issues,
      "conversion",
      "unclear_next_step",
      "warning",
      "Neste steg for leseren er ikke tydelig.",
    );
  }

  const blockers = issues.filter(
    (issue) => issue.severity === "blocker",
  ).length;
  const warnings = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const score = Math.max(0, 100 - blockers * 30 - warnings * 7);
  return {
    passed: blockers === 0 && score >= 75,
    score,
    issues,
    checkedAt: now.toISOString(),
  };
}
