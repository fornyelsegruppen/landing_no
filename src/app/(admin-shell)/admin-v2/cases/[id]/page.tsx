import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { CaseActionPanel, CloseCaseButton } from "@/components/admin-v2/case-action-panel";
import { MeasurementReviewPanel } from "@/components/admin-v2/measurement-review-panel";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import { metadataLabel, statusLabel, timelineTypeLabel } from "@/lib/admin-v2/labels";
import { loadAdminCase, type CaseEntity } from "@/lib/admin-v2/case-read-model";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import { getPayload } from "@/lib/payload";

export const dynamic = "force-dynamic";

const serviceNames: Record<string, string> = {
  takvask: "Takvask",
  takvask_impregnering: "Takvask + impregnering",
  impregnering: "Impregnering",
  takmaling: "Takmaling",
  nytt_tak: "Nytt tak",
  usikker: "Usikker – taksjekk",
};

function Status({ companySignedAt, contract, locale, value }: { companySignedAt?: string; contract?: boolean; locale: "nb" | "lt" | "en"; value?: string }) {
  return value ? <span className="inline-flex rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-accent">{statusLabel(locale, value, { contract, companySignedAt })}</span> : null;
}

function Section({ children, id, title }: { children: React.ReactNode; id: string; title: string }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-white/10 bg-background-elevated/75 p-5 sm:p-6">
      <h2 className="text-xl font-bold" id={id}>{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TechnicalLink({ entity, label, summary }: { entity?: CaseEntity; label: string; summary: string }) {
  return entity ? <details className="mt-4 border-t border-white/10 pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold hover:text-accent">{summary}</summary><Link className="mt-3 inline-flex items-center gap-2 font-semibold hover:text-accent" href={entity.href}>{label}<ExternalLink aria-hidden="true" className="size-3.5" /></Link></details> : null;
}

function qualificationDetails(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    summary: typeof record.summary === "string" ? record.summary : "",
    missing: Array.isArray(record.missingInformation) ? record.missingInformation.filter((item): item is string => typeof item === "string") : [],
    risks: Array.isArray(record.riskFlags) ? record.riskFlags.filter((item): item is string => typeof item === "string") : [],
  };
}

export default async function AdminCasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminUser();
  const copy = getAdminCaseCopy(user.interfaceLanguage);
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const caseData = await loadAdminCase(await getPayload(), Number(id));
  if (!caseData) notFound();

  const formatDate = (value?: string) => value
    ? new Intl.DateTimeFormat(panelDateLocale(user.interfaceLanguage), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";
  const nok = (ore?: number) => typeof ore === "number"
    ? new Intl.NumberFormat(panelDateLocale(user.interfaceLanguage), { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(ore / 100)
    : "—";
  const area = (tenths?: number) => typeof tenths === "number" ? `${(tenths / 10).toLocaleString(panelDateLocale(user.interfaceLanguage))} m²` : "—";
  const due = caseData.lead.nextActionAt
    ? caseData.lead.nextActionOverdue ? copy.dueNow : formatDate(caseData.lead.nextActionAt)
    : copy.noDue;
  const qualification = qualificationDetails(caseData.lead.qualification);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-accent" href="/admin-v2/cases">
        <ArrowLeft aria-hidden="true" className="size-4" />{copy.back}
      </Link>

      <header className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(232,163,23,.13),rgba(23,28,38,.75)_42%)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-accent">{copy.case} #{caseData.lead.id}</p>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-4xl">{caseData.lead.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3"><Status locale={user.interfaceLanguage} value={caseData.lead.status} /><span className="text-sm text-muted-foreground">{serviceNames[caseData.lead.inquiryType || ""] || caseData.lead.inquiryType || "—"}</span></div>
          </div>
          <div className="grid gap-1 text-sm lg:text-right">
            <span className="text-muted-foreground">{copy.responsible}</span>
            <strong>{caseData.lead.assignedTo || copy.unassigned}</strong>
            <span className="mt-2 text-muted-foreground">{copy.due}</span>
            <strong className={due === copy.dueNow ? "text-accent" : undefined}>{due}</strong>
          </div>
        </div>
      </header>

      <section aria-labelledby="next-action-title" className="rounded-3xl border border-accent/35 bg-accent/8 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-accent" id="next-action-title">{copy.nextAction}</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">{copy.actionLabels[caseData.nextAction.kind]}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.actionLabels[caseData.nextAction.kind]}</p>
          </div>
          <CaseActionPanel
            action={caseData.nextAction}
            contractDocumentHash={caseData.contract?.documentHash}
            defaultSigner={user.displayName || user.email}
            leadId={caseData.lead.id}
            locale={user.interfaceLanguage}
          />
        </div>
      </section>

      <nav aria-label={copy.overview} className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-background-elevated/60 p-2 text-sm font-semibold">
        {[
          ["customer-section", copy.customer], ["measurement-section", copy.measurement], ["price-quote-section", copy.quote],
          ["messages-section", copy.messages], ["contract-section", copy.contract], ["work-section", copy.work],
          ["documents-section", copy.documents], ["timeline-section", copy.timeline],
        ].map(([href, label]) => <a className="shrink-0 rounded-xl px-3 py-2 text-white/75 hover:bg-white/5 hover:text-accent" href={`#${href}`} key={href}>{label}</a>)}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
        <div className="space-y-6">
          <Section id="customer-section" title={copy.customer}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.contact}</dt><dd className="mt-2 grid gap-2">
                {caseData.lead.email ? <a className="inline-flex items-center gap-2 hover:text-accent" href={`mailto:${caseData.lead.email}`}><Mail aria-hidden="true" className="size-4" />{caseData.lead.email}</a> : null}
                {caseData.lead.phone ? <a className="inline-flex items-center gap-2 hover:text-accent" href={`tel:${caseData.lead.phone}`}><Phone aria-hidden="true" className="size-4" />{caseData.lead.phone}</a> : null}
              </dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.address}</dt><dd className="mt-2 inline-flex gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />{caseData.lead.address || "—"}</dd></div>
            </dl>
            {caseData.lead.message ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 whitespace-pre-wrap text-sm text-white/85">{caseData.lead.message}</div> : null}
            {caseData.lead.status !== "closed" ? <div className="mt-5 border-t border-white/10 pt-4"><CloseCaseButton leadId={caseData.lead.id} locale={user.interfaceLanguage} /></div> : null}
          </Section>

          <Section id="ai-section" title={copy.ai}>
            {qualification ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.aiSummary}</p><p className="mt-2 text-sm leading-relaxed text-white/85">{qualification.summary || copy.nothingReported}</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.missingInformation}</p><p className="mt-2 text-sm">{qualification.missing.length ? qualification.missing.join(" · ") : copy.nothingReported}</p></div>
                  <div className="rounded-2xl border border-white/10 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.riskFlags}</p><p className="mt-2 text-sm">{qualification.risks.length ? qualification.risks.join(" · ") : copy.nothingReported}</p></div>
                </div>
              </div>
            ) : <p className="text-muted-foreground">{copy.missing}</p>}
            <div className="mt-4 rounded-2xl border border-white/10 p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{copy.nextAction}</p><p className="mt-2 text-sm">{copy.actionLabels[caseData.nextAction.kind]}</p></div>
          </Section>

          <Section id="measurement-section" title={copy.measurement}>
            {caseData.measurement ? <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{caseData.measurement.reference}</strong>{caseData.measurement.normalizedAddress ? <p className="mt-1 text-sm text-muted-foreground">{caseData.measurement.normalizedAddress}</p> : null}</div><Status locale={user.interfaceLanguage} value={caseData.measurement.status} /></div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div><dt className="text-xs text-muted-foreground">{copy.area}</dt><dd className="mt-1 font-bold">{area(caseData.measurement.actualAreaMinTenths)}–{area(caseData.measurement.actualAreaMaxTenths)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{copy.confidence}</dt><dd className="mt-1 font-bold">{caseData.measurement.confidence || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Horizontal</dt><dd className="mt-1 font-bold">{area(caseData.measurement.horizontalAreaTenths)}</dd></div>
              </dl>
              {caseData.measurement.manualAreaOverrideTenths ? <div className="mt-4 rounded-xl border border-accent/30 bg-accent/8 p-3 text-sm"><strong className="text-accent">{copy.manualOverrideBadge}</strong><span className="ml-2">{area(caseData.measurement.manualAreaOverrideTenths)}</span>{caseData.measurement.manualOverrideReason ? <p className="mt-1 text-muted-foreground">{caseData.measurement.manualOverrideReason}</p> : null}{caseData.measurement.manualOverriddenAt ? <p className="mt-1 text-xs text-muted-foreground">{formatDate(caseData.measurement.manualOverriddenAt)}</p> : null}</div> : null}
              {caseData.measurement.confidenceReasoning ? <p className="mt-4 text-sm text-muted-foreground">{caseData.measurement.confidenceReasoning}</p> : null}
              {["draft", "review_required"].includes(caseData.measurement.status || "") && caseData.measurement.actualAreaMaxTenths ? <MeasurementReviewPanel
                canApprovePackage={caseData.nextAction.kind === "approve_package"}
                currentAreaTenths={caseData.measurement.actualAreaMaxTenths}
                leadId={caseData.lead.id}
                locale={user.interfaceLanguage}
                manualOverrideReason={caseData.measurement.manualOverrideReason}
                measurementId={caseData.measurement.id}
              /> : null}
              <TechnicalLink entity={caseData.measurement} label={copy.technicalDetail} summary={copy.advancedTechnical} />
            </> : <p className="text-muted-foreground">{copy.missing}</p>}
          </Section>

          <Section id="price-quote-section" title={`${copy.pricing} · ${copy.quote}`}>
            {caseData.price ? <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">{copy.priceExVat}</dt><dd className="mt-1 font-bold">{nok(caseData.price.subtotalExVatOre)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{copy.vat}</dt><dd className="mt-1 font-bold">{nok(caseData.price.vatOre)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{copy.priceIncVat}</dt><dd className="mt-1 font-bold text-accent">{nok(caseData.price.totalIncVatOre)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{copy.maximum}</dt><dd className="mt-1 font-bold">{nok(caseData.price.maximumTotalIncVatOre)}</dd></div>
            </dl> : <p className="text-muted-foreground">{copy.missing}</p>}
            {caseData.quote ? <div className="mt-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 p-4"><div><strong>{caseData.quote.reference}</strong><p className="mt-1 text-sm text-muted-foreground">{copy.validUntil}: {formatDate(caseData.quote.validUntil)}</p></div><Status locale={user.interfaceLanguage} value={caseData.quote.status} /><TechnicalLink entity={caseData.quote} label={copy.technicalDetail} summary={copy.advancedTechnical} /></div> : null}
          </Section>

          <Section id="messages-section" title={copy.messages}>
            {caseData.messages.length ? <div className="grid gap-3">{caseData.messages.map((message) => <article className="scroll-mt-24 rounded-2xl border border-white/10 bg-black/15 p-4" id={`message-${message.id}`} key={message.id}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{message.subject}</strong><p className="mt-1 text-xs text-muted-foreground">{metadataLabel(user.interfaceLanguage, message.direction)} · {metadataLabel(user.interfaceLanguage, message.category)} · {metadataLabel(user.interfaceLanguage, message.channel)}</p></div><Status locale={user.interfaceLanguage} value={message.status} /></div>
              <p className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-sm text-white/80">{message.bodyText}</p>
              {message.failureMessage ? <p className="mt-3 text-sm text-danger">{message.failureMessage}</p> : null}
              <TechnicalLink entity={message} label={copy.technicalDetail} summary={copy.advancedTechnical} />
            </article>)}</div> : <p className="text-muted-foreground">{copy.noMessages}</p>}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section id="contract-section" title={copy.contract}>
            {caseData.contract ? <><div className="flex flex-wrap justify-between gap-3"><strong>{caseData.contract.reference}</strong><Status companySignedAt={caseData.contract.companySignedAt} contract locale={user.interfaceLanguage} value={caseData.contract.status} /></div>{caseData.contract.signedAt ? <p className="mt-3 text-sm text-muted-foreground">{copy.customerSignedAt}: {formatDate(caseData.contract.signedAt)}</p> : null}{caseData.contract.companySignedAt ? <p className="mt-1 text-sm text-muted-foreground">{copy.companySignedAt}: {formatDate(caseData.contract.companySignedAt)}</p> : null}<TechnicalLink entity={caseData.contract} label={copy.technicalDetail} summary={copy.advancedTechnical} /></> : <p className="text-muted-foreground">{copy.missing}</p>}
          </Section>

          <Section id="work-section" title={copy.work}>
            {caseData.workOrder ? <><div className="flex flex-wrap justify-between gap-3"><strong>{caseData.workOrder.reference}</strong><Status locale={user.interfaceLanguage} value={caseData.workOrder.status} /></div><dl className="mt-4 grid gap-3"><div><dt className="text-xs text-muted-foreground">{copy.employee}</dt><dd className="font-semibold">{caseData.workOrder.assignedWorker || copy.unassigned}</dd></div><div><dt className="text-xs text-muted-foreground">{copy.scheduled}</dt><dd className="font-semibold">{formatDate(caseData.workOrder.scheduledAt)}</dd></div></dl><TechnicalLink entity={caseData.workOrder} label={copy.technicalDetail} summary={copy.advancedTechnical} /></> : <p className="text-muted-foreground">{copy.missing}</p>}
          </Section>

          <Section id="changes-section" title={copy.changes}>
            {caseData.changes.length ? <div className="grid gap-3">{caseData.changes.map((change) => <div className="rounded-xl border border-white/10 p-3" key={change.id}><div className="flex justify-between gap-2"><strong>{change.reference}</strong><Status locale={user.interfaceLanguage} value={change.status} /></div>{change.summary ? <p className="mt-2 text-sm text-muted-foreground">{change.summary}</p> : null}</div>)}</div> : <p className="text-muted-foreground">{copy.missing}</p>}
          </Section>

          <Section id="documents-section" title={copy.documents}>
            {caseData.documents.length ? <div className="grid gap-2">{caseData.documents.map((document) => <a className="flex min-h-11 items-center justify-between rounded-xl border border-white/10 px-3 text-sm font-semibold hover:border-accent/50 hover:text-accent" href={document.href} key={document.id} rel="noreferrer" target="_blank"><span className="truncate">{document.filename}</span><ExternalLink aria-hidden="true" className="size-4 shrink-0" /></a>)}</div> : <p className="text-muted-foreground">{copy.noDocuments}</p>}
          </Section>

          <Section id="timeline-section" title={copy.timeline}>
            <ol className="relative ml-2 border-l border-white/10 pl-5">{caseData.timeline.map((item) => <li className="relative pb-5 last:pb-0" key={item.id}><span className="absolute -left-[1.57rem] top-1 size-2.5 rounded-full bg-accent ring-4 ring-background-elevated" />{item.href ? <Link className="block rounded-xl p-2 transition hover:bg-white/5" href={item.href}><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong><Status locale={user.interfaceLanguage} value={item.status} /></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.at)} · {timelineTypeLabel(user.interfaceLanguage, item.type)}</p></Link> : <div className="p-2"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong><Status locale={user.interfaceLanguage} value={item.status} /></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.at)} · {timelineTypeLabel(user.interfaceLanguage, item.type)}</p></div>}</li>)}</ol>
          </Section>
        </aside>
      </div>
    </div>
  );
}
