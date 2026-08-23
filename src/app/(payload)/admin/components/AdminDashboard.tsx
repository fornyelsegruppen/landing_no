import Link from "next/link";
import { getPayload } from "@/lib/payload";
import { GenerateBlogDraftButton } from "./GenerateBlogDraftButton";
import { BlogTopicTools } from "./BlogTopicTools";
import { buildPlatformHealth } from "@/lib/platform/health";
import { buildReleaseGate } from "@/lib/platform/release-gate";

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
  { key: "newLeads", label: "Nye henvendelser", href: "/admin/collections/leads" },
  {
    key: "replyDrafts",
    label: "Svarutkast til godkjenning",
    href: "/admin/collections/messages",
  },
  { key: "changeAgreements", label: "Endringsavtaler i arbeid", href: "/admin/collections/change-agreements" },
  {
    key: "aiDrafts",
    label: "Bloggutkast til kontroll",
    href: "/admin/collections/posts",
  },
  {
    key: "pendingQuotes",
    label: "Tilbud til godkjenning",
    href: "/admin/collections/quotes",
  },
  {
    key: "pendingContracts",
    label: "Kontrakter til signering",
    href: "/admin/collections/contracts",
  },
  {
    key: "activeWork",
    label: "Aktive oppdrag",
    href: "/admin/collections/work-orders",
  },
] as const;

export default async function AdminDashboard() {
  const counts = await loadCounts();
  const health = buildPlatformHealth();
  const releaseGate = buildReleaseGate();
  const unavailable = Object.values(health.integrations).filter((integration) => integration.readiness !== "ready");
  const blockedReleaseFeatures = Object.entries(releaseGate.features).filter(([, decision]) => decision.status === "no_go");

  return (
    <section className="platform-dashboard" aria-labelledby="platform-title">
      <div className="platform-dashboard__header">
        <p className="platform-dashboard__eyebrow">Takfornyelse Control</p>
        <h1 id="platform-title">Oversikt</h1>
        <p>Det viktigste som krever handling akkurat nå.</p>
      </div>

      <div className="platform-dashboard__cards">
        {cards.map((card) => (
          <Link className="platform-dashboard__card" href={card.href} key={card.key}>
            <strong>{counts[card.key]}</strong>
            <span>{card.label}</span>
          </Link>
        ))}
      </div>

      <div className="platform-dashboard__queues">
        <article>
          <h2>Krever oppmerksomhet</h2>
          <p>
            {counts.attention > 0
              ? `${counts.attention} jobber, meldinger eller oppdrag må kontrolleres.`
              : "Ingen jobber, meldinger eller oppdrag krever oppmerksomhet."}
          </p>
          <Link href="/admin/collections/operational-jobs">Åpne køen</Link>
        </article>
        <article>
          <h2>Kommende arbeid</h2>
          <p>
            {counts.unassignedWork > 0
              ? `${counts.unassignedWork} oppdrag mangler tildelt ansatt.`
              : "Ingen oppdrag mangler tildeling."}
          </p>
          <Link href="/admin/collections/work-orders">Se arbeid</Link>
        </article>
        <article>
          <h2>Neste 72 timer</h2>
          <p>{counts.upcomingWork} planlagte oppdrag i løpet av de neste 72 timene.</p>
          <Link href="/admin/collections/work-orders">Åpne arbeidsplanen</Link>
        </article>
        <article>
          <h2>Innholdskontroll</h2>
          <p>{counts.contentAudits} publiserte artikler har anbefaling om oppdatering, sammenslåing eller redirect.</p>
          <Link href="/admin/collections/posts">Se innholdsrapporten</Link>
        </article>
      </div>
      <div className="platform-dashboard__automation">
        <h2>Integrasjoner og feature-flagg</h2>
        <p>{unavailable.length ? `${unavailable.length} integrasjoner er deaktivert eller mangler konfigurasjon. Funksjonene forblir trygt av.` : "Alle konfigurerte integrasjoner rapporterer klar status."}</p>
        <ul>
          {unavailable.map((integration) => <li key={integration.name}><strong>{integration.name}</strong>: {integration.readiness}{integration.missing.length ? ` – mangler ${integration.missing.join(", ")}` : ""}</li>)}
        </ul>
        <Link href="/api/admin/platform-health">Åpne teknisk helsestatus</Link>
      </div>
      <div className="platform-dashboard__automation">
        <h2>Produksjonsgate</h2>
        <p>{releaseGate.productionReady ? "Alle aktiverte funksjoner har dokumentert go." : "Produksjonsgaten er lukket. Deaktiverte funksjoner forblir trygt av, og aktiverte funksjoner må ha komplett stagingbevis."}</p>
        <ul>
          {blockedReleaseFeatures.map(([name, decision]) => <li key={name}><strong>{name}</strong>: mangler {[...decision.unavailableIntegrations, ...decision.missingEvidence].join(", ")}</li>)}
        </ul>
        <Link href="/api/admin/platform-health">Åpne go/no-go-status</Link>
      </div>
      <div className="platform-dashboard__automation">
        <h2>AI-assistert blogg</h2>
        <p>Oppretter bare utkast. Publisering krever faglig kontroll og eksplisitt godkjenning.</p>
        <GenerateBlogDraftButton />
        <BlogTopicTools />
      </div>
    </section>
  );
}
