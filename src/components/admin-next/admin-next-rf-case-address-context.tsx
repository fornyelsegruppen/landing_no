import Link from "next/link";
import {
  ChevronDown,
  LockKeyhole,
  MapPin,
  PencilLine,
  TriangleAlert,
} from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  AdminNextCaseAddressCorrection,
  type AdminNextCaseAddressCorrectionConfig,
} from "./admin-next-case-address-correction";

const copy = {
  nb: {
    title: "Saksadresse",
    authoritative: "Låst målekontekst",
    edit: "Rett saksadressen",
    unavailable: "Adresseendring krever sikker saksflyt",
    binding: "Binding",
    consequences: "Konsekvenser ved adresseendring",
    warning:
      "Tidligere ortofoto, DOM/DTM, valgt bygning, geometri, annotasjoner og ikke-godkjent resultat blir utdaterte. Historikken slettes ikke; en ny saks- og målerevisjon må hente kildene på nytt.",
    boundary:
      "Denne RF-visningen endrer ikke adressen. Endringen skal kontrolleres og loggføres i sakens ReviewAndCommit.",
  },
  lt: {
    title: "Bylos adresas",
    authoritative: "Užrakintas matavimo kontekstas",
    edit: "Taisyti bylos adresą",
    unavailable: "Adreso keitimui reikalingas saugus bylos procesas",
    binding: "Susiejimas",
    consequences: "Adreso pakeitimo pasekmės",
    warning:
      "Ankstesnis ortofoto, DOM/DTM, pasirinktas pastatas, geometrija, anotacijos ir nepatvirtintas rezultatas taps pasenę. Istorija nebus ištrinta; nauja bylos ir matavimo revizija turės iš naujo gauti šaltinius.",
    boundary:
      "Ši RF peržiūra adreso nekeičia. Pakeitimas turi būti peržiūrėtas ir audituotas bylos ReviewAndCommit lange.",
  },
  en: {
    title: "Case address",
    authoritative: "Locked measurement context",
    edit: "Correct case address",
    unavailable: "Address correction requires the safe case workflow",
    binding: "Binding",
    consequences: "Consequences of changing the address",
    warning:
      "The previous orthophoto, DOM/DTM, selected building, geometry, annotations and unapproved result become stale. History is preserved; a new case and measurement revision must obtain the sources again.",
    boundary:
      "This RF view does not change the address. The correction must be reviewed and audited in the case ReviewAndCommit flow.",
  },
} as const;

export function AdminNextRfCaseAddressContext({
  address,
  addressCorrection,
  caseReference,
  caseRevision,
  editHref,
  locale,
  measurementRevision,
}: {
  address: string;
  addressCorrection?: AdminNextCaseAddressCorrectionConfig;
  caseReference: string;
  caseRevision?: number;
  editHref?: string;
  locale: PanelLocale;
  measurementRevision?: number;
}) {
  const t = copy[locale];
  const binding = [
    caseReference,
    caseRevision ? `case r${caseRevision}` : null,
    measurementRevision ? `RF r${measurementRevision}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className="mt-4 rounded-2xl border border-[var(--an-border-strong)] bg-[var(--an-surface-base)] p-3"
      data-rf-address-context="case_authoritative"
      data-rf-free-address-input="forbidden"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--an-action-soft)] text-[var(--an-action)]">
            <MapPin aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[var(--an-muted)] uppercase">
              {t.title}
              <LockKeyhole aria-hidden="true" className="size-3.5" />
              {t.authoritative}
            </p>
            <strong className="mt-1 block text-sm break-words text-[var(--an-text)]">
              {address || "—"}
            </strong>
            <p className="mt-1 text-[10px] text-[var(--an-subtle)]">
              {t.binding}: {binding}
            </p>
          </div>
        </div>
        {addressCorrection ? (
          <AdminNextCaseAddressCorrection
            caseReference={caseReference}
            config={addressCorrection}
            locale={locale}
          />
        ) : editHref ? (
          <Link
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--an-action)] px-3 text-xs font-bold text-[var(--an-action)] hover:bg-[var(--an-action-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
            href={editHref}
          >
            <PencilLine aria-hidden="true" className="size-4" />
            {t.edit}
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-xl border border-[var(--an-border)] px-3 text-xs font-bold text-[var(--an-subtle)]">
            {t.unavailable}
          </span>
        )}
      </div>
      <details className="group mt-3 border-t border-[var(--an-border)] pt-2">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-[var(--an-danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]">
          <span className="flex items-center gap-2">
            <TriangleAlert aria-hidden="true" className="size-4" />
            {t.consequences}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="rounded-xl border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-3 text-xs leading-5 text-[var(--an-muted)]">
          <p>{t.warning}</p>
          <p className="mt-2 font-semibold text-[var(--an-text)]">
            {t.boundary}
          </p>
        </div>
      </details>
    </section>
  );
}
