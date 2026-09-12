import Link from "next/link";
import {
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Filter,
  FolderOpen,
  Search,
} from "lucide-react";
import {
  adminDocumentTypes,
  groupDocumentPage,
  isMetadataOnlyDocument,
  type AdminDocumentType,
} from "@/lib/admin-v2/documents";
import {
  loadAdminDocumentRegister,
  type AdminDocumentRegister,
} from "@/lib/admin-v2/document-register";
import { AdminReadError } from "@/lib/admin-v2/admin-read-db";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import { statusLabel } from "@/lib/admin-v2/labels";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { panelDateLocale } from "@/lib/panel-i18n";
import { getPayload } from "@/lib/payload";
import { getCaseRecordCopy } from "@/lib/admin-v2/case-record-copy";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

function documentType(input?: string): AdminDocumentType {
  return adminDocumentTypes.includes(input as AdminDocumentType)
    ? (input as AdminDocumentType)
    : "all";
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAdminUser();
  const copy = getAdminV2Copy(user.interfaceLanguage);
  const recordCopy = getCaseRecordCopy(user.interfaceLanguage);
  const params = await searchParams;
  const filters = {
    query: value(params.q),
    status: value(params.status) || "all",
    type: documentType(value(params.type)),
  };
  const payload = await getPayload();
  const pagingCopy =
    user.interfaceLanguage === "lt"
      ? {
          previous: "Ankstesni",
          next: "Kiti",
          page: "dokumentai ir įrašai šiame puslapyje",
          help: "Iki 25 dokumentų ar įrašų puslapyje. Paieška apima visą registrą. Nauji įrašai ar būsenų pakeitimai gali pakeisti kitą puslapį.",
          error:
            "Dokumentų registro nepavyko įkelti. Bandykite dar kartą nuo pradžios.",
          unsupported:
            "Šiam dokumentų registrui reikalinga PostgreSQL duomenų bazė.",
          reset: "Grįžti į pradžią",
          navigation: "Dokumentų puslapiai",
        }
      : user.interfaceLanguage === "en"
        ? {
            previous: "Previous",
            next: "Next",
            page: "documents and records on this page",
            help: "Up to 25 documents or records per page. Search covers the entire register. New records or status changes may affect the next page.",
            error:
              "The document register could not be loaded. Please try again from the start.",
            unsupported:
              "This document register requires a PostgreSQL database.",
            reset: "Back to start",
            navigation: "Document pages",
          }
        : {
            previous: "Forrige",
            next: "Neste",
            page: "dokumenter og oppføringer på denne siden",
            help: "Opptil 25 dokumenter eller oppføringer per side. Søket dekker hele registeret. Nye oppføringer eller statusendringer kan påvirke neste side.",
            error:
              "Dokumentregisteret kunne ikke lastes. Prøv igjen fra starten.",
            unsupported:
              "Dette dokumentregisteret krever en PostgreSQL-database.",
            reset: "Til starten",
            navigation: "Dokumentsider",
          };
  let register: AdminDocumentRegister = { items: [], statuses: [] };
  let loadError: string | undefined;
  try {
    register = await loadAdminDocumentRegister(
      payload,
      user,
      filters,
      value(params.cursor),
      value(params.direction) === "backward" ? "backward" : "forward",
    );
  } catch (error) {
    if (error instanceof AdminReadError && error.code === "ADMIN_REQUIRED")
      throw error;
    loadError =
      error instanceof AdminReadError && error.code === "UNSUPPORTED_DATABASE"
        ? pagingCopy.unsupported
        : pagingCopy.error;
  }
  const documents = register.items;
  const statuses = register.statuses;
  const groups = groupDocumentPage(documents);
  const pageHref = (cursor?: string, direction?: string) => {
    const query = new URLSearchParams();
    if (filters.query) query.set("q", filters.query);
    if (filters.status !== "all") query.set("status", filters.status);
    if (filters.type !== "all") query.set("type", filters.type);
    if (cursor) query.set("cursor", cursor);
    if (direction) query.set("direction", direction);
    return `/admin-v2/documents${query.size ? `?${query}` : ""}`;
  };
  const locale = panelDateLocale(user.interfaceLanguage);
  const formatDate = (date?: string) =>
    date
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Oslo",
        }).format(new Date(date))
      : "—";
  const exportCopy =
    user.interfaceLanguage === "lt"
      ? {
          title: "Mėnesio buhalterinis eksportas",
          help: "Atsisiųskite ZIP su originaliais Fiken PDF ir CSV su patvirtintais duomenimis.",
          button: "Atsisiųsti ZIP",
        }
      : user.interfaceLanguage === "en"
        ? {
            title: "Monthly accounting export",
            help: "Download a ZIP with the original Fiken PDFs and a CSV of confirmed fields.",
            button: "Download ZIP",
          }
        : {
            title: "Månedlig regnskapseksport",
            help: "Last ned ZIP med originale Fiken-PDF-er og CSV med bekreftede opplysninger.",
            button: "Last ned ZIP",
          };
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-accent text-xs font-bold tracking-[.2em] uppercase">
          {copy.control}
        </p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          <FolderOpen aria-hidden="true" className="text-accent size-8" />
          {copy.documents.title}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          {copy.documents.intro}
        </p>
      </header>

      <section
        aria-labelledby="document-filter-title"
        className="bg-background-elevated/75 rounded-3xl border border-white/10 p-4 sm:p-6"
      >
        <h2
          className="flex items-center gap-2 text-lg font-bold"
          id="document-filter-title"
        >
          <Filter aria-hidden="true" className="text-accent size-5" />
          {copy.documents.filters}
        </h2>
        <form
          action="/admin-v2/documents"
          className="mt-5 grid gap-4 lg:grid-cols-12"
        >
          <label className="grid gap-1.5 lg:col-span-6">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.documents.query}
            </span>
            <span className="focus-within:border-accent/60 flex min-h-12 items-center rounded-xl border border-white/10 bg-black/15 px-3">
              <Search
                aria-hidden="true"
                className="text-muted-foreground mr-2 size-4"
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                defaultValue={filters.query}
                maxLength={80}
                name="q"
                type="search"
              />
            </span>
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.documents.type}
            </span>
            <select
              className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm"
              defaultValue={filters.type}
              name="type"
            >
              <option value="all">{copy.documents.all}</option>
              {adminDocumentTypes
                .filter((type) => type !== "all")
                .map((type) => (
                  <option key={type} value={type}>
                    {copy.documents.types[type]}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {copy.documents.status}
            </span>
            <select
              className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3 text-sm"
              defaultValue={filters.status}
              name="status"
            >
              <option value="all">{copy.documents.all}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(user.interfaceLanguage, status)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3 lg:col-span-12 lg:justify-end">
            <Link
              className="hover:border-accent/50 grid min-h-12 place-items-center rounded-xl border border-white/10 px-5 text-sm font-semibold"
              href="/admin-v2/documents"
            >
              {copy.documents.clear}
            </Link>
            <button
              className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-12 rounded-xl px-5 font-bold"
              type="submit"
            >
              {copy.documents.apply}
            </button>
          </div>
        </form>
      </section>

      <section className="border-accent/25 bg-accent/5 rounded-3xl border p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Download aria-hidden="true" className="text-accent size-5" />
          {exportCopy.title}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">{exportCopy.help}</p>
        <form
          action="/api/admin/official-invoices/export"
          className="mt-4 flex flex-wrap gap-3"
          method="get"
        >
          <input
            className="min-h-12 rounded-xl border border-white/10 bg-[#11151d] px-3"
            defaultValue={currentMonth}
            max={currentMonth}
            name="month"
            required
            type="month"
          />
          <button
            className="bg-accent text-accent-foreground hover:bg-accent-hover min-h-12 rounded-xl px-5 font-bold"
            type="submit"
          >
            {exportCopy.button}
          </button>
        </form>
      </section>

      <section aria-live="polite">
        <p className="text-muted-foreground mb-2 text-sm">{pagingCopy.help}</p>
        {loadError ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-amber-400/40 p-4"
          >
            <p>{loadError}</p>
            <Link
              className="mt-2 inline-block underline"
              href={pageHref()}
              prefetch={false}
            >
              {pagingCopy.reset}
            </Link>
          </div>
        ) : (
          <p className="text-muted-foreground mb-3 text-sm font-semibold">
            <span className="text-white">{documents.length}</span>{" "}
            {pagingCopy.page} ·{" "}
            <span className="text-white">
              {new Set(documents.map((item) => item.leadId)).size}
            </span>{" "}
            {copy.documents.cases}
          </p>
        )}
        {groups.length ? (
          <div className="grid gap-5">
            {groups.map((group) => (
              <article
                className="bg-background-elevated/75 overflow-hidden rounded-3xl border border-white/10"
                key={group.key}
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-accent text-xs font-bold tracking-wider uppercase">
                      #{group.leadId}
                    </p>
                    <h2 className="mt-1 text-xl font-bold">{group.customer}</h2>
                  </div>
                  <Link
                    className="border-accent/35 text-accent hover:bg-accent/10 inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold"
                    href={group.caseHref}
                  >
                    {copy.documents.openCase}
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                </header>
                <div className="divide-y divide-white/10">
                  {group.documents.map((document) => (
                    <div
                      className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,.6fr)_auto] lg:items-center"
                      key={document.id}
                    >
                      <div className="min-w-0">
                        <p className="text-accent flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                          <FileCheck2 aria-hidden="true" className="size-4" />
                          {copy.documents.types[document.type]}
                        </p>
                        <strong className="mt-1 block truncate">
                          {document.reference}
                        </strong>
                        <p className="text-muted-foreground truncate text-sm">
                          {isMetadataOnlyDocument(document)
                            ? recordCopy.noPdf
                            : document.filename}
                        </p>
                      </div>
                      <div className="text-muted-foreground text-sm">
                        <p>
                          {document.version
                            ? `${copy.documents.version} ${document.version} · `
                            : ""}
                          {document.status
                            ? statusLabel(
                                user.interfaceLanguage,
                                document.status,
                              )
                            : "—"}
                        </p>
                        <p className="mt-1">{formatDate(document.createdAt)}</p>
                        {document.hash ? (
                          <p
                            className="mt-1 font-mono text-xs"
                            title={document.hash}
                          >
                            {copy.documents.integrity}:{" "}
                            {document.hash.slice(0, 12)}…
                          </p>
                        ) : null}
                      </div>
                      <a
                        className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold"
                        href={document.href}
                        rel="noreferrer"
                        target={
                          isMetadataOnlyDocument(document)
                            ? undefined
                            : "_blank"
                        }
                      >
                        <FileSearch aria-hidden="true" className="size-4" />
                        {isMetadataOnlyDocument(document)
                          ? recordCopy.openRecord
                          : copy.documents.openDocument}
                      </a>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : !loadError ? (
          <div className="bg-background-elevated/45 text-muted-foreground rounded-3xl border border-dashed border-white/15 p-8 text-center">
            {copy.documents.empty}
          </div>
        ) : null}
        {!loadError ? (
          <nav
            aria-label={pagingCopy.navigation}
            className="mt-5 flex flex-wrap items-center justify-between gap-3"
          >
            {register.previousCursor ? (
              <Link
                className="min-h-11 rounded-xl border border-white/15 px-4 py-3"
                href={pageHref(register.previousCursor, "backward")}
                prefetch={false}
              >
                {pagingCopy.previous}
              </Link>
            ) : (
              <span />
            )}
            {value(params.cursor) ? (
              <Link
                className="px-4 py-3 text-sm underline"
                href={pageHref()}
                prefetch={false}
              >
                {pagingCopy.reset}
              </Link>
            ) : null}
            {register.nextCursor ? (
              <Link
                className="min-h-11 rounded-xl border border-white/15 px-4 py-3"
                href={pageHref(register.nextCursor, "forward")}
                prefetch={false}
              >
                {pagingCopy.next}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
