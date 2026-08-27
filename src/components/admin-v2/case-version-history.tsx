import { ArrowRight, ExternalLink } from "lucide-react";
import type { CaseCommercialVersion } from "@/lib/admin-v2/case-commercial-context";
import { statusLabel } from "@/lib/admin-v2/labels";
import type { PanelLocale } from "@/lib/panel-i18n";

type VersionHistoryCopy = {
  combinedDocument: string;
  contractIncludedInCombinedDocument: string;
  companySignedAt: string;
  created: string;
  customerSignedAt: string;
  effective: string;
  historical: string;
  maximum: string;
  openDocument: string;
  quoteVersions: string;
  replaces: string;
  technicalInformation: string;
  versionHistory: string;
  working: string;
  contractVersions: string;
};

function RoleBadge({
  copy,
  role,
}: {
  copy: VersionHistoryCopy;
  role: CaseCommercialVersion["role"];
}) {
  const label =
    role === "effective"
      ? copy.effective
      : role === "working"
        ? copy.working
        : copy.historical;
  return (
    <span
      className={
        role === "effective"
          ? "border-success/35 bg-success/10 text-success rounded-full border px-2.5 py-1 text-[.68rem] font-bold tracking-wider uppercase"
          : role === "working"
            ? "border-accent/35 bg-accent/10 text-accent rounded-full border px-2.5 py-1 text-[.68rem] font-bold tracking-wider uppercase"
            : "text-muted-foreground rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[.68rem] font-bold tracking-wider uppercase"
      }
    >
      {label}
    </span>
  );
}

function VersionCard({
  copy,
  formatDate,
  formatMoney,
  locale,
  sharedQuoteReference,
  version,
}: {
  copy: VersionHistoryCopy;
  formatDate: (value?: string) => string;
  formatMoney: (value?: number) => string;
  locale: PanelLocale;
  sharedQuoteReference?: string;
  version: CaseCommercialVersion;
}) {
  return (
    <article
      className="min-w-[15rem] flex-1 rounded-2xl border border-white/10 bg-black/15 p-4"
      id={`commercial-${version.kind}-${version.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-black">{version.reference}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {statusLabel(locale, version.status, {
              contract: version.kind === "contract",
              companySignedAt: version.companySignedAt,
            })}
          </p>
        </div>
        <RoleBadge copy={copy} role={version.role} />
      </div>

      {version.serviceDescription ? (
        <p className="mt-3 text-sm font-semibold">{version.serviceDescription}</p>
      ) : null}
      {typeof version.totalIncVatOre === "number" ? (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Sum</p>
            <p className="font-bold">{formatMoney(version.totalIncVatOre)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{copy.maximum}</p>
            <p className="font-bold">
              {formatMoney(version.maximumTotalIncVatOre)}
            </p>
          </div>
        </div>
      ) : null}
      <dl className="text-muted-foreground mt-3 grid gap-1 text-xs">
        {version.supersedesReference ? (
          <div className="flex gap-2">
            <dt>{copy.replaces}:</dt>
            <dd className="font-semibold text-white/80">
              {version.supersedesReference}
            </dd>
          </div>
        ) : null}
        {version.createdAt ? (
          <div className="flex gap-2">
            <dt>{copy.created}:</dt>
            <dd>{formatDate(version.createdAt)}</dd>
          </div>
        ) : null}
        {version.signedAt ? (
          <div className="flex gap-2">
            <dt>{copy.customerSignedAt}:</dt>
            <dd>{formatDate(version.signedAt)}</dd>
          </div>
        ) : null}
        {version.companySignedAt ? (
          <div className="flex gap-2">
            <dt>{copy.companySignedAt}:</dt>
            <dd>{formatDate(version.companySignedAt)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {sharedQuoteReference ? (
          <p className="text-muted-foreground rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm">
            {copy.contractIncludedInCombinedDocument.replace(
              "{reference}",
              sharedQuoteReference,
            )}
          </p>
        ) : (
          <a
            aria-label={`${copy.openDocument} ${version.reference}`}
            className="hover:border-accent/50 hover:text-accent inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-bold"
            href={version.pdfHref}
            rel="noreferrer"
            target="_blank"
          >
            {version.kind === "quote"
              ? copy.combinedDocument
              : copy.openDocument}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
        <details className="basis-full text-xs">
          <summary className="text-muted-foreground hover:text-accent cursor-pointer py-2 font-semibold">
            {copy.technicalInformation}
          </summary>
          <p className="text-muted-foreground break-all">
            Hash: {version.documentHash || "—"}
          </p>
          <a
            className="text-accent mt-2 inline-flex items-center gap-2 font-semibold hover:underline"
            href={version.technicalHref}
          >
            {copy.technicalInformation}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </details>
      </div>
    </article>
  );
}

function Chain({
  copy,
  formatDate,
  formatMoney,
  locale,
  sharedQuoteByContractId,
  title,
  versions,
}: {
  copy: VersionHistoryCopy;
  formatDate: (value?: string) => string;
  formatMoney: (value?: number) => string;
  locale: PanelLocale;
  sharedQuoteByContractId?: Map<number, string>;
  title: string;
  versions: CaseCommercialVersion[];
}) {
  const ordered = [...versions].sort(
    (left, right) => left.version - right.version || left.id - right.id,
  );
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-bold tracking-wider uppercase text-white/80">
        {title}
      </h3>
      {ordered.length ? (
        <div className="mt-3 flex min-w-0 max-w-full items-stretch gap-2 overflow-x-auto pb-2">
          {ordered.map((version, index) => (
            <div className="contents" key={`${version.kind}-${version.id}`}>
              {index ? (
                <ArrowRight
                  aria-hidden="true"
                  className="text-accent/70 my-auto size-5 shrink-0"
                />
              ) : null}
              <VersionCard
                copy={copy}
                formatDate={formatDate}
                formatMoney={formatMoney}
                locale={locale}
                sharedQuoteReference={sharedQuoteByContractId?.get(version.id)}
                version={version}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm">—</p>
      )}
    </div>
  );
}

export function CaseVersionHistory({
  contracts,
  copy,
  formatDate,
  formatMoney,
  locale,
  quotes,
}: {
  contracts: CaseCommercialVersion[];
  copy: VersionHistoryCopy;
  formatDate: (value?: string) => string;
  formatMoney: (value?: number) => string;
  locale: PanelLocale;
  quotes: CaseCommercialVersion[];
}) {
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const sharedQuoteByContractId = new Map<number, string>();
  for (const contract of contracts) {
    const quote = contract.quoteId
      ? quoteById.get(contract.quoteId)
      : undefined;
    if (quote && contract.pdfHref === quote.pdfHref) {
      sharedQuoteByContractId.set(contract.id, quote.reference);
    }
  }

  return (
    <section
      aria-labelledby="version-history-title"
      className="scroll-mt-36 rounded-3xl border border-white/10 bg-background-elevated/75 p-5 sm:p-6"
      id="version-history-section"
    >
      <h2 className="text-xl font-bold" id="version-history-title">
        {copy.versionHistory}
      </h2>
      <div className="mt-5 grid min-w-0 gap-6">
        <Chain
          copy={copy}
          formatDate={formatDate}
          formatMoney={formatMoney}
          locale={locale}
          title={copy.quoteVersions}
          versions={quotes}
        />
        <Chain
          copy={copy}
          formatDate={formatDate}
          formatMoney={formatMoney}
          locale={locale}
          sharedQuoteByContractId={sharedQuoteByContractId}
          title={copy.contractVersions}
          versions={contracts}
        />
      </div>
    </section>
  );
}
