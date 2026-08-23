import {
  generatedArticleSchema,
  type GeneratedArticle,
} from "./article-schema";
import { approvedBlogKnowledge } from "./knowledge-base";
import { topicOverlap, type ExistingTopic, type TopicCandidate } from "./topic-engine";

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
  "99 kr/m2 + mva",
  "138 kr/m2 + mva",
  "337 kr/m2 + mva",
];

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
  const matches = content.match(/\b\d[\d ]{0,8}\s*kr(?:\/m2)?(?:\s*\+\s*mva)?/gi) || [];
  return matches.filter(
    (match) =>
      !allowedPriceFragments.some((approved) =>
        approved.toLowerCase().includes(match.toLowerCase().replace(/\s+/g, " ")),
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
      add(issues, "schema", "invalid_output", "blocker", `${error.path.join(".")}: ${error.message}`);
    }
    return { passed: false, score: 0, issues, checkedAt: now.toISOString() };
  }

  const article: GeneratedArticle = parsed.data;
  const allText = `${article.title}\n${article.excerpt}\n${article.content}\n${article.seoDescription}`;
  const lower = allText.toLocaleLowerCase("nb-NO");

  for (const claim of approvedBlogKnowledge.forbiddenClaims) {
    if (lower.includes(claim.toLocaleLowerCase("nb-NO"))) {
      add(issues, "facts", "forbidden_claim", "blocker", `Ikke-godkjent påstand: ${claim}`);
    }
  }
  if (/\b\d+\s*års?\s+garanti\b|\bgaranterer\b/i.test(allText)) {
    add(issues, "facts", "unsupported_guarantee", "blocker", "Garanti eller garantilengde krever menneskelig godkjenning.");
  }
  if (unapprovedPrices(allText).length) {
    add(issues, "facts", "unapproved_price", "blocker", "Teksten inneholder pris som ikke finnes i godkjent kunnskap.");
  }
  if (
    /\bdu\s+kan\s+(gå|klatre|krabbe)\w*\s+(opp\s+)?på\s+taket\b|\b(gå|klatre|krabb)\w*\s+(opp\s+)?på\s+taket\s+selv\b/i.test(
      allText,
    )
  ) {
    add(issues, "facts", "unsafe_roof_advice", "blocker", "Teksten kan oppfordre kunden til arbeid i høyden.");
  }
  if (/\b(š|ž|ą|ę|ė|į|ų|ū)\b|\b(kaina|stogas|paslauga)\b/i.test(allText)) {
    add(issues, "language", "mixed_language", "blocker", "Teksten ser ut til å blande inn et annet språk.");
  }

  const contentWords = words(article.content);
  if (contentWords.length < 700) {
    add(issues, "seo", "content_too_short", "warning", `Artikkelen har bare ${contentWords.length} ord.`);
  } else if (contentWords.length > 1_600) {
    add(issues, "seo", "content_too_long", "warning", `Artikkelen har ${contentWords.length} ord og bør strammes inn.`);
  }
  const keywordWords = words(article.primaryKeyword);
  const keywordHits = keywordWords.length
    ? contentWords.filter((word) => keywordWords.includes(word)).length
    : 0;
  if (contentWords.length && keywordHits / contentWords.length > 0.09) {
    add(issues, "seo", "keyword_stuffing", "blocker", "Primært søkeord gjentas unaturlig ofte.");
  }

  const maximumOverlap = existing.reduce(
    (max, item) => Math.max(max, topicOverlap(`${article.title} ${article.primaryKeyword}`, `${item.title} ${item.primaryKeyword || ""}`)),
    0,
  );
  if (maximumOverlap >= 70) {
    add(issues, "originality", "high_overlap", "blocker", `Overlapp med eksisterende innhold er ${maximumOverlap} %.`);
  } else if (maximumOverlap >= 50) {
    add(issues, "originality", "moderate_overlap", "warning", `Overlapp med eksisterende innhold er ${maximumOverlap} %.`);
  }

  if (!article.internalLinks.some((link) => link.href !== "/")) {
    add(issues, "seo", "missing_internal_link", "blocker", "Minst én relevant intern lenke mangler.");
  }
  if (!lower.includes(topic.primaryKeyword.toLocaleLowerCase("nb-NO").split(" ")[0] || "")) {
    add(issues, "seo", "topic_mismatch", "warning", "Artikkelen kan ha svak kobling til primærtemaet.");
  }
  if (article.claimsForReview.length > 6) {
    add(issues, "facts", "too_many_unverified_claims", "warning", "Mange påstander krever menneskelig kontroll.");
  }
  if (!/gratis|uforpliktende|vurdering|befaring/i.test(allText)) {
    add(issues, "conversion", "unclear_next_step", "warning", "Neste steg for leseren er ikke tydelig.");
  }

  const blockers = issues.filter((issue) => issue.severity === "blocker").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, 100 - blockers * 30 - warnings * 7);
  return {
    passed: blockers === 0 && score >= 75,
    score,
    issues,
    checkedAt: now.toISOString(),
  };
}
