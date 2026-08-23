import Link from "next/link";
import { getPayload } from "@/lib/payload";
import { GenerateBlogDraftButton } from "./GenerateBlogDraftButton";
import { BlogTopicTools } from "./BlogTopicTools";

type DashboardCounts = {
  activeWork: number;
  attention: number;
  newLeads: number;
  pendingContracts: number;
  pendingQuotes: number;
  unassignedWork: number;
  aiDrafts: number;
  replyDrafts: number;
};

async function loadCounts(): Promise<DashboardCounts> {
  try {
    const payload = await getPayload();
    const [newLeads, aiDrafts, replyDrafts, operationalAttention, seoAttention, messageAttention, activeWork, unassignedWork] = await Promise.all([
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
        where: { status: { in: ["assigned", "scheduled"] } },
      }),
      payload.count({
        collection: "work-orders",
        where: { status: { equals: "unassigned" } },
      }),
    ]);

    return {
      newLeads: newLeads.totalDocs,
      attention: operationalAttention.totalDocs + seoAttention.totalDocs + messageAttention.totalDocs,
      activeWork: activeWork.totalDocs,
      unassignedWork: unassignedWork.totalDocs,
      pendingQuotes: 0,
      pendingContracts: 0,
      aiDrafts: aiDrafts.totalDocs,
      replyDrafts: replyDrafts.totalDocs,
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
  {
    key: "aiDrafts",
    label: "Bloggutkast til kontroll",
    href: "/admin/collections/posts",
  },
  {
    key: "pendingContracts",
    label: "Kontrakter til signering",
    href: "/admin/collections/leads",
  },
  {
    key: "activeWork",
    label: "Aktive oppdrag",
    href: "/admin/collections/work-orders",
  },
] as const;

export default async function AdminDashboard() {
  const counts = await loadCounts();

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
              ? `${counts.attention} automatiseringsjobber må kontrolleres.`
              : "Ingen tekniske jobber krever oppmerksomhet."}
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
