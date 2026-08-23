export type ContentAuditRecommendation = "keep" | "update" | "merge" | "redirect";

export type ContentAuditInput = {
  publishedAt?: string | null;
  impressions: number;
  clicks: number;
  ctrPercent: number;
  averagePosition: number;
  leads: number;
  convertedLeads: number;
  indexVerdict?: string | null;
  now?: Date;
};

export function recommendContentAudit(input: ContentAuditInput): { recommendation: ContentAuditRecommendation; reason: string; requiresHumanDecision: true } {
  const now = input.now ?? new Date();
  const published = input.publishedAt ? new Date(input.publishedAt) : null;
  const ageDays = published && !Number.isNaN(published.getTime()) ? Math.max(0, Math.floor((now.getTime() - published.getTime()) / 86_400_000)) : 0;
  const verdict = (input.indexVerdict || "").toUpperCase();
  if (verdict && !["PASS", "NEUTRAL"].includes(verdict)) return { recommendation: "update", reason: "Google-indekseringen må kontrolleres før innholdet vurderes videre.", requiresHumanDecision: true };
  if (input.convertedLeads > 0 || input.leads > 1 || input.clicks >= 20) return { recommendation: "keep", reason: "Artikkelen gir dokumenterte klikk eller henvendelser og bør beholdes mens resultatene følges.", requiresHumanDecision: true };
  if (ageDays >= 180 && input.impressions < 20 && input.leads === 0) return { recommendation: "merge", reason: "Eldre artikkel har svært lav synlighet og ingen henvendelser; vurder sammenslåing med en sterkere side.", requiresHumanDecision: true };
  if (input.impressions >= 100 && (input.ctrPercent < 1.5 || (input.averagePosition >= 8 && input.averagePosition <= 30))) return { recommendation: "update", reason: "Artikkelen vises i Google, men tittel, innhold eller internlenking har forbedringspotensial.", requiresHumanDecision: true };
  return { recommendation: "keep", reason: "Datagrunnlaget er foreløpig for svakt til å anbefale en større endring.", requiresHumanDecision: true };
}
