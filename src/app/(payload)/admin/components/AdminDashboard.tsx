import Link from "next/link";
import { getPayload } from "@/lib/payload";
import { GenerateBlogDraftButton } from "./GenerateBlogDraftButton";
import { BlogTopicTools } from "./BlogTopicTools";
import { buildPlatformHealth } from "@/lib/platform/health";
import { buildReleaseGate } from "@/lib/platform/release-gate";
import { getAdminCopy, normalizePanelLocale } from "@/lib/panel-i18n";

type DashboardCounts = {
  activeWork: number;
  attention: number;
  newLeads: number;
  pendingContracts: number;
  pendingQuotes: number;
  unassignedWork: number;
  aiDrafts: number;
  replyDrafts: number;
  changeAgreements: number;
  upcomingWork: number;
  contentAudits: number;
};

async function loadCounts(): Promise<DashboardCounts> {
  try {
    const payload = await getPayload();
    const now = new Date(); const next72Hours = new Date(now.getTime() + 72 * 60 * 60_000);
    const [newLeads, aiDrafts, replyDrafts, operationalAttention, seoAttention, messageAttention, blockedWork, activeWork, unassignedWork, pendingQuotes, pendingContracts, changeAgreements, upcomingWork, contentAudits] = await Promise.all([
      payload.count({
        collection: "leads",
        where: { status: { equals: "new" } },
      }),
      payload.count({
        collection: "posts",
        where: { editorialStatus: { in: ["ai_qa", "human_review"] } },
      }),
      payload.count({
        collection: "messages",
        where: { status: { equals: "draft" } },
      }),
      payload.count({
        collection: "operational-jobs",
        where: { status: { in: ["failed", "attention"] } },
      }),
      payload.count({
        collection: "seo-runs",
        where: { status: { in: ["failed", "attention"] } },
      }),
      payload.count({
        collection: "messages",
        where: { status: { in: ["failed", "attention"] } },
      }),
      payload.count({
        collection: "work-orders",
        where: { status: { equals: "blocked" } },
      }),
      payload.count({
        collection: "work-orders",
        where: { status: { in: ["assigned", "scheduled", "on_way", "arrived", "precheck", "ready", "in_progress", "completed"] } },
      }),
      payload.count({
        collection: "work-orders",
        where: { status: { equals: "unassigned" } },
      }),
      payload.count({ collection: "quotes", where: { status: { equals: "draft" } } }),
      payload.count({ collection: "contracts", where: { status: { equals: "issued" } } }),
      payload.count({ collection: "change-agreements", where: { status: { in: ["draft", "approved", "sent", "viewed"] } } }),
      payload.count({ collection: "work-orders", where: { and: [{ scheduledAt: { greater_than_equal: now.toISOString() } }, { scheduledAt: { less_than_equal: next72Hours.toISOString() } }, { status: { not_in: ["cancelled", "documented"] } }] } }),
      payload.count({ collection: "posts", where: { and: [{ "contentAudit.recommendation": { in: ["update", "merge", "redirect"] } }, { "contentAudit.reviewedAt": { exists: false } }] } }),
    ]);

    return {
      newLeads: newLeads.totalDocs,
      attention: operationalAttention.totalDocs + seoAttention.totalDocs + messageAttention.totalDocs + blockedWork.totalDocs,
      activeWork: activeWork.totalDocs,
      unassignedWork: unassignedWork.totalDocs,
      pendingQuotes: pendingQuotes.totalDocs,
      pendingContracts: pendingContracts.totalDocs,
      aiDrafts: aiDrafts.totalDocs,
      replyDrafts: replyDrafts.totalDocs,
      changeAgreements: changeAgreements.totalDocs,
      upcomingWork: upcomingWork.totalDocs,
      contentAudits: contentAudits.totalDocs,
    };
  } catch {
    return {
      newLeads: 0,
      attention: 0,
      activeWork: 0,
      unassignedWork: 0,
      pendingQuotes: 0,
      pendingContracts: 0,
      aiDrafts: 0,
      replyDrafts: 0,
      changeAgreements: 0,
      upcomingWork: 0,
      contentAudits: 0,
    };
  }
}

