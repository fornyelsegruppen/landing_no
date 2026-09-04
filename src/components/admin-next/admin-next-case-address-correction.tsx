"use client";

import { CheckCircle2, PencilLine, RotateCcw, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  AddressCorrectionReviewAndCommit,
  type AddressCorrectionCommitResult,
  type AddressCorrectionInvalidation,
} from "./review-and-commit";

export type AdminNextCaseAddress = Readonly<{
  street: string;
  houseNumber: string | null;
  postalCode: string;
  city: string | null;
}>;

export type AdminNextCaseAddressCorrectionConfig = Readonly<{
  caseId: number;
  currentAddress: AdminNextCaseAddress;
  expectedAddressRevision: number;
  expectedCaseRevision: number;
}>;

type AddressReasonCode =
  | "operator_correction"
  | "customer_confirmation"
  | "provider_resolution"
  | "data_quality_recovery";

type AddressDraft = {
  city: string;
  houseNumber: string;
  postalCode: string;
  reasonCode: AddressReasonCode;
  street: string;
};

type AddressCommandResponse = {
  status: "applied" | "replayed";
  case: { caseRevision: number; addressRevision: number };
  address: AdminNextCaseAddress;
};

const reasonCodes: readonly AddressReasonCode[] = [
  "operator_correction",
  "customer_confirmation",
  "provider_resolution",
  "data_quality_recovery",
];

const copy = {
  nb: {
    open: "Rett saksadressen",
    title: "Korriger canonical saksadresse",
    description:
      "Registrer ny adresse og begrunnelse. Ingen endring lagres før ReviewAndCommit er bekreftet.",
    street: "Gateadresse",
    houseNumber: "Husnummer",
    postalCode: "Postnummer",
    city: "Sted",
    reason: "Begrunnelse",
    reasons: {
      operator_correction: "Operatør korrigerer feilregistrering",
      customer_confirmation: "Kunden har bekreftet adressen",
      provider_resolution: "Leverandørdata er avklart",
      data_quality_recovery: "Gjenoppretting etter datakvalitetsfeil",
    },
    review: "Kontroller konsekvensene",
    cancel: "Avbryt",
    invalid: "Fyll ut gateadresse, fire sifre i postnummeret og sted.",
    unchanged: "Den nye adressen må være forskjellig fra gjeldende adresse.",
    confirmation: (reference: string) => `CORRECT ${reference}`,
    sourceLabel: "Adressebundne RF-kilder",
    sourceReason:
      "Ortofoto, DOM/DTM og valgt bygning er hentet for den tidligere adressen.",
    draftLabel: "Ikke-godkjente RF-utkast",
    draftReason:
      "Geometri, annotasjoner og resultatutkast er avledet fra de utdaterte kildene.",
    success: "Adressen er lagret. Last saken på nytt før videre arbeid.",
    reload: "Last saken på nytt",
    failed: "Adressekorrigeringen ble ikke lagret.",
    conflict: "Saken ble endret etter at denne visningen ble lastet.",
  },
  lt: {
    open: "Taisyti bylos adresą",
    title: "Koreguoti canonical bylos adresą",
    description:
      "Įveskite naują adresą ir priežastį. Pakeitimas nebus išsaugotas, kol nepatvirtinsite ReviewAndCommit.",
    street: "Gatvė",
    houseNumber: "Namo numeris",
    postalCode: "Pašto kodas",
    city: "Miestas",
    reason: "Priežastis",
    reasons: {
      operator_correction: "Operatorius taiso neteisingą įrašą",
      customer_confirmation: "Klientas patvirtino adresą",
      provider_resolution: "Išspręstas tiekėjo duomenų neatitikimas",
      data_quality_recovery: "Atkūrimas po duomenų kokybės klaidos",
    },
    review: "Peržiūrėti pasekmes",
    cancel: "Atšaukti",
    invalid: "Įveskite gatvę, keturių skaitmenų pašto kodą ir miestą.",
    unchanged: "Naujas adresas turi skirtis nuo dabartinio.",
    confirmation: (reference: string) => `CORRECT ${reference}`,
    sourceLabel: "Su adresu susieti RF šaltiniai",
    sourceReason:
      "Ortofoto, DOM/DTM ir pasirinktas pastatas gauti ankstesniam adresui.",
    draftLabel: "Nepatvirtinti RF juodraščiai",
    draftReason:
      "Geometrija, anotacijos ir rezultato juodraščiai išvesti iš pasenusių šaltinių.",
    success: "Adresas išsaugotas. Prieš tęsdami darbą iš naujo įkelkite bylą.",
    reload: "Iš naujo įkelti bylą",
    failed: "Adreso koregavimo išsaugoti nepavyko.",
    conflict: "Byla pasikeitė po šio ekrano įkėlimo.",
  },
  en: {
    open: "Correct case address",
    title: "Correct canonical case address",
    description:
      "Enter the new address and reason. Nothing is saved until ReviewAndCommit is confirmed.",
    street: "Street",
    houseNumber: "House number",
    postalCode: "Postal code",
    city: "City",
    reason: "Reason",
    reasons: {
      operator_correction: "Operator correction of a recorded error",
      customer_confirmation: "Address confirmed by the customer",
      provider_resolution: "Provider data discrepancy resolved",
      data_quality_recovery: "Recovery from a data quality error",
    },
    review: "Review consequences",
    cancel: "Cancel",
    invalid: "Enter a street, four-digit postal code and city.",
    unchanged: "The new address must differ from the current address.",
    confirmation: (reference: string) => `CORRECT ${reference}`,
    sourceLabel: "Address-bound RF sources",
    sourceReason:
      "Orthophoto, DOM/DTM and the building selection were obtained for the previous address.",
    draftLabel: "Unapproved RF drafts",
    draftReason:
      "Geometry, annotations and result drafts derive from the stale sources.",
    success: "The address was saved. Reload the case before continuing work.",
    reload: "Reload case",
    failed: "The address correction was not saved.",
    conflict: "The case changed after this view was loaded.",
  },
} as const;

