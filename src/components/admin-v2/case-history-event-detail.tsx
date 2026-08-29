import { ChevronDown, ExternalLink, FileText } from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";

export type CaseHistoryEventFact = {
  label: string;
  value?: string | null;
};

export type CaseHistoryEventLink = {
  href: string;
  label: string;
  kind?: "document" | "source";
};

export type CaseHistoryEventDetailProps = {
  eventId: string;
  eventType: string;
  facts?: readonly CaseHistoryEventFact[];
  links: readonly CaseHistoryEventLink[];
  locale: PanelLocale;
  occurredAt: string;
  reference: string;
  status?: string | null;
  summary?: string | null;
};

const copy = {
  lt: {
    documentation: "Šio įvykio informacija",
    documents: "Susiję dokumentai",
    empty:
      "Šis įvykis neturi atskiro failo. Visa jo informacija parodyta šioje kortelėje.",
    eventId: "Audito įvykio ID",
    eventType: "Įvykio tipas",
    occurredAt: "Užregistruota",
    openDocument: "Atidaryti dokumentą",
    openSource: "Atidaryti šaltinio įrašą",
    reference: "Nuoroda",
    status: "Būsena",
    summary: "Įvykio turinys",
    technical: "Techninė informacija",
    technicalHelp:
      "Šaltinio įrašas skirtas sistemos administravimui, o ne dokumento peržiūrai.",
  },
  en: {
    documentation: "Information for this event",
    documents: "Related documents",
    empty:
      "This event has no separate file. All of its information is shown in this card.",
    eventId: "Audit event ID",
    eventType: "Event type",
    occurredAt: "Recorded",
    openDocument: "Open document",
    openSource: "Open source record",
    reference: "Reference",
    status: "Status",
    summary: "Event content",
    technical: "Technical information",
    technicalHelp:
      "The source record is for system administration, not document viewing.",
  },
  nb: {
    documentation: "Informasjon om denne hendelsen",
    documents: "Tilknyttede dokumenter",
    empty:
      "Denne hendelsen har ingen separat fil. All informasjon vises i dette kortet.",
    eventId: "Revisjonshendelse-ID",
    eventType: "Hendelsestype",
    occurredAt: "Registrert",
    openDocument: "Åpne dokument",
    openSource: "Åpne kildepost",
    reference: "Referanse",
    status: "Status",
    summary: "Innhold i hendelsen",
    technical: "Teknisk informasjon",
    technicalHelp:
      "Kildeposten er for systemadministrasjon, ikke dokumentvisning.",
  },
} as const;

export function CaseHistoryEventDetail({
  eventId,
  eventType,
  facts = [],
  links,
  locale,
  occurredAt,
  reference,
  status,
  summary,
}: CaseHistoryEventDetailProps) {
  const labels = copy[locale];
  const visibleFacts = [
    { label: labels.occurredAt, value: occurredAt },
    { label: labels.eventType, value: eventType },
    { label: labels.reference, value: reference },
    { label: labels.status, value: status },
    ...facts,
  ].filter((fact) => fact.value);
  const documentLinks = links.filter((link) => link.kind === "document");
  const sourceLinks = links.filter((link) => link.kind !== "document");

  return (
    <article
      className="grid min-w-0 gap-5 rounded-2xl border border-white/12 bg-black/15 p-4 sm:p-5"
      data-case-history-event={eventId}
      id={`case-history-event-${eventId}`}
    >
      <div>
        <p className="text-accent text-xs font-bold tracking-wider uppercase">
          {labels.documentation}
        </p>
        <p className="text-muted-foreground mt-2 text-xs break-all">
          {labels.eventId}: <span className="text-white/85">{eventId}</span>
        </p>
      </div>

      {visibleFacts.length ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {visibleFacts.map((fact) => (
            <div
              className="min-w-0 rounded-xl border border-white/10 bg-white/[.025] p-3"
              key={`${fact.label}:${fact.value}`}
            >
              <dt className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                {fact.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold break-words">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {summary ? (
        <section className="rounded-xl border border-white/10 bg-white/[.025] p-4">
          <h3 className="text-sm font-bold">{labels.summary}</h3>
          <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-white/80">
            {summary}
          </p>
        </section>
      ) : null}

      <section aria-label={labels.documents} className="grid gap-2">
        {documentLinks.length ? (
          <>
            <h3 className="text-sm font-bold">{labels.documents}</h3>
            {documentLinks.map((link) => (
              <a
                className="focus-visible:outline-accent border-accent/30 bg-accent/8 hover:bg-accent/12 flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 font-bold break-words focus-visible:outline-2 focus-visible:outline-offset-2"
                href={link.href}
                key={`${link.kind}:${link.href}`}
                rel="noreferrer"
                target="_blank"
              >
                <FileText aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">{link.label}</span>
                <span className="sr-only">{labels.openDocument}</span>
                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              </a>
            ))}
          </>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed border-white/15 p-4 text-sm">
            {labels.empty}
          </p>
        )}
      </section>

      {sourceLinks.length ? (
        <details className="group rounded-xl border border-white/10 bg-black/10">
          <summary className="focus-visible:outline-accent flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2">
            <span className="min-w-0 flex-1">{labels.technical}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="grid gap-3 border-t border-white/10 p-4">
            <p className="text-muted-foreground text-sm">
              {labels.technicalHelp}
            </p>
            {sourceLinks.map((link) => (
              <a
                className="focus-visible:outline-accent flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-white/[.035] px-4 py-3 font-bold break-words hover:bg-white/[.07] focus-visible:outline-2 focus-visible:outline-offset-2"
                href={link.href}
                key={`${link.kind || "source"}:${link.href}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">{link.label}</span>
                <span className="sr-only">{labels.openSource}</span>
              </a>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}
