import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { CaseActionPanel } from "@/components/admin-v2/case-action-panel";
import { MeasurementReviewPanel } from "@/components/admin-v2/measurement-review-panel";
import { WorkOrderPlanningPanel } from "@/components/admin-v2/work-order-planning-panel";
import { CommercialQuoteEditor } from "@/components/admin-v2/commercial-quote-editor";
import { CompletionReviewPanel } from "@/components/admin-v2/completion-review-panel";
import { InvoiceRecordPanel } from "@/components/admin-v2/invoice-record-panel";
import { OfficialInvoiceManager } from "@/components/admin-v2/official-invoice-manager";
import { CaseLifecyclePanel } from "@/components/admin-v2/case-lifecycle-panel";
import { ChangeAgreementPanel } from "@/components/admin-v2/change-agreement-panel";
import { InformationRequestButton } from "@/components/admin-v2/information-request-button";
import { CaseViewedMarker } from "@/components/admin-v2/case-viewed-marker";
import { MessageDraftEditor } from "@/components/admin-v2/message-draft-editor";
import { CustomerQuestionWorkbench } from "@/components/admin-v2/customer-question-workbench";
import { ManualContactRecoveryPanel } from "@/components/admin-v2/manual-contact-recovery-panel";
import { CancellationReviewPanel } from "@/components/admin-v2/cancellation-review-panel";
import { CaseCommandBar } from "@/components/admin-v2/case-command-bar";
import { CaseVersionHistory } from "@/components/admin-v2/case-version-history";
import { ContractRequestReviewPanel } from "@/components/admin-v2/contract-request-review-panel";
import { getAdminCaseCopy } from "@/lib/admin-v2/case-i18n";
import {
  metadataLabel,
  statusLabel,
  timelineTypeLabel,
} from "@/lib/admin-v2/labels";
import { loadAdminCase, type CaseEntity } from "@/lib/admin-v2/case-read-model";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import {
  formatNorwayDateTime,
  formatNorwayDateTimeInput,
} from "@/lib/norway-time";
import { getPayload } from "@/lib/payload";
import {
  customerQuestionDocumentReferences,
  customerQuestionReplyStage,
  selectLatestCustomerQuestion,
  selectUnresolvedCustomerQuestion,
} from "@/lib/messages/customer-question-state";

export const dynamic = "force-dynamic";

const serviceNames: Record<string, string> = {
  takvask: "Takvask",
  takvask_impregnering: "Takvask + impregnering",
  impregnering: "Impregnering",
  takmaling: "Takmaling",
  nytt_tak: "Nytt tak",
  usikker: "Usikker – taksjekk",
};

const questionCopy = {
  nb: {
    action: {
      prepare: "Velg hvordan du vil svare på kundens spørsmål",
      review: "Kontroller og svar på kundens spørsmål",
      queued: "Følg leveringen av svaret til kunden",
      sent: "Svaret er sendt til kunden",
      delivery_failed: "Leveringen mislyktes – kontroller og prøv igjen",
    },
    status: {
      prepare: "Kunden venter på svar",
      review: "Svarutkast klart",
      queued: "Svar venter på levering",
      sent: "Svar sendt",
      delivery_failed: "Levering mislyktes",
    },
  },
  lt: {
    action: {
      prepare: "Pasirinkti, kaip atsakyti į kliento klausimą",
      review: "Patikrinti ir atsakyti į kliento klausimą",
      queued: "Stebėti atsakymo pristatymą klientui",
      sent: "Atsakymas išsiųstas klientui",
      delivery_failed: "Pristatyti nepavyko – patikrinti ir bandyti dar kartą",
    },
    status: {
      prepare: "Klientas laukia atsakymo",
      review: "Atsakymo juodraštis parengtas",
      queued: "Atsakymas laukia pristatymo",
      sent: "Atsakymas išsiųstas",
      delivery_failed: "Pristatyti nepavyko",
    },
  },
  en: {
    action: {
      prepare: "Choose how to answer the customer's question",
      review: "Review and answer the customer's question",
      queued: "Monitor delivery of the customer reply",
      sent: "The reply was sent to the customer",
      delivery_failed: "Delivery failed – review and retry",
    },
    status: {
      prepare: "Customer is waiting for a reply",
      review: "Reply draft ready",
      queued: "Reply awaiting delivery",
      sent: "Reply sent",
      delivery_failed: "Delivery failed",
    },
  },
} as const;

function Status({
  companySignedAt,
  contract,
  locale,
  value,
}: {
  companySignedAt?: string;
  contract?: boolean;
  locale: "nb" | "lt" | "en";
  value?: string;
}) {
  return value ? (
    <span className="border-accent/25 bg-accent/10 text-accent inline-flex rounded-full border px-2.5 py-1 text-xs font-bold tracking-wider uppercase">
      {statusLabel(locale, value, { contract, companySignedAt })}
    </span>
  ) : null;
}

