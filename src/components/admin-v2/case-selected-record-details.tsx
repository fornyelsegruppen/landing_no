import type { SelectedCaseRecord } from "@/lib/admin-v2/case-selected-records";
import { getCaseRecordCopy } from "@/lib/admin-v2/case-record-copy";
import { statusLabel } from "@/lib/admin-v2/labels";
import { panelDateLocale, type PanelLocale } from "@/lib/panel-i18n";

/** Read-only historical metadata. Never mounts current-record mutation panels. */
export function CaseSelectedRecordDetails({
  record,
  locale,
}: {
  record: SelectedCaseRecord;
  locale: PanelLocale;
}) {
  const copy = getCaseRecordCopy(locale);
  const date = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(panelDateLocale(locale), {
          dateStyle: "medium",
          timeZone: "Europe/Oslo",
        }).format(new Date(value))
      : undefined;
  const money = (value?: number) =>
    value === undefined
      ? undefined
      : new Intl.NumberFormat(panelDateLocale(locale), {
          style: "currency",
          currency: "NOK",
        }).format(value / 100);
  const facts = [
    [copy.status, statusLabel(locale, record.status)],
    [copy.work, record.workReference],
    [copy.created, date(record.createdAt)],
    ...(record.kind === "invoice"
      ? [
          [copy.subtotal, money(record.subtotalExVatOre)],
          [copy.vat, money(record.vatOre)],
          [copy.total, money(record.totalIncVatOre)],
          [copy.issued, date(record.issuedAt)],
          [copy.due, date(record.dueAt)],
          [copy.external, record.externalReference],
          [copy.note, record.adminNote],
        ]
      : [
          [copy.scope, record.scope],
          [copy.starts, date(record.startsAt)],
          [copy.ends, date(record.endsAt)],
          [copy.terms, record.termsVersion],
        ]),
  ];
  return (
    <section
      className="min-w-0 rounded-2xl border border-white/10 p-4"
      id={`${record.kind}-${record.id}`}
      data-selected-case-record={`${record.kind}-${record.id}`}
    >
      <p className="text-accent text-xs font-bold">{copy.readOnly}</p>
      <h3 className="mt-2 text-lg font-bold break-words">
        {copy[record.kind]} · {record.reference}
      </h3>
      <dl className="mt-4 grid gap-3">
        {facts
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="text-sm break-words whitespace-pre-wrap">
                {value}
              </dd>
            </div>
          ))}
      </dl>
      {record.documentId ? (
        <a
          className="text-accent mt-4 inline-flex min-h-11 items-center underline"
          href={`/api/admin/media/${record.documentId}`}
          target="_blank"
          rel="noreferrer"
        >
          PDF
        </a>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">{copy.noPdf}</p>
      )}
    </section>
  );
}
