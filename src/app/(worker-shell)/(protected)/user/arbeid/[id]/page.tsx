import { notFound } from "next/navigation";
import { requireInternalUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

export default async function WorkerOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireInternalUser();
  const { id } = await params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "work-orders",
    limit: 1,
    where: {
      and: [
        { id: { equals: id } },
        ...(user.role === "admin"
          ? []
          : [{ assignedWorker: { equals: user.id } }]),
      ],
    },
  });
  const order = result.docs[0];

  // The same 404 is returned for a missing order and another worker's order.
  if (!order) notFound();

  return (
    <article className="rounded-2xl border border-white/10 bg-background-elevated p-5 sm:p-7">
      <p className="text-sm font-semibold text-accent">Oppdrag</p>
      <h1 className="mt-1 text-3xl font-bold">{order.reference}</h1>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Status</dt>
          <dd className="mt-1 font-semibold">{order.status}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Planlagt</dt>
          <dd className="mt-1 font-semibold">
            {order.scheduledAt
              ? new Intl.DateTimeFormat("nb-NO", {
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(new Date(order.scheduledAt))
              : "Ikke planlagt"}
          </dd>
        </div>
      </dl>
      {order.workSummary ? (
        <section className="mt-6 border-t border-white/10 pt-5">
          <h2 className="font-bold">Arbeidsbeskrivelse</h2>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{order.workSummary}</p>
        </section>
      ) : null}
      <p className="mt-8 rounded-xl bg-white/5 p-4 text-sm text-muted-foreground">
        Før-kontroll, bilder og statusknapper blir aktivert i arbeidsordrefasen. Ingen arbeid kan startes fra dette grunnskallet.
      </p>
    </article>
  );
}
