import Link from "next/link";
import { requireInternalUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

function relationId(value: number | { id: number } | null | undefined) {
  return typeof value === "object" && value ? value.id : value;
}

const statusLabels: Record<string, string> = {
  unassigned: "Ikke tildelt", assigned: "Tildelt", scheduled: "Planlagt", on_way: "På vei", arrived: "Ankommet",
  precheck: "Før-kontroll", ready: "Klar til start", blocked: "Blokkert", in_progress: "Startet", completed: "Må dokumenteres",
  documented: "Dokumentasjon levert", cancelled: "Avbrutt",
};

export default async function WorkerHomePage() {
  const user = await requireInternalUser();
  const payload = await getPayload();
  const result = await payload.find({
    collection: "work-orders",
    limit: 50,
    sort: "scheduledAt",
    where:
      user.role === "admin"
        ? {}
        : { assignedWorker: { equals: user.id } },
  });
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const active = result.docs.filter((order) => !["documented", "cancelled"].includes(order.status));

  const groups = [
    {
      title: "Mine oppdrag i dag",
      documents: active.filter((order) => order.scheduledAt?.slice(0, 10) === today),
    },
    {
      title: "Kommende oppdrag",
      documents: active.filter(
        (order) => order.scheduledAt && new Date(order.scheduledAt).getTime() > now && order.scheduledAt.slice(0, 10) !== today,
      ),
    },
    {
      title: "Oppdrag som må ferdigstilles",
      documents: active.filter((order) => !order.scheduledAt || ["arrived", "precheck", "blocked", "ready", "in_progress", "completed"].includes(order.status) || (order.scheduledAt && new Date(order.scheduledAt).getTime() < now && order.scheduledAt.slice(0, 10) !== today)),
    },
  ];

  return (
    <div>
      <p className="text-sm font-semibold text-accent">Ansattportal</p>
      <h1 className="mt-1 text-3xl font-bold">Hei, {user.displayName || "kollega"}</h1>
      <p className="mt-2 text-muted-foreground">Du ser bare oppdrag som er tildelt deg.</p>

      <div className="mt-8 space-y-8">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-xl font-bold">{group.title}</h2>
            {group.documents.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {group.documents.map((order) => (
                  <Link
                    className="rounded-xl border border-white/10 bg-background-elevated p-4 hover:border-accent"
                    href={`/user/arbeid/${order.id}`}
                    key={order.id}
                  >
                    <strong className="block">{order.reference}</strong>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {order.scheduledAt
                        ? new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.scheduledAt))
                        : "Tidspunkt ikke satt"}
                    </span>
                    <span className="mt-2 inline-block rounded-full bg-accent/15 px-2 py-1 text-xs text-accent">
                      {statusLabels[order.status] ?? order.status}
                    </span>
                    <span className="sr-only">Tildelt bruker {relationId(order.assignedWorker)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-white/15 p-5 text-sm text-muted-foreground">
                Ingen oppdrag i denne listen.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
