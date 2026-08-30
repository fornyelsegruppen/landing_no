import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternalUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { getWorkerCopy, panelDateLocale } from "@/lib/panel-i18n";
import { formatNorwayDateTime, norwayDateKey } from "@/lib/norway-time";
import { workerPortalAvailable } from "@/lib/worker-portal/gate";

function relationId(value: number | { id: number } | null | undefined) {
  return typeof value === "object" && value ? value.id : value;
}

export default async function WorkerHomePage() {
  if (!workerPortalAvailable()) notFound();
  const user = await requireInternalUser();
  const copy = getWorkerCopy(user.interfaceLanguage);
  const dateLocale = panelDateLocale(user.interfaceLanguage);
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
  // Server component: one request-scoped timestamp deliberately groups the returned records.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const today = norwayDateKey(now);
  const active = result.docs.filter((order) => !["documented", "cancelled"].includes(order.status));

  const groups = [
    {
      title: copy.today,
      documents: active.filter((order) => order.scheduledAt && norwayDateKey(order.scheduledAt) === today),
    },
    {
      title: copy.upcoming,
      documents: active.filter(
        (order) => order.scheduledAt && new Date(order.scheduledAt).getTime() > now && norwayDateKey(order.scheduledAt) !== today,
      ),
    },
    {
      title: copy.toFinish,
      documents: active.filter((order) => !order.scheduledAt || ["arrived", "precheck", "blocked", "ready", "in_progress", "completed"].includes(order.status) || (order.scheduledAt && new Date(order.scheduledAt).getTime() < now && norwayDateKey(order.scheduledAt) !== today)),
    },
  ];

  return (
    <div>
      <p className="text-sm font-semibold text-accent">{copy.portal}</p>
      <h1 className="mt-1 text-3xl font-bold">{copy.greeting}, {user.displayName || copy.colleague}</h1>
      <p className="mt-2 text-muted-foreground">{copy.assignedOnly}</p>

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
                        ? formatNorwayDateTime(order.scheduledAt, dateLocale)
                        : copy.timeNotSet}
                    </span>
                    <span className="mt-2 inline-block rounded-full bg-accent/15 px-2 py-1 text-xs text-accent">
                      {copy.status[order.status as keyof typeof copy.status] ?? order.status}
                    </span>
                    <span className="sr-only">{copy.assignedUser} {relationId(order.assignedWorker)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-white/15 p-5 text-sm text-muted-foreground">
                {copy.noJobs}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
