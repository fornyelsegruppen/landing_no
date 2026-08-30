import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { WorkerOrderActions } from "@/components/worker/worker-order-actions";
import { requireInternalUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import { documentHash, quoteDisplayModel, type ContractSnapshot } from "@/lib/quotes/document";
import { getWorkerCopy, panelDateLocale } from "@/lib/panel-i18n";
import { formatNorwayDateTime } from "@/lib/norway-time";
import { workerPortalAvailable } from "@/lib/worker-portal/gate";

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

function relationIds(value: unknown) {
  return Array.isArray(value) ? value.map(relationId).filter((id): id is number => id !== null) : [];
}

export default async function WorkerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  if (!workerPortalAvailable()) notFound();
  const user = await requireInternalUser();
  const copy = getWorkerCopy(user.interfaceLanguage);
  const dateLocale = panelDateLocale(user.interfaceLanguage);
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const payload = await getPayload();
  const result = await payload.find({ collection: "work-orders", limit: 1, depth: 0, where: { and: [
    { id: { equals: id } }, ...(user.role === "admin" ? [] : [{ assignedWorker: { equals: user.id } }]),
  ] } });
  const order = result.docs[0];
  if (!order) notFound();
  const contractId = relationId(order.contract);
  if (!contractId) throw new Error("Oppdraget mangler signert kontrakt");
  const contract = await payload.findByID({ collection: "contracts", id: contractId, depth: 0, overrideAccess: true });
  const leadId = relationId(order.lead);
  const lead = leadId ? await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true }) : null;
  const customerPhotoCount = typeof lead?.photoUrls === "string" ? lead.photoUrls.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 15).length : 0;
  const snapshot = contract.snapshot as ContractSnapshot;
  if (documentHash(snapshot) !== order.contractDocumentHash || contract.documentHash !== order.contractDocumentHash) {
    throw new Error("Kontraktsgrunnlaget stemmer ikke med arbeidsordren");
  }
  const display = quoteDisplayModel(snapshot.quote);
  const phoneHref = snapshot.customer.phone ? `tel:${snapshot.customer.phone.replace(/[^+\d]/g, "")}` : null;
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(snapshot.customer.address)}`;

  return <>
    <Link className="text-sm font-semibold text-accent" href="/user">← {copy.backToJobs}</Link>
    <article className="mt-4 rounded-2xl border border-white/10 bg-background-elevated p-5 sm:p-7">
      <p className="text-sm font-semibold text-accent">{copy.job} {order.reference}</p>
      <h1 className="mt-1 text-3xl font-bold">{snapshot.customer.name}</h1>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a className="min-h-12 rounded-xl border border-white/15 p-3 font-semibold hover:border-accent" href={mapHref} rel="noreferrer" target="_blank">{copy.navigateTo} {snapshot.customer.address}</a>
        {phoneHref ? <a className="min-h-12 rounded-xl border border-white/15 p-3 font-semibold hover:border-accent" href={phoneHref}>{copy.call} {snapshot.customer.phone}</a> : <p className="rounded-xl border border-white/10 p-3 text-muted-foreground">{copy.phoneMissing}</p>}
      </div>
      <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
        <Info label={copy.planned} value={order.scheduledAt ? formatNorwayDateTime(order.scheduledAt, dateLocale, { dateStyle: "long", timeStyle: "short" }) : copy.notPlanned} />
        {order.arrivalWindow ? <Info label={copy.arrivalWindow} value={order.arrivalWindow} /> : null}
        <Info label={copy.service} value={display.service} />
        <Info label={copy.estimatedArea} value={`${display.estimatedAreaMin.toLocaleString(dateLocale)}–${display.estimatedAreaMax.toLocaleString(dateLocale)} m²`} />
        <Info label={copy.tolerance} value={`${display.tolerancePercent.toLocaleString(dateLocale)} %`} />
        <Info label={copy.contractPrice} value={display.totalIncVatNok.toLocaleString(dateLocale, { style: "currency", currency: "NOK" })} />
        <Info label={copy.maximumPrice} value={display.maximumTotalIncVatNok == null ? copy.notRegistered : display.maximumTotalIncVatNok.toLocaleString(dateLocale, { style: "currency", currency: "NOK" })} />
      </dl>
      <section className="mt-6 border-t border-white/10 pt-5"><h2 className="font-bold">{copy.workDescription}</h2><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{order.workSummary}</p></section>
      {order.adminNote ? <section className="mt-6 rounded-xl border border-accent/25 bg-accent/5 p-4"><h2 className="font-bold text-accent">{copy.internalNote}</h2><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{order.adminNote}</p></section> : null}
      {customerPhotoCount ? <section className="mt-6 border-t border-white/10 pt-5"><h2 className="font-bold">{copy.customerPhotos}</h2><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: customerPhotoCount }, (_, index) => <a href={`/api/worker/work-orders/${order.id}/lead-photo?index=${index}`} key={index} rel="noreferrer" target="_blank"><Image alt={`${copy.customerRoofPhoto} ${index + 1}`} className="aspect-square w-full rounded-xl border border-white/10 object-cover" height={320} src={`/api/worker/work-orders/${order.id}/lead-photo?index=${index}`} unoptimized width={320} /></a>)}</div></section> : null}
    </article>
    <WorkerOrderActions locale={user.interfaceLanguage} orderId={order.id} initialStatus={order.status} initialBeforePhotoIds={relationIds(order.beforePhotos)} initialAfterPhotoIds={relationIds(order.afterPhotos)} initialBlockingReasons={Array.isArray(order.blockingReasons) ? order.blockingReasons.filter((value): value is string => typeof value === "string") : []} initialCanRepeatPrecheck={Boolean(relationId(order.approvedChangeAgreement)) || order.priceOutcome === "hms_blocked"} initialActualTotalIncVatOre={order.actualTotalIncVatOre} initialDocumentationSubmittedAt={order.documentationSubmittedAt} />
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}