const cards = [
  { key: "newLeads", href: "/admin/collections/leads" },
  {
    key: "replyDrafts",
    href: "/admin/collections/messages",
  },
  { key: "changeAgreements", href: "/admin/collections/change-agreements" },
  {
    key: "aiDrafts",
    href: "/admin/collections/posts",
  },
  {
    key: "pendingQuotes",
    href: "/admin/collections/quotes",
  },
  {
    key: "pendingContracts",
    href: "/admin/collections/contracts",
  },
  {
    key: "activeWork",
    href: "/admin/collections/work-orders",
  },
] as const;

export default async function AdminDashboard({
  i18n,
}: {
  i18n?: { language?: string };
}) {
  const copy = getAdminCopy(normalizePanelLocale(i18n?.language));
  const counts = await loadCounts();
  const health = buildPlatformHealth();
  const releaseGate = buildReleaseGate();
  const unavailable = Object.values(health.integrations).filter((integration) => integration.readiness !== "ready");
  const blockedReleaseFeatures = Object.entries(releaseGate.features).filter(([, decision]) => decision.status === "no_go");

  return (
    <section className="platform-dashboard" aria-labelledby="platform-title">
      <div className="platform-dashboard__header">
        <p className="platform-dashboard__eyebrow">{copy.control}</p>
        <h1 id="platform-title">{copy.overview}</h1>
        <p>{copy.overviewIntro}</p>
      </div>

      <div className="platform-dashboard__cards">
        {cards.map((card) => (
          <Link className="platform-dashboard__card" href={card.href} key={card.key}>
            <strong>{counts[card.key]}</strong>
            <span>{copy.cards[card.key]}</span>
          </Link>
        ))}
      </div>

      <div className="platform-dashboard__queues">
        <article>
          <h2>{copy.attention}</h2>
          <p>
            {counts.attention > 0
              ? copy.attentionSome(counts.attention)
              : copy.attentionNone}
          </p>
          <Link href="/admin/collections/operational-jobs">{copy.openQueue}</Link>
        </article>
        <article>
          <h2>{copy.upcomingWork}</h2>
          <p>
            {counts.unassignedWork > 0
              ? copy.unassignedSome(counts.unassignedWork)
              : copy.unassignedNone}
          </p>
          <Link href="/admin/collections/work-orders">{copy.seeWork}</Link>
        </article>
        <article>
          <h2>{copy.next72}</h2>
          <p>{copy.next72Text(counts.upcomingWork)}</p>
          <Link href="/admin/collections/work-orders">{copy.openSchedule}</Link>
        </article>
        <article>
          <h2>{copy.contentReview}</h2>
          <p>{copy.contentReviewText(counts.contentAudits)}</p>
          <Link href="/admin/collections/posts">{copy.seeContentReport}</Link>
        </article>
      </div>
      <div className="platform-dashboard__automation">
        <h2>{copy.integrations}</h2>
        <p>{unavailable.length ? copy.integrationsMissing(unavailable.length) : copy.integrationsReady}</p>
        <ul>
          {unavailable.map((integration) => <li key={integration.name}><strong>{integration.name}</strong>: {integration.readiness}{integration.missing.length ? ` – ${copy.missing} ${integration.missing.join(", ")}` : ""}</li>)}
        </ul>
        <Link href="/api/admin/platform-health">{copy.openHealth}</Link>
      </div>
      <div className="platform-dashboard__automation">
        <h2>{copy.productionGate}</h2>
        <p>{releaseGate.productionReady ? copy.gateReady : copy.gateBlocked}</p>
        <ul>
          {blockedReleaseFeatures.map(([name, decision]) => <li key={name}><strong>{name}</strong>: {copy.missing} {[...decision.unavailableIntegrations, ...decision.missingEvidence].join(", ")}</li>)}
        </ul>
        <Link href="/api/admin/platform-health">{copy.openGate}</Link>
      </div>
      <div className="platform-dashboard__automation">
        <h2>{copy.aiBlog}</h2>
        <p>{copy.aiBlogIntro}</p>
        <GenerateBlogDraftButton />
        <BlogTopicTools />
      </div>
    </section>
  );
}
