import Link from "next/link";
import { getPayload } from "@/lib/payload";

type DashboardCounts = {
  activeWork: number;
  attention: number;
  newLeads: number;
  pendingContracts: number;
  pendingQuotes: number;
  unassignedWork: number;
};

async function loadCounts(): Promise<DashboardCounts> {
  try {
    const payload = await getPayload();
    const [newLeads, attention, activeWork, unassignedWork] = await Promise.all([
      payload.count({
        collection: "leads",
        where: { status: { equals: "new" } },
      }),
      payload.count({
        collection: "operational-jobs",
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
      attention: attention.totalDocs,
      activeWork: activeWork.totalDocs,
      unassignedWork: unassignedWork.totalDocs,
      pendingQuotes: 0,
      pendingContracts: 0,
    };
  } catch {
    return {
      newLeads: 0,
      attention: 0,
      activeWork: 0,
      unassignedWork: 0,
      pendingQuotes: 0,
      pendingContracts: 0,
    };
  }
}

const cards = [
  { key: "newLeads", label: "Nye henvendelser", href: "/admin/collections/leads" },
  {
    key: "pendingQuotes",
    label: "Tilbud til godkjenning",
    href: "/admin/collections/leads",
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
    </section>
  );
}