function Section({
  children,
  id,
  title,
}: {
  children: React.ReactNode;
  id: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="bg-background-elevated/75 min-w-0 scroll-mt-36 rounded-3xl border border-white/10 p-5 sm:p-6"
    >
      <h2 className="text-xl font-bold" id={id}>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TechnicalLink({
  entity,
  label,
  summary,
}: {
  entity?: CaseEntity;
  label: string;
  summary: string;
}) {
  return entity ? (
    <details className="text-muted-foreground mt-4 border-t border-white/10 pt-3 text-xs">
      <summary className="hover:text-accent cursor-pointer font-semibold">
        {summary}
      </summary>
      <Link
        className="hover:text-accent mt-3 inline-flex items-center gap-2 font-semibold"
        href={entity.href}
      >
        {label}
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </Link>
    </details>
  ) : null;
}

function qualificationDetails(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    summary: typeof record.summary === "string" ? record.summary : "",
    missing: Array.isArray(record.missingInformation)
      ? record.missingInformation.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    risks: Array.isArray(record.riskFlags)
      ? record.riskFlags.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

function factWarnings(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const warnings = (value as Record<string, unknown>).factWarnings;
  return Array.isArray(warnings)
    ? warnings.filter((item): item is string => typeof item === "string")
    : [];
}

function manualReplyRequiresEditing(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).manualReplyRequiresEditing === true,
  );
}

export default async function AdminCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminUser();
  const copy = getAdminCaseCopy(user.interfaceLanguage);
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const payload = await getPayload();
  const [caseData, workersResult, rulesResult] = await Promise.all([
    loadAdminCase(payload, Number(id)),
    payload.find({
      collection: "users",
      depth: 0,
      limit: 200,
      overrideAccess: true,
      pagination: false,
      sort: "displayName",
      where: {
        and: [{ role: { equals: "worker" } }, { active: { equals: true } }],
      },
    }),
    payload.find({
      collection: "price-rules",
      depth: 0,
      limit: 50,
      overrideAccess: true,
      pagination: false,
      sort: "-version",
      where: { status: { equals: "approved" } },
    }),
  ]);
  if (!caseData) notFound();
  const unresolvedQuestion = selectUnresolvedCustomerQuestion(
    caseData.messages,
  );
  const displayedQuestion =
    unresolvedQuestion || selectLatestCustomerQuestion(caseData.messages);
  const displayedReply = displayedQuestion?.reply || null;
  const questionStage = customerQuestionReplyStage(displayedReply);
  const qCopy = questionCopy[user.interfaceLanguage];
  const workers = workersResult.docs
    .filter(
      (worker) =>
        Boolean(worker.displayName?.trim()) &&
        (worker.phone?.replace(/\D/g, "").length ?? 0) >= 8,
    )
    .map((worker) => ({
      id: worker.id,
      name: worker.displayName!,
      phone: worker.phone!,
    }));
  const incompleteWorkerCount = workersResult.docs.length - workers.length;
  const seenRuleServices = new Set<string>();
  const rules = rulesResult.docs
    .filter((rule) => {
      if (seenRuleServices.has(rule.serviceKey)) return false;
      seenRuleServices.add(rule.serviceKey);
      return true;
    })
    .map((rule) => ({
      serviceKey: rule.serviceKey,
      serviceName: serviceNames[rule.serviceKey] || rule.serviceKey,
      unitPriceExVatOre: rule.unitPriceExVatOre,
    }));

  const formatDate = (value?: string) =>
    value
      ? formatNorwayDateTime(value, panelDateLocale(user.interfaceLanguage))
      : "—";
  const nok = (ore?: number) =>
    typeof ore === "number"
      ? new Intl.NumberFormat(panelDateLocale(user.interfaceLanguage), {
          style: "currency",
          currency: "NOK",
          maximumFractionDigits: 0,
        }).format(ore / 100)
      : "—";
  const area = (tenths?: number) =>
    typeof tenths === "number"
      ? `${(tenths / 10).toLocaleString(panelDateLocale(user.interfaceLanguage))} m²`
      : "—";
  const due = caseData.lead.nextActionAt
    ? caseData.lead.nextActionOverdue
      ? copy.dueNow
      : formatDate(caseData.lead.nextActionAt)
    : copy.noDue;
  const qualification = qualificationDetails(caseData.lead.qualification);
  const cancellationSource = caseData.workOrder?.cancellationRequestMessageId
    ? caseData.messages.find(
        (message) =>
          message.id === caseData.workOrder?.cancellationRequestMessageId,
      )
    : caseData.lead.nextActionBlocker === "CUSTOMER_CANCELLATION_REQUEST"
      ? caseData.messages.find((message) => message.direction === "inbound")
      : undefined;
  const activeContractRequest = caseData.contractRequests.find(
    (item) =>
      !["closed", "recovered", "do_not_contact"].includes(item.status || ""),
  );
  const workingCommercial =
    caseData.commercial.workingContract || caseData.commercial.workingQuote;
  const effectiveCommercial = caseData.commercial.effectiveContract;
  const workingQuote = caseData.commercial.workingQuote;
  const workingReference = workingCommercial?.reference || copy.notCreated;
  const workingStatus = workingCommercial
    ? statusLabel(user.interfaceLanguage, workingCommercial.status, {
        contract: workingCommercial.kind === "contract",
        companySignedAt: workingCommercial.companySignedAt,
      })
    : copy.notCreated;
  const effectiveReference =
    effectiveCommercial?.reference || copy.noneEffective;
  const commercialAmount = nok(workingQuote?.totalIncVatOre);
  const commercialMaximum = nok(workingQuote?.maximumTotalIncVatOre);
  const commercialDeposit = nok(workingQuote?.depositAmountIncVatOre || 0);
  const nextActionBase = unresolvedQuestion
    ? qCopy.action[questionStage]
    : copy.actionLabels[caseData.nextAction.kind];
  const quoteActionKinds = new Set([
    "approve_package",
    "approve_quote",
    "issue_quote",
  ]);
  const contractActionKinds = new Set([
    "company_sign_contract",
    "create_work_order",
  ]);
  const actionDocument = contractActionKinds.has(caseData.nextAction.kind)
    ? caseData.commercial.contractVersions.find(
        (item) => item.id === caseData.nextAction.targetId,
      ) ||
      caseData.commercial.workingContract ||
      effectiveCommercial
    : quoteActionKinds.has(caseData.nextAction.kind)
      ? caseData.commercial.quoteVersions.find(
          (item) => item.id === caseData.nextAction.targetId,
        ) || workingQuote
      : workingCommercial;
  const nextActionText = unresolvedQuestion
    ? nextActionBase
    : actionDocument
      ? `${nextActionBase} ${actionDocument.reference}`
      : nextActionBase;
  const actionQuote =
    actionDocument?.kind === "quote" ? actionDocument : workingQuote;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <CaseViewedMarker
        leadId={caseData.lead.id}
        reviewed={Boolean(caseData.lead.adminReviewedAt)}
      />
      <Link
        className="text-muted-foreground hover:text-accent inline-flex min-h-10 items-center gap-2 text-sm font-semibold"
        href="/admin-v2/cases"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {copy.back}
      </Link>

      <header className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(232,163,23,.13),rgba(23,28,38,.75)_42%)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-accent text-xs font-bold tracking-[.2em] uppercase">
              {copy.case} #{caseData.lead.id}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight break-words sm:text-4xl">
              {caseData.lead.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Status
                locale={user.interfaceLanguage}
                value={caseData.lead.status}
              />
              <span className="text-muted-foreground text-sm">
                {serviceNames[caseData.lead.inquiryType || ""] ||
                  caseData.lead.inquiryType ||
                  "—"}
              </span>
            </div>
          </div>
          <div className="grid gap-1 text-sm lg:text-right">
            <span className="text-muted-foreground">{copy.responsible}</span>
            <strong>{caseData.lead.assignedTo || copy.unassigned}</strong>
            <span className="text-muted-foreground mt-2">{copy.due}</span>
            <strong className={due === copy.dueNow ? "text-accent" : undefined}>
              {due}
            </strong>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-black/15 p-3">
            <dt className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.workingVersion}
            </dt>
            <dd className="mt-1 font-bold">{workingReference}</dd>
            <dd className="text-muted-foreground mt-1 text-xs">
              {workingStatus}
            </dd>
          </div>
          <div className="rounded-2xl bg-black/15 p-3">
            <dt className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.effectiveContract}
            </dt>
            <dd className="mt-1 font-bold">{effectiveReference}</dd>
            <dd className="text-muted-foreground mt-1 text-xs">
              {effectiveCommercial ? copy.signedByBoth : copy.noneEffectiveHelp}
            </dd>
          </div>
          <div className="rounded-2xl bg-black/15 p-3">
            <dt className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.priceIncVat}
            </dt>
            <dd className="mt-1 font-bold">{commercialAmount}</dd>
          </div>
          <div className="rounded-2xl bg-black/15 p-3">
            <dt className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.maximum}
            </dt>
            <dd className="mt-1 font-bold">{commercialMaximum}</dd>
          </div>
          <div className="rounded-2xl bg-black/15 p-3">
            <dt className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.deposit}
            </dt>
            <dd className="mt-1 font-bold">{commercialDeposit}</dd>
          </div>
        </dl>
      </header>

      <CaseCommandBar
        action={nextActionText}
        amount={commercialAmount}
        caseLabel={copy.case}
        caseNumber={caseData.lead.id}
        customer={caseData.lead.name}
        effectiveLabel={copy.effectiveContract}
        effectiveReference={effectiveReference}
        nextActionLabel={copy.nextAction}
        status={
          unresolvedQuestion ? qCopy.status[questionStage] : workingStatus
        }
        workingLabel={copy.workingVersion}
        workingReference={workingReference}
      />

      <section
        aria-labelledby="next-action-title"
        className={`scroll-mt-36 rounded-3xl border p-5 sm:p-6 ${caseData.nextAction.kind === "send_closure_confirmation" ? "border-danger/50 bg-danger/10" : "border-accent/35 bg-accent/8"}`}
      >
        <p
          className={`${caseData.nextAction.kind === "send_closure_confirmation" ? "text-danger" : "text-accent"} text-xs font-bold tracking-[.18em] uppercase`}
          id="next-action-title"
        >
          {copy.nextAction}
        </p>
        {displayedQuestion ? (
          <CustomerQuestionWorkbench
            key={`${displayedQuestion.question.id}:${displayedReply?.id || "none"}:${displayedReply?.status || "prepare"}:${displayedReply?.updatedAt || ""}`}
            documentReferences={customerQuestionDocumentReferences(
              displayedQuestion.question,
            )}
            leadId={caseData.lead.id}
            leadRevision={caseData.lead.revision}
            locale={user.interfaceLanguage}
            question={{
              bodyText: displayedQuestion.question.bodyText || "",
              id: displayedQuestion.question.id,
              receivedAt: formatDate(displayedQuestion.question.createdAt),
              subject: displayedQuestion.question.subject || "",
            }}
            reply={
              displayedReply
                ? {
                    aiAssisted: displayedReply.aiAssisted,
                    bodyText: displayedReply.bodyText || "",
                    factWarnings: factWarnings(displayedReply.aiAnalysis),
                    failureMessage: displayedReply.failureMessage,
                    id: displayedReply.id,
                    manualReplyRequiresEditing: manualReplyRequiresEditing(
                      displayedReply.aiAnalysis,
                    ),
                    status: displayedReply.status,
                    subject: displayedReply.subject || "",
                    updatedAt:
                      displayedReply.updatedAt ||
                      displayedReply.createdAt ||
                      "",
                  }
                : null
            }
          />
        ) : null}
        {!unresolvedQuestion ? (
          <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.72fr)] lg:items-start">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{nextActionText}</h2>
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
                {nextActionText}
              </p>
              <dl className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.customer}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-bold">
                    {caseData.lead.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.service}
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {actionQuote?.serviceDescription ||
                      serviceNames[caseData.lead.inquiryType || ""] ||
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.document}
                  </dt>
                  <dd className="text-accent mt-1 text-sm font-bold">
                    {actionDocument?.reference || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.priceIncVat}
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {nok(actionQuote?.totalIncVatOre)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.maximum}
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {nok(actionQuote?.maximumTotalIncVatOre)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.deposit}
                  </dt>
                  <dd className="mt-1 text-sm font-bold">
                    {nok(actionQuote?.depositAmountIncVatOre || 0)}
                  </dd>
                </div>
                {actionDocument?.supersedesReference ? (
                  <div className="sm:col-span-2 xl:col-span-3">
                    <dt className="text-muted-foreground text-xs">
                      {copy.replaces}
                    </dt>
                    <dd className="mt-1 text-sm font-bold">
                      {actionDocument.supersedesReference}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <CaseActionPanel
              key={`${caseData.nextAction.kind}:${caseData.nextAction.targetId || "none"}:${caseData.lead.revision}`}
              action={caseData.nextAction}
              actionLabel={nextActionText}
              actionReference={actionDocument?.reference}
              contractDocumentHash={
                actionDocument?.kind === "contract"
                  ? actionDocument.documentHash
                  : caseData.contract?.documentHash
              }
              defaultSigner={user.displayName || user.email}
              leadId={caseData.lead.id}
              locale={user.interfaceLanguage}
              versionContext={{
                contractReference:
                  actionDocument?.kind === "contract"
                    ? actionDocument.reference
                    : caseData.commercial.workingContract?.reference,
                contractVersion:
                  actionDocument?.kind === "contract"
                    ? actionDocument.version
                    : caseData.commercial.workingContract?.version,
                leadRevision: caseData.lead.revision,
                quoteDocumentHash: actionQuote?.documentHash,
                quoteReference: actionQuote?.reference,
                quoteVersion: actionQuote?.version,
              }}
            />
          </div>
        ) : null}
      </section>

      <nav
        aria-label={copy.overview}
        className="bg-background-elevated/60 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 p-2 text-sm font-semibold"
      >
        {[
          ["version-history-section", copy.versionHistory],
          ["customer-section", copy.customer],
          ["measurement-section", copy.measurement],
          ["price-quote-section", copy.quote],
          ["messages-section", copy.messages],
          ["contract-section", copy.contract],
          ["work-section", copy.work],
          ["documents-section", copy.documents],
          ["timeline-section", copy.timeline],
        ].map(([href, label]) => (
          <a
            className="hover:text-accent shrink-0 rounded-xl px-3 py-2 text-white/75 hover:bg-white/5"
            href={`#${href}`}
            key={href}
          >
            {label}
          </a>
        ))}
      </nav>

      <CaseVersionHistory
        contracts={caseData.commercial.contractVersions}
        copy={copy}
        formatDate={formatDate}
        formatMoney={nok}
        locale={user.interfaceLanguage}
        quotes={caseData.commercial.quoteVersions}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
        <div className="min-w-0 space-y-6">
          <Section id="customer-section" title={copy.customer}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {copy.contact}
                </dt>
                <dd className="mt-2 grid gap-2">
                  {caseData.lead.email ? (
                    <a
                      className="hover:text-accent inline-flex items-center gap-2"
                      href={`mailto:${caseData.lead.email}`}
                    >
                      <Mail aria-hidden="true" className="size-4" />
                      {caseData.lead.email}
                    </a>
                  ) : null}
                  {caseData.lead.communicationEmail &&
                  caseData.lead.communicationEmail !== caseData.lead.email ? (
                    <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                      <p className="text-xs font-bold tracking-wider text-emerald-200 uppercase">
                        {user.interfaceLanguage === "lt"
                          ? "Aktyvus komunikacijos el. paštas"
                          : user.interfaceLanguage === "en"
                            ? "Active communication email"
                            : "Aktiv e-post for kommunikasjon"}
                      </p>
                      <a
                        className="mt-1 inline-flex items-center gap-2 font-semibold text-emerald-50"
                        href={`mailto:${caseData.lead.communicationEmail}`}
                      >
                        <Mail aria-hidden="true" className="size-4" />
                        {caseData.lead.communicationEmail}
                      </a>
                    </div>
                  ) : null}
                  {caseData.lead.phone ? (
                    <a
                      className="hover:text-accent inline-flex items-center gap-2"
                      href={`tel:${caseData.lead.phone}`}
                    >
                      <Phone aria-hidden="true" className="size-4" />
                      {caseData.lead.phone}
                    </a>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {copy.address}
                </dt>
                <dd className="mt-2 inline-flex gap-2">
                  <MapPin
                    aria-hidden="true"
                    className="text-accent mt-0.5 size-4 shrink-0"
                  />
                  {caseData.lead.address || "—"}
                </dd>
              </div>
            </dl>
            {caseData.lead.message ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm whitespace-pre-wrap text-white/85">
                {caseData.lead.message}
              </div>
            ) : null}
          </Section>

          <Section id="ai-section" title={copy.ai}>
            {qualification ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    {copy.aiSummary}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/85">
                    {qualification.summary || copy.nothingReported}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 p-4">
                    <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                      {copy.missingInformation}
                    </p>
                    <p className="mt-2 text-sm">
                      {qualification.missing.length
                        ? qualification.missing.join(" · ")
                        : copy.nothingReported}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 p-4">
                    <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                      {copy.riskFlags}
                    </p>
                    <p className="mt-2 text-sm">
                      {qualification.risks.length
                        ? qualification.risks.join(" · ")
                        : copy.nothingReported}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{copy.missing}</p>
            )}
            <div className="mt-4 rounded-2xl border border-white/10 p-4">
              <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                {copy.nextAction}
              </p>
              <p className="mt-2 text-sm">
                {copy.actionLabels[caseData.nextAction.kind]}
              </p>
            </div>
            <InformationRequestButton
              leadId={caseData.lead.id}
              locale={user.interfaceLanguage}
            />
          </Section>

          <Section id="measurement-section" title={copy.measurement}>
            {caseData.measurement ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong>{caseData.measurement.reference}</strong>
                    {caseData.measurement.normalizedAddress ? (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {caseData.measurement.normalizedAddress}
                      </p>
                    ) : null}
                  </div>
                  <Status
                    locale={user.interfaceLanguage}
                    value={caseData.measurement.status}
                  />
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      {copy.area}
                    </dt>
                    <dd className="mt-1 font-bold">
                      {area(caseData.measurement.actualAreaMinTenths)}–
                      {area(caseData.measurement.actualAreaMaxTenths)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      {copy.confidence}
                    </dt>
                    <dd className="mt-1 font-bold">
                      {caseData.measurement.confidence || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Horizontal
                    </dt>
                    <dd className="mt-1 font-bold">
                      {area(caseData.measurement.horizontalAreaTenths)}
                    </dd>
                  </div>
                </dl>
                {caseData.measurement.manualAreaOverrideTenths ? (
                  <div className="border-accent/30 bg-accent/8 mt-4 rounded-xl border p-3 text-sm">
                    <strong className="text-accent">
                      {copy.manualOverrideBadge}
                    </strong>
                    <span className="ml-2">
                      {area(caseData.measurement.manualAreaOverrideTenths)}
                    </span>
                    {caseData.measurement.manualOverrideReason ? (
                      <p className="text-muted-foreground mt-1">
                        {caseData.measurement.manualOverrideReason}
                      </p>
                    ) : null}
                    {caseData.measurement.manualOverriddenAt ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDate(caseData.measurement.manualOverriddenAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {caseData.measurement.confidenceReasoning ? (
                  <p className="text-muted-foreground mt-4 text-sm">
                    {caseData.measurement.confidenceReasoning}
                  </p>
                ) : null}
                <TechnicalLink
                  entity={caseData.measurement}
                  label={copy.technicalDetail}
                  summary={copy.advancedTechnical}
                />
              </>
            ) : (
              <p className="text-muted-foreground">{copy.missing}</p>
            )}
            <MeasurementReviewPanel
              canApprovePackage={caseData.nextAction.kind === "approve_package"}
              city={caseData.lead.city}
              currentAreaTenths={caseData.measurement?.actualAreaMaxTenths}
              currentBuildingId={caseData.measurement?.buildingIdentifier}
              currentMode={caseData.measurement?.measurementMode}
              evidenceHref={caseData.measurement?.evidenceHref}
              inquiryType={caseData.lead.inquiryType || "usikker"}
              leadAddress={caseData.lead.streetAddress || ""}
              leadId={caseData.lead.id}
              latitude={caseData.measurement?.latitude}
              locale={user.interfaceLanguage}
              longitude={caseData.measurement?.longitude}
              measurementId={caseData.measurement?.id}
              postal={caseData.lead.postal}
              revision={caseData.lead.revision}
              sourceUrl={caseData.measurement?.sourceUrl}
              measurementStatus={caseData.measurement?.status}
            />
          </Section>

          <Section
            id="price-quote-section"
            title={`${copy.pricing} · ${copy.quote}`}
          >
            {caseData.price ? (
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.priceExVat}
                  </dt>
                  <dd className="mt-1 font-bold">
                    {nok(caseData.price.subtotalExVatOre)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">{copy.vat}</dt>
                  <dd className="mt-1 font-bold">
                    {nok(caseData.price.vatOre)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.priceIncVat}
                  </dt>
                  <dd className="text-accent mt-1 font-bold">
                    {nok(caseData.price.totalIncVatOre)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {copy.maximum}
                  </dt>
                  <dd className="mt-1 font-bold">
                    {nok(caseData.price.maximumTotalIncVatOre)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground">{copy.missing}</p>
            )}
            {caseData.quote ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong>{caseData.quote.reference}</strong>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {copy.validUntil}: {formatDate(caseData.quote.validUntil)}
                    </p>
                  </div>
                  <Status
                    locale={user.interfaceLanguage}
                    value={caseData.quote.status}
                  />
                </div>
                {caseData.quote.declineReason ||
                caseData.quote.declineComment ? (
                  <div className="border-warning/25 bg-warning/5 mt-3 rounded-xl border p-3 text-sm">
                    <strong>
                      {caseData.quote.declineReason ||
                        metadataLabel(user.interfaceLanguage, "declined")}
                    </strong>
                    {caseData.quote.declineComment ? (
                      <p className="mt-1 whitespace-pre-wrap text-white/75">
                        {caseData.quote.declineComment}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <a
                  className="hover:border-accent/50 hover:text-accent mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold"
                  href={`/api/admin/quotes/${caseData.quote.id}/pdf`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {copy.previewQuotePdf}
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
                <TechnicalLink
                  entity={caseData.quote}
                  label={copy.technicalDetail}
                  summary={copy.advancedTechnical}
                />
              </div>
            ) : null}
            {caseData.quoteOptions.length > 1 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {caseData.quoteOptions.map((option) => (
                  <article
                    className="border-accent/25 rounded-2xl border bg-black/15 p-4"
                    key={option.id}
                  >
                    <p className="text-accent text-xs font-bold tracking-wider uppercase">
                      {option.optionKind === "recommended"
                        ? copy.recommendedOption
                        : copy.originalOption}
                    </p>
                    <h3 className="mt-2 font-bold">
                      {option.serviceDescription}
                    </h3>
                    <p className="mt-2 text-2xl font-black">
                      {nok(option.totalIncVatOre)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {copy.maximum}: {nok(option.maximumTotalIncVatOre)}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <Status
                        locale={user.interfaceLanguage}
                        value={option.status}
                      />
                      <a
                        className="text-accent text-sm font-semibold hover:underline"
                        href={`/api/admin/quotes/${option.id}/pdf`}
                        target="_blank"
                      >
                        PDF
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {caseData.quote &&
            ["draft", "declined"].includes(caseData.quote.status || "") &&
            caseData.price ? (
              <CommercialQuoteEditor
                currentService={caseData.lead.inquiryType}
                leadId={caseData.lead.id}
                locale={user.interfaceLanguage}
                rules={rules}
                unitPriceExVatOre={
                  caseData.quote.optionKind === "recommended"
                    ? undefined
                    : caseData.price.unitPriceExVatOre
                }
              />
            ) : null}
          </Section>

          <Section id="messages-section" title={copy.messages}>
            {caseData.messages.length ? (
              <div className="grid min-w-0 gap-3">
                {caseData.messages
                  .filter((message) => message.id !== displayedReply?.id)
                  .map((message) => {
                    const source = message.replyToMessageId
                      ? caseData.messages.find(
                          (candidate) =>
                            candidate.id === message.replyToMessageId,
                        )
                      : undefined;
                    return message.status === "draft" &&
                      message.direction === "outbound" ? (
                      <div
                        className="scroll-mt-24"
                        id={`message-${message.id}`}
                        key={`${message.id}:${message.updatedAt || ""}`}
                      >
                        <MessageDraftEditor
                          aiAssisted={message.aiAssisted}
                          bodyText={message.bodyText}
                          caseRevision={caseData.lead.revision}
                          factWarnings={factWarnings(message.aiAnalysis)}
                          leadId={caseData.lead.id}
                          locale={user.interfaceLanguage}
                          manualReplyRequiresEditing={manualReplyRequiresEditing(
                            message.aiAnalysis,
                          )}
                          messageId={message.id}
                          messageUpdatedAt={
                            message.updatedAt || message.createdAt || ""
                          }
                          sourceBody={source?.bodyText}
                          sourceSubject={source?.subject}
                          subject={message.subject}
                        />
                        <TechnicalLink
                          entity={message}
                          label={copy.technicalDetail}
                          summary={copy.advancedTechnical}
                        />
                      </div>
                    ) : (
                      <article
                        className="min-w-0 scroll-mt-24 rounded-2xl border border-white/10 bg-black/15 p-4"
                        id={`message-${message.id}`}
                        key={message.id}
                      >
                        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <strong className="[overflow-wrap:anywhere] break-words">
                              {message.subject}
                            </strong>
                            <p className="text-muted-foreground mt-1 text-xs break-words">
                              {metadataLabel(
                                user.interfaceLanguage,
                                message.direction,
                              )}{" "}
                              ·{" "}
                              {metadataLabel(
                                user.interfaceLanguage,
                                message.category,
                              )}{" "}
                              ·{" "}
                              {metadataLabel(
                                user.interfaceLanguage,
                                message.channel,
                              )}
                            </p>
                          </div>
                          <Status
                            locale={user.interfaceLanguage}
                            value={message.status}
                          />
                        </div>
                        <p className="mt-3 max-h-40 min-w-0 overflow-auto text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-white/80">
                          {message.bodyText}
                        </p>
                        {message.failureMessage ? (
                          <p className="text-danger mt-3 text-sm">
                            {message.failureMessage}
                          </p>
                        ) : null}
                        {message.direction === "outbound" &&
                        message.channel === "email" &&
                        !["draft", "cancelled"].includes(
                          message.status || "",
                        ) ? (
                          <ManualContactRecoveryPanel
                            locale={user.interfaceLanguage}
                            messageId={message.id}
                            recovery={message.manualRecovery}
                          />
                        ) : null}
                        <TechnicalLink
                          entity={message}
                          label={copy.technicalDetail}
                          summary={copy.advancedTechnical}
                        />
                      </article>
                    );
                  })}
              </div>
            ) : (
              <p className="text-muted-foreground">{copy.noMessages}</p>
            )}
          </Section>
          {caseData.lead.nextActionBlocker ===
            "CUSTOMER_CANCELLATION_REQUEST" && activeContractRequest ? (
            <ContractRequestReviewPanel
              currentService={caseData.lead.inquiryType}
              locale={user.interfaceLanguage}
              request={activeContractRequest}
            />
          ) : caseData.lead.nextActionBlocker ===
            "CUSTOMER_CANCELLATION_REQUEST" ? (
            <CancellationReviewPanel
              customerMessage={cancellationSource?.bodyText}
              leadId={caseData.lead.id}
              locale={user.interfaceLanguage}
            />
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6">
          <Section id="contract-section" title={copy.contract}>
            {caseData.contract ? (
              <>
                <div className="flex flex-wrap justify-between gap-3">
                  <strong>{caseData.contract.reference}</strong>
                  <Status
                    companySignedAt={caseData.contract.companySignedAt}
                    contract
                    locale={user.interfaceLanguage}
                    value={caseData.contract.status}
                  />
                </div>
                {caseData.contract.signedAt ? (
                  <p className="text-muted-foreground mt-3 text-sm">
                    {copy.customerSignedAt}:{" "}
                    {formatDate(caseData.contract.signedAt)}
                  </p>
                ) : null}
                {caseData.contract.companySignedAt ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {copy.companySignedAt}:{" "}
                    {formatDate(caseData.contract.companySignedAt)}
                  </p>
                ) : null}
                <TechnicalLink
                  entity={caseData.contract}
                  label={copy.technicalDetail}
                  summary={copy.advancedTechnical}
                />
              </>
            ) : (
              <p className="text-muted-foreground">{copy.missing}</p>
            )}
          </Section>

          <Section id="work-section" title={copy.work}>
            {caseData.workOrder ? (
              <>
                <div className="flex flex-wrap justify-between gap-3">
                  <strong>{caseData.workOrder.reference}</strong>
                  <Status
                    locale={user.interfaceLanguage}
                    value={caseData.workOrder.status}
                  />
                </div>
                <dl className="mt-4 grid gap-3">
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      {copy.employee}
                    </dt>
                    <dd className="font-semibold">
                      {caseData.workOrder.assignedWorker || copy.unassigned}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      {copy.scheduled}
                    </dt>
                    <dd className="font-semibold">
                      {formatDate(caseData.workOrder.scheduledAt)}
                    </dd>
                  </div>
                  {caseData.workOrder.arrivalWindow ? (
                    <div>
                      <dt className="text-muted-foreground text-xs">
                        {copy.arrivalWindow}
                      </dt>
                      <dd className="font-semibold">
                        {caseData.workOrder.arrivalWindow}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <TechnicalLink
                  entity={caseData.workOrder}
                  label={copy.technicalDetail}
                  summary={copy.advancedTechnical}
                />
              </>
            ) : (
              <p className="text-muted-foreground">{copy.missing}</p>
            )}
            {caseData.contract &&
            ((caseData.nextAction.kind === "create_work_order" &&
              !caseData.workOrder) ||
              (caseData.workOrder &&
                ["unassigned", "assigned", "scheduled"].includes(
                  caseData.workOrder.status || "",
                ))) ? (
              <WorkOrderPlanningPanel
                adminNote={caseData.workOrder?.adminNote}
                arrivalWindow={caseData.workOrder?.arrivalWindow}
                assignedWorkerId={caseData.workOrder?.assignedWorkerId}
                caseId={Number(id)}
                contractId={caseData.contract.id}
                contractDocumentHash={
                  caseData.commercial.contractVersions.find(
                    (item) => item.id === caseData.contract?.id,
                  )?.documentHash || caseData.contract.documentHash
                }
                contractReference={
                  caseData.commercial.contractVersions.find(
                    (item) => item.id === caseData.contract?.id,
                  )?.reference || caseData.contract.reference
                }
                contractVersion={
                  caseData.commercial.contractVersions.find(
                    (item) => item.id === caseData.contract?.id,
                  )?.version
                }
                incompleteWorkerCount={incompleteWorkerCount}
                locale={user.interfaceLanguage}
                scheduledLocal={
                  caseData.workOrder?.scheduledAt
                    ? formatNorwayDateTimeInput(caseData.workOrder.scheduledAt)
                    : undefined
                }
                status={caseData.workOrder?.status}
                workOrderId={caseData.workOrder?.id}
                workers={workers}
              />
            ) : null}
            {caseData.workOrder &&
            caseData.nextAction.kind === "review_completion" ? (
              <div id="completion-review">
                <CompletionReviewPanel
                  actualAreaTenths={caseData.workOrder.actualAreaTenths}
                  actualTotalIncVatOre={caseData.workOrder.actualTotalIncVatOre}
                  afterPhotoCount={caseData.workOrder.afterPhotoCount}
                  beforePhotoCount={caseData.workOrder.beforePhotoCount}
                  completionNotes={caseData.workOrder.completionNotes}
                  locale={user.interfaceLanguage}
                  workOrderId={caseData.workOrder.id}
                  workSummary={caseData.workOrder.workSummary}
                />
              </div>
            ) : null}
          </Section>

          <Section id="changes-section" title={copy.changes}>
            {caseData.workOrder?.status === "blocked" ? (
              <ChangeAgreementPanel
                actualAreaTenths={caseData.workOrder.actualAreaTenths}
                actualTotalIncVatOre={caseData.workOrder.actualTotalIncVatOre}
                blockingReasons={caseData.workOrder.blockingReasons}
                changes={caseData.changes}
                locale={user.interfaceLanguage}
                priceOutcome={caseData.workOrder.priceOutcome}
                scopeChangeDetails={caseData.workOrder.scopeChangeDetails}
                workOrderId={caseData.workOrder.id}
              />
            ) : caseData.changes.length ? (
              <div className="grid gap-3">
                {caseData.changes.map((change) => (
                  <div
                    className="rounded-xl border border-white/10 p-3"
                    key={change.id}
                  >
                    <div className="flex justify-between gap-2">
                      <strong>{change.reference}</strong>
                      <Status
                        locale={user.interfaceLanguage}
                        value={change.status}
                      />
                    </div>
                    {change.summary ? (
                      <p className="text-muted-foreground mt-2 text-sm">
                        {change.summary}
                      </p>
                    ) : null}
                    <a
                      className="text-accent mt-3 inline-flex text-sm font-semibold hover:underline"
                      href={`/api/admin/change-agreements/${change.id}/pdf`}
                      target="_blank"
                    >
                      PDF
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{copy.missing}</p>
            )}
          </Section>

          <Section id="documents-section" title={copy.documents}>
            {caseData.invoice || caseData.warranty ? (
              <div className="mb-4 grid gap-3">
                {caseData.invoice ? (
                  <div
                    className="scroll-mt-24 rounded-xl border border-white/10 p-3"
                    id={`invoice-${caseData.invoice.id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          {copy.invoiceDraft}
                        </p>
                        <strong>{caseData.invoice.reference}</strong>
                      </div>
                      <Status
                        locale={user.interfaceLanguage}
                        value={caseData.invoice.status}
                      />
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {nok(caseData.invoice.totalIncVatOre)} · {copy.due}:{" "}
                      {formatDate(caseData.invoice.dueAt)}
                    </p>
                    {caseData.invoice.documentId ? (
                      <a
                        className="text-accent mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                        href={`/api/admin/media/${caseData.invoice.documentId}`}
                        target="_blank"
                      >
                        PDF
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                    ) : null}
                    <InvoiceRecordPanel
                      adminNote={caseData.invoice.adminNote}
                      externalReference={caseData.invoice.externalReference}
                      id={caseData.invoice.id}
                      locale={user.interfaceLanguage}
                      status={caseData.invoice.status || "draft"}
                    />
                    <OfficialInvoiceManager
                      invoiceRecordId={caseData.invoice.id}
                      invoiceRecordStatus={caseData.invoice.status || "draft"}
                      items={caseData.officialInvoices}
                      locale={user.interfaceLanguage}
                    />
                  </div>
                ) : null}
                {caseData.warranty ? (
                  <div
                    className="scroll-mt-24 rounded-xl border border-white/10 p-3"
                    id={`warranty-${caseData.warranty.id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          {copy.warranty}
                        </p>
                        <strong>{caseData.warranty.reference}</strong>
                      </div>
                      <Status
                        locale={user.interfaceLanguage}
                        value={caseData.warranty.status}
                      />
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {copy.warrantyUntil}:{" "}
                      {formatDate(caseData.warranty.endsAt)}
                    </p>
                    {caseData.warranty.documentId ? (
                      <a
                        className="text-accent mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                        href={`/api/admin/media/${caseData.warranty.documentId}`}
                        target="_blank"
                      >
                        PDF
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {caseData.documents.length ? (
              <div className="grid min-w-0 gap-2">
                {caseData.documents.map((document) => (
                  <a
                    className="hover:border-accent/50 hover:text-accent flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold"
                    href={document.href}
                    key={document.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {document.filename}
                    </span>
                    <ExternalLink
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{copy.noDocuments}</p>
            )}
          </Section>

          <Section id="timeline-section" title={copy.timeline}>
            <ol className="relative ml-2 border-l border-white/10 pl-5">
              {caseData.timeline.map((item) => (
                <li className="relative pb-5 last:pb-0" key={item.id}>
                  <span className="bg-accent ring-background-elevated absolute top-1 -left-[1.57rem] size-2.5 rounded-full ring-4" />
                  {item.href ? (
                    <Link
                      className="block rounded-xl p-2 transition hover:bg-white/5"
                      href={item.href}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{item.title}</strong>
                        <Status
                          locale={user.interfaceLanguage}
                          value={item.status}
                        />
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDate(item.at)} ·{" "}
                        {timelineTypeLabel(user.interfaceLanguage, item.type)}
                      </p>
                    </Link>
                  ) : (
                    <div className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{item.title}</strong>
                        <Status
                          locale={user.interfaceLanguage}
                          value={item.status}
                        />
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDate(item.at)} ·{" "}
                        {timelineTypeLabel(user.interfaceLanguage, item.type)}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
      <CaseLifecyclePanel
        classification={caseData.lead.archiveClassification}
        leadId={caseData.lead.id}
        locale={user.interfaceLanguage}
        purgeAfter={caseData.lead.purgeAfter}
        recordState={caseData.lead.recordState}
      />
    </div>
  );
}