function displayAddress(address: AdminNextCaseAddress) {
  return [
    [address.street, address.houseNumber].filter(Boolean).join(" "),
    [address.postalCode, address.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function draftAddress(draft: AddressDraft): AdminNextCaseAddress {
  return {
    city: draft.city.trim() || null,
    houseNumber: draft.houseNumber.trim() || null,
    postalCode: draft.postalCode.trim(),
    street: draft.street.trim(),
  };
}

function initialDraft(address: AdminNextCaseAddress): AddressDraft {
  return {
    city: address.city || "",
    houseNumber: address.houseNumber || "",
    postalCode: address.postalCode,
    reasonCode: "operator_correction",
    street: address.street,
  };
}

function commandFailureMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

export function AdminNextCaseAddressCorrection({
  caseReference,
  config,
  locale,
}: {
  caseReference: string;
  config: AdminNextCaseAddressCorrectionConfig;
  locale: PanelLocale;
}) {
  const t = copy[locale];
  const titleId = useId();
  const [draft, setDraft] = useState(() => initialDraft(config.currentAddress));
  const [editing, setEditing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [saved, setSaved] = useState(false);
  const after = draftAddress(draft);
  const beforeLabel = displayAddress(config.currentAddress);
  const afterLabel = displayAddress(after);
  const invalidations: readonly AddressCorrectionInvalidation[] = [
    {
      id: `case:${config.caseId}:rf-sources`,
      kind: "rf_source",
      label: t.sourceLabel,
      reason: t.sourceReason,
    },
    {
      id: `case:${config.caseId}:rf-drafts`,
      kind: "draft",
      label: t.draftLabel,
      reason: t.draftReason,
    },
  ];

  const openReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valid =
      after.street.length >= 2 &&
      /^\d{4}$/u.test(after.postalCode) &&
      Boolean(after.city && after.city.length >= 2);
    if (!valid) {
      setValidationMessage(t.invalid);
      return;
    }
    if (beforeLabel === afterLabel) {
      setValidationMessage(t.unchanged);
      return;
    }
    setValidationMessage(null);
    setIdempotencyKey(
      `address:${config.caseId}:r${config.expectedAddressRevision}:${crypto.randomUUID().replaceAll("-", "")}`,
    );
    setReviewOpen(true);
  };

  const commit = async (): Promise<AddressCorrectionCommitResult> => {
    let response: Response;
    try {
      response = await fetch(`/api/admin/cases/${config.caseId}/address`, {
        body: JSON.stringify({
          address: after,
          expectedAddressRevision: config.expectedAddressRevision,
          expectedCaseRevision: config.expectedCaseRevision,
          idempotencyKey,
          reasonCode: draft.reasonCode,
        }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
    } catch {
      return { kind: "error", message: t.failed, retryable: true };
    }

    const body = (await response.json().catch(() => null)) as unknown;
    if (response.ok) {
      const result = body as AddressCommandResponse;
      return {
        address: displayAddress(result.address),
        caseRevision: result.case.caseRevision,
        kind: "success",
      };
    }
    if (response.status === 409) {
      const conflict = body as { actualRevision?: unknown } | null;
      return {
        currentRevision:
          typeof conflict?.actualRevision === "number"
            ? conflict.actualRevision
            : config.expectedCaseRevision,
        kind: "conflict",
        message: t.conflict,
      };
    }
    return {
      correlationId: response.headers.get("x-correlation-id") || undefined,
      kind: "error",
      message: commandFailureMessage(body, t.failed),
      retryable:
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500,
    };
  };

  if (saved && !reviewOpen) {
    return (
      <div
        className="rounded-xl border border-[var(--an-success)] bg-[var(--an-success-soft)] p-3 text-xs text-[var(--an-text)]"
        data-address-correction-applied
        role="status"
      >
        <p className="flex items-start gap-2">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-[var(--an-success)]"
          />
          <span>{t.success}</span>
        </p>
        <button
          className="mt-2 min-h-11 rounded-xl border border-[var(--an-success)] px-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
          onClick={() => window.location.reload()}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="mr-1 inline size-4" />
          {t.reload}
        </button>
      </div>
    );
  }

  return (
    <div
      className={editing ? "w-full sm:basis-full" : undefined}
      data-address-correction-control
    >
      {!editing ? (
        <button
          aria-expanded="false"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--an-action)] px-3 text-xs font-bold text-[var(--an-action)] hover:bg-[var(--an-action-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
          onClick={() => setEditing(true)}
          type="button"
        >
          <PencilLine aria-hidden="true" className="size-4" />
          {t.open}
        </button>
      ) : (
        <form
          aria-labelledby={titleId}
          className="min-w-0 rounded-2xl border border-[var(--an-border-strong)] bg-[var(--an-surface-raised)] p-3"
          data-address-correction-form
          onSubmit={openReview}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                className="text-sm font-bold text-[var(--an-text)]"
                id={titleId}
              >
                {t.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--an-muted)]">
                {t.description}
              </p>
            </div>
            <button
              aria-label={t.cancel}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--an-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--an-focus-ring)]"
              onClick={() => {
                setDraft(initialDraft(config.currentAddress));
                setEditing(false);
                setValidationMessage(null);
              }}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(7rem,1fr)]">
            <label className="grid gap-1 text-xs font-bold text-[var(--an-muted)]">
              {t.street}
              <input
                autoComplete="address-line1"
                className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] px-3 text-sm text-[var(--an-text)] outline-none focus-visible:border-[var(--an-action)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
                name="street"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    street: event.target.value,
                  }))
                }
                required
                value={draft.street}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--an-muted)]">
              {t.houseNumber}
              <input
                autoComplete="address-line2"
                className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] px-3 text-sm text-[var(--an-text)] outline-none focus-visible:border-[var(--an-action)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
                maxLength={30}
                name="houseNumber"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    houseNumber: event.target.value,
                  }))
                }
                value={draft.houseNumber}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--an-muted)]">
              {t.postalCode}
              <input
                autoComplete="postal-code"
                className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] px-3 text-sm text-[var(--an-text)] outline-none focus-visible:border-[var(--an-action)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
                inputMode="numeric"
                maxLength={4}
                name="postalCode"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    postalCode: event.target.value,
                  }))
                }
                pattern="[0-9]{4}"
                required
                value={draft.postalCode}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--an-muted)]">
              {t.city}
              <input
                autoComplete="address-level2"
                className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] px-3 text-sm text-[var(--an-text)] outline-none focus-visible:border-[var(--an-action)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
                name="city"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                required
                value={draft.city}
              />
            </label>
          </div>
          <label className="mt-3 grid gap-1 text-xs font-bold text-[var(--an-muted)]">
            {t.reason}
            <select
              className="min-h-11 min-w-0 rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] px-3 text-sm text-[var(--an-text)] outline-none focus-visible:border-[var(--an-action)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus-ring)]"
              name="reasonCode"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reasonCode: event.target.value as AddressReasonCode,
                }))
              }
              value={draft.reasonCode}
            >
              {reasonCodes.map((reason) => (
                <option key={reason} value={reason}>
                  {t.reasons[reason]}
                </option>
              ))}
            </select>
          </label>
          {validationMessage ? (
            <p
              className="mt-3 text-xs font-semibold text-[var(--an-danger)]"
              role="alert"
            >
              {validationMessage}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-xl border border-[var(--an-border)] px-3 text-xs font-bold"
              onClick={() => {
                setDraft(initialDraft(config.currentAddress));
                setEditing(false);
                setValidationMessage(null);
              }}
              type="button"
            >
              {t.cancel}
            </button>
            <button
              className="min-h-11 rounded-xl bg-[var(--an-action)] px-3 text-xs font-bold text-[var(--an-action-text)]"
              type="submit"
            >
              {t.review}
            </button>
          </div>
        </form>
      )}

      {idempotencyKey ? (
        <AddressCorrectionReviewAndCommit
          afterAddress={afterLabel}
          beforeAddress={beforeLabel}
          caseId={String(config.caseId)}
          caseReference={caseReference}
          confirmationPhrase={t.confirmation(caseReference)}
          expectedRevision={config.expectedCaseRevision}
          idempotencyKey={idempotencyKey}
          invalidations={invalidations}
          locale={locale}
          onCommit={commit}
          onOpenChange={setReviewOpen}
          onResult={(result) => {
            if (result.kind === "success") setSaved(true);
          }}
          open={reviewOpen}
          reason={t.reasons[draft.reasonCode]}
        />
      ) : null}
    </div>
  );
}
