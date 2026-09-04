"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileWarning,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";
import {
  AdminAsyncFeedback,
  type AdminAsyncState,
} from "./admin-async-feedback";
import { AdminOverlay } from "./admin-overlay";

export type ReviewRisk = "routine" | "material" | "destructive";

export function reviewRequiresAcknowledgement(risk: ReviewRisk) {
  return risk !== "routine";
}

export function claimReviewCommitAttempt(
  attempt: { current: string | null },
  idempotencyKey: string,
) {
  if (attempt.current === idempotencyKey) return false;
  attempt.current = idempotencyKey;
  return true;
}

export type ReviewPreflightItem = {
  id: string;
  label: string;
  detail: string;
  state: "pass" | "warning" | "blocked";
};

export type ReviewTypedConfirmation = {
  expectedValue: string;
  label: string;
  hint: string;
};

export function ReviewAndCommit({
  acknowledgement,
  changes,
  children,
  commitLabel,
  description,
  feedbackCorrelationId,
  feedbackDelayMs = 0,
  feedbackMessage,
  feedbackRetryIsSafe = false,
  idempotencyKey,
  locale = "lt",
  onCommit,
  onOpenChange,
  open,
  postCommitState,
  preflight,
  risk = "routine",
  state = "idle",
  title,
  typedConfirmation,
  untouched,
}: {
  acknowledgement?: string;
  changes: readonly string[];
  children?: ReactNode;
  commitLabel: string;
  description: string;
  feedbackCorrelationId?: string;
  feedbackDelayMs?: number;
  feedbackMessage?: string;
  feedbackRetryIsSafe?: boolean;
  idempotencyKey: string;
  locale?: PanelLocale;
  onCommit: (typedConfirmation: string | null) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  postCommitState: string;
  preflight: readonly ReviewPreflightItem[];
  risk?: ReviewRisk;
  state?: AdminAsyncState;
  title: string;
  typedConfirmation?: ReviewTypedConfirmation;
  untouched: readonly string[];
}) {
  const copy = {
    nb: {
      back: "Gå tilbake og rediger",
      preflight: "Automatisk kontroll",
      changes: "Dette endres",
      untouched: "Dette gjøres ikke",
      postState: "Status etter handlingen",
      idempotency: "Idempotens",
      acknowledgement:
        "Jeg forstår den beskrevne konsekvensen og godkjenner denne konkrete handlingen.",
    },
    lt: {
      back: "Grįžti ir koreguoti",
      preflight: "Automatinė patikra",
      changes: "Kas pasikeis",
      untouched: "Kas nebus padaryta",
      postState: "Būsena po veiksmo",
      idempotency: "Idempotency",
      acknowledgement:
        "Suprantu nurodytą pasekmę ir patvirtinu šį konkretų veiksmą.",
    },
    en: {
      back: "Go back and edit",
      preflight: "Automatic checks",
      changes: "What will change",
      untouched: "What will not happen",
      postState: "State after the action",
      idempotency: "Idempotency",
      acknowledgement:
        "I understand the described consequence and approve this specific action.",
    },
  }[locale];
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState("");
  const commitAttempt = useRef<string | null>(null);
  const confirmationId = useId();
  const confirmationHintId = useId();
  const requiresAck =
    reviewRequiresAcknowledgement(risk) || Boolean(typedConfirmation);
  const blocked = preflight.some((item) => item.state === "blocked");
  const pending = state === "pending";
  const confirmed = typedConfirmation
    ? confirmationValue === typedConfirmation.expectedValue
    : acknowledged;
  const commitDisabled = blocked || pending || (requiresAck && !confirmed);
  const commit = () => {
    if (
      commitDisabled ||
      !claimReviewCommitAttempt(commitAttempt, idempotencyKey)
    ) {
      return;
    }
    let result: void | Promise<void>;
    try {
      result = onCommit(typedConfirmation ? confirmationValue : null);
    } catch (error) {
      commitAttempt.current = null;
      throw error;
    }
    void Promise.resolve(result).catch(() => {
      commitAttempt.current = null;
    });
  };

  return (
    <AdminOverlay
      description={description}
      locale={locale}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setAcknowledged(false);
          setConfirmationValue("");
          commitAttempt.current = null;
        }
        onOpenChange(nextOpen);
      }}
      open={open}
      title={title}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            className="min-h-11 rounded-xl border border-[var(--an-border)] px-4 text-sm font-bold text-[var(--an-text-muted)] hover:bg-[var(--an-surface-soft)]"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            {copy.back}
          </button>
          <button
            className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45 ${risk === "destructive" ? "bg-[var(--an-danger)] text-black" : "bg-[var(--an-action)] text-[var(--an-action-ink)] hover:bg-[var(--an-action-hover)]"}`}
            disabled={commitDisabled}
            onClick={commit}
            type="button"
          >
            {commitLabel}
          </button>
        </div>
      }
    >
      {children}
      <section aria-labelledby="review-preflight-title">
        <h3
          className="text-xs font-bold tracking-[.16em] text-[var(--an-text-subtle)] uppercase"
          id="review-preflight-title"
        >
          {copy.preflight}
        </h3>
        <ul className="mt-3 grid gap-2">
          {preflight.map((item) => {
            const Icon = item.state === "pass" ? CheckCircle2 : AlertTriangle;
            const tone =
              item.state === "pass"
                ? "text-[var(--an-success)]"
                : item.state === "blocked"
                  ? "text-[var(--an-danger)]"
                  : "text-[var(--an-info)]";
            return (
              <li
                className="flex items-start gap-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3"
                key={item.id}
              >
                <Icon
                  aria-hidden="true"
                  className={`mt-0.5 size-5 shrink-0 ${tone}`}
                />
                <span>
                  <strong className="block text-sm">{item.label}</strong>
                  <small className="mt-0.5 block text-[var(--an-text-muted)]">
                    {item.detail}
                  </small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <section
          className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-4"
          aria-labelledby="review-changes-title"
        >
          <h3
            className="flex items-center gap-2 text-sm font-bold"
            id="review-changes-title"
          >
            <ArrowRight
              aria-hidden="true"
              className="size-4 text-[var(--an-action)]"
            />
            {copy.changes}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--an-text-muted)]">
            {changes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section
          className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-4"
          aria-labelledby="review-untouched-title"
        >
          <h3
            className="flex items-center gap-2 text-sm font-bold"
            id="review-untouched-title"
          >
            <ShieldCheck
              aria-hidden="true"
              className="size-4 text-[var(--an-info)]"
            />
            {copy.untouched}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--an-text-muted)]">
            {untouched.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-4 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-3 text-sm text-[var(--an-text-muted)]">
        <strong className="text-[var(--an-text-primary)]">
          {copy.postState}:
        </strong>{" "}
        {postCommitState}
        <br />
        <small>
          {copy.idempotency}: {idempotencyKey}
        </small>
      </p>

      {typedConfirmation ? (
        <section
          className={`mt-4 rounded-xl border p-4 ${risk === "destructive" ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)]" : "border-[var(--an-info)] bg-[var(--an-info-soft)]"}`}
          data-review-typed-confirmation
        >
          <label
            className="block text-sm font-bold text-[var(--an-text-primary)]"
            htmlFor={confirmationId}
          >
            {typedConfirmation.label}
          </label>
          <p
            className="mt-1 text-xs leading-relaxed text-[var(--an-text-muted)]"
            id={confirmationHintId}
          >
            {typedConfirmation.hint}
          </p>
          <input
            aria-describedby={confirmationHintId}
            autoComplete="off"
            className="mt-3 min-h-11 w-full rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-canvas)] px-3 font-mono text-sm text-[var(--an-text-primary)] outline-none focus-visible:border-[var(--an-action)] focus-visible:ring-2 focus-visible:ring-[var(--an-focus)]"
            disabled={pending}
            id={confirmationId}
            onChange={(event) => setConfirmationValue(event.target.value)}
            spellCheck={false}
            value={confirmationValue}
          />
        </section>
      ) : requiresAck ? (
        <label
          className={`mt-4 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm ${risk === "destructive" ? "border-[var(--an-danger)] bg-[var(--an-danger-soft)]" : "border-[var(--an-info)] bg-[var(--an-info-soft)]"}`}
        >
          <input
            className="mt-1 size-4 shrink-0 accent-[var(--an-action)]"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            type="checkbox"
          />
          <span>{acknowledgement || copy.acknowledgement}</span>
        </label>
      ) : null}

      {state !== "idle" ? (
        <div className="mt-4">
          <AdminAsyncFeedback
            action={commitLabel}
            correlationId={feedbackCorrelationId}
            delayMs={state === "pending" ? feedbackDelayMs : 0}
            locale={locale}
            message={feedbackMessage}
            onRetry={feedbackRetryIsSafe ? commit : undefined}
            retryIsSafe={feedbackRetryIsSafe && Boolean(idempotencyKey)}
            state={state}
          />
        </div>
      ) : null}
    </AdminOverlay>
  );
}

export type AddressCorrectionInvalidation = {
  id: string;
  kind: "rf_source" | "draft";
  label: string;
  reason: string;
};

export type AddressCorrectionCommitInput = {
  caseId: string;
  caseReference: string;
  expectedRevision: number;
  beforeAddress: string;
  afterAddress: string;
  reason: string;
  invalidations: readonly AddressCorrectionInvalidation[];
  confirmation: string;
  idempotencyKey: string;
};

export type AddressCorrectionCommitResult =
  | {
      kind: "success";
      address: string;
      caseRevision: number;
      message?: string;
    }
  | {
      kind: "conflict";
      currentAddress?: string;
      currentRevision: number;
      message: string;
    }
  | {
      kind: "error";
      correlationId?: string;
      message: string;
      retryable: boolean;
    };

type AddressCorrectionUiState = AdminAsyncState | "conflict";

const addressCorrectionCopy = {
  nb: {
    title: "Bekreft adressekorrigering",
    description:
      "Kontroller den canonical adressen og alle avledede Roof Fusion-data før du lagrer.",
    before: "Før",
    after: "Etter",
    reason: "Begrunnelse",
    invalidations: "Dette blir ugyldiggjort",
    invalidationsIntro:
      "Disse RF-kildene og utkastene kan ikke gjenbrukes etter adresseendringen.",
    noInvalidations: "Ingen RF-kilder eller utkast er knyttet til adressen.",
    invalidationKinds: { rf_source: "RF-kilde", draft: "Utkast" },
    confirmationLabel: "Skriv bekreftelsesfrasen",
    confirmationHint: (phrase: string) =>
      `Skriv nøyaktig «${phrase}» for å aktivere lagring.`,
    commit: "Korriger adresse",
    changedAddress: "Den canonical saksadressen blir erstattet.",
    invalidatedDependants:
      "Oppførte RF-kilder og utkast blir ugyldiggjort atomisk.",
    untouched: ["Ingen ny RF-beregning startes.", "Ingen kundemelding sendes."],
    postIdle:
      "Adressen lagres og oppførte avledede data ugyldiggjøres i én kommando.",
    postSuccess: (revision: number) =>
      `Adressen er korrigert i saksrevisjon ${revision}.`,
    postConflict: "Ingen endring ble lagret. Last inn saken på nytt.",
    postError: "Ingen endring er bekreftet lagret.",
    success: "Adressekorrigeringen er lagret.",
    requestFailed:
      "Adressekorrigeringen kunne ikke bekreftes. Ingen vellykket lagring antas.",
    conflict: (
      message: string,
      address: string | undefined,
      revision: number,
    ) =>
      address
        ? `${message} Gjeldende adresse er «${address}» i revisjon ${revision}.`
        : `${message} Gjeldende revisjon er ${revision}.`,
    caseCheck: "Sak og forventet revisjon",
    caseCheckDetail: (reference: string, revision: number) =>
      `${reference} · forventet revisjon ${revision}`,
    addressCheck: "Ny adresse er forskjellig",
    addressChanged: "Før- og etterverdiene er forskjellige.",
    addressUnchanged: "Ny adresse må være forskjellig fra gjeldende adresse.",
    reasonCheck: "Begrunnelse er registrert",
    reasonPresent: "Begrunnelsen følger kommandoen og audit-sporet.",
    reasonMissing: "En begrunnelse er påkrevd.",
    impactCheck: "Avledet RF-virkning",
    impactFound: (count: number) =>
      `${count} avledede elementer blir ugyldiggjort.`,
    impactEmpty: "Ingen avledede elementer er funnet.",
  },
  lt: {
    title: "Patvirtinti adreso koregavimą",
    description:
      "Prieš išsaugodami patikrinkite canonical adresą ir visus išvestinius Roof Fusion duomenis.",
    before: "Prieš",
    after: "Po",
    reason: "Priežastis",
    invalidations: "Kas bus invaliduota",
    invalidationsIntro:
      "Pakeitus adresą šių RF šaltinių ir juodraščių pakartotinai naudoti negalima.",
    noInvalidations: "Su adresu nesusietas joks RF šaltinis ar juodraštis.",
    invalidationKinds: { rf_source: "RF šaltinis", draft: "Juodraštis" },
    confirmationLabel: "Įveskite patvirtinimo frazę",
    confirmationHint: (phrase: string) =>
      `Norėdami įjungti išsaugojimą, tiksliai įveskite „${phrase}“.`,
    commit: "Koreguoti adresą",
    changedAddress: "Canonical bylos adresas bus pakeistas.",
    invalidatedDependants:
      "Nurodyti RF šaltiniai ir juodraščiai bus invaliduoti atominiu būdu.",
    untouched: [
      "Naujas RF skaičiavimas nebus paleistas.",
      "Klientui nebus išsiųsta žinutė.",
    ],
    postIdle:
      "Adresas bus išsaugotas, o nurodyti išvestiniai duomenys invaliduoti viena komanda.",
    postSuccess: (revision: number) =>
      `Adresas pakoreguotas bylos revizijoje ${revision}.`,
    postConflict: "Pakeitimas neišsaugotas. Iš naujo įkelkite bylą.",
    postError: "Pakeitimas nėra patvirtintas kaip išsaugotas.",
    success: "Adreso koregavimas išsaugotas.",
    requestFailed:
      "Adreso koregavimo nepavyko patvirtinti. Sėkmingas išsaugojimas nėra numanomas.",
    conflict: (
      message: string,
      address: string | undefined,
      revision: number,
    ) =>
      address
        ? `${message} Dabartinis adresas yra „${address}“, revizija ${revision}.`
        : `${message} Dabartinė revizija yra ${revision}.`,
    caseCheck: "Byla ir laukiama revizija",
    caseCheckDetail: (reference: string, revision: number) =>
      `${reference} · laukiama revizija ${revision}`,
    addressCheck: "Naujas adresas skiriasi",
    addressChanged: "Prieš ir po reikšmės yra skirtingos.",
    addressUnchanged: "Naujas adresas turi skirtis nuo dabartinio.",
    reasonCheck: "Priežastis užfiksuota",
    reasonPresent: "Priežastis bus perduota komandai ir audito įrašui.",
    reasonMissing: "Priežastis yra privaloma.",
    impactCheck: "Išvestinių RF duomenų poveikis",
    impactFound: (count: number) =>
      `Bus invaliduota išvestinių elementų: ${count}.`,
    impactEmpty: "Išvestinių elementų nerasta.",
  },
  en: {
    title: "Confirm address correction",
    description:
      "Review the canonical address and every derived Roof Fusion asset before saving.",
    before: "Before",
    after: "After",
    reason: "Reason",
    invalidations: "What will be invalidated",
    invalidationsIntro:
      "These RF sources and drafts cannot be reused after the address changes.",
    noInvalidations: "No RF source or draft is linked to the address.",
    invalidationKinds: { rf_source: "RF source", draft: "Draft" },
    confirmationLabel: "Type the confirmation phrase",
    confirmationHint: (phrase: string) =>
      `Type “${phrase}” exactly to enable saving.`,
    commit: "Correct address",
    changedAddress: "The canonical case address will be replaced.",
    invalidatedDependants:
      "The listed RF sources and drafts will be invalidated atomically.",
    untouched: [
      "No new RF calculation will start.",
      "No customer message will be sent.",
    ],
    postIdle:
      "The address will be saved and the listed derived data invalidated in one command.",
    postSuccess: (revision: number) =>
      `The address was corrected at case revision ${revision}.`,
    postConflict: "No change was saved. Reload the case.",
    postError: "No change is confirmed as saved.",
    success: "Address correction saved.",
    requestFailed:
      "The address correction could not be confirmed. No successful save is assumed.",
    conflict: (
      message: string,
      address: string | undefined,
      revision: number,
    ) =>
      address
        ? `${message} The current address is “${address}” at revision ${revision}.`
        : `${message} The current revision is ${revision}.`,
    caseCheck: "Case and expected revision",
    caseCheckDetail: (reference: string, revision: number) =>
      `${reference} · expected revision ${revision}`,
    addressCheck: "New address is different",
    addressChanged: "The before and after values differ.",
    addressUnchanged: "The new address must differ from the current address.",
    reasonCheck: "Reason recorded",
    reasonPresent: "The reason will be sent to the command and audit record.",
    reasonMissing: "A reason is required.",
    impactCheck: "Derived RF impact",
    impactFound: (count: number) =>
      `${count} derived assets will be invalidated.`,
    impactEmpty: "No derived assets were found.",
  },
} as const;

export function AddressCorrectionReviewAndCommit({
  afterAddress,
  beforeAddress,
  caseId,
  caseReference,
  confirmationPhrase,
  expectedRevision,
  idempotencyKey,
  invalidations,
  locale = "lt",
  onCommit,
  onOpenChange,
  onResult,
  open,
  reason,
}: {
  afterAddress: string;
  beforeAddress: string;
  caseId: string;
  caseReference: string;
  confirmationPhrase: string;
  expectedRevision: number;
  idempotencyKey: string;
  invalidations: readonly AddressCorrectionInvalidation[];
  locale?: PanelLocale;
  onCommit: (
    input: AddressCorrectionCommitInput,
  ) => Promise<AddressCorrectionCommitResult>;
  onOpenChange: (open: boolean) => void;
  onResult?: (result: AddressCorrectionCommitResult) => void;
  open: boolean;
  reason: string;
}) {
  const t = addressCorrectionCopy[locale];
  const comparisonTitleId = useId();
  const invalidationsTitleId = useId();
  const [result, setResult] = useState<AddressCorrectionCommitResult | null>(
    null,
  );
  const [uiState, setUiState] = useState<AddressCorrectionUiState>("idle");

  const validCaseBinding =
    Boolean(caseId.trim()) &&
    Boolean(caseReference.trim()) &&
    Number.isInteger(expectedRevision) &&
    expectedRevision > 0;
  const addressChanged =
    Boolean(afterAddress.trim()) &&
    beforeAddress.trim() !== afterAddress.trim();
  const reasonPresent = Boolean(reason.trim());
  const preflight: readonly ReviewPreflightItem[] = [
    {
      id: "case-binding",
      label: t.caseCheck,
      detail: t.caseCheckDetail(caseReference, expectedRevision),
      state: validCaseBinding ? "pass" : "blocked",
    },
    {
      id: "address-change",
      label: t.addressCheck,
      detail: addressChanged ? t.addressChanged : t.addressUnchanged,
      state: addressChanged ? "pass" : "blocked",
    },
    {
      id: "reason",
      label: t.reasonCheck,
      detail: reasonPresent ? t.reasonPresent : t.reasonMissing,
      state: reasonPresent ? "pass" : "blocked",
    },
    {
      id: "rf-impact",
      label: t.impactCheck,
      detail: invalidations.length
        ? t.impactFound(invalidations.length)
        : t.impactEmpty,
      state: invalidations.length ? "warning" : "pass",
    },
  ];

  const runCommit = async (typedConfirmation: string | null) => {
    setResult(null);
    setUiState("pending");
    let nextResult: AddressCorrectionCommitResult;
    try {
      nextResult = await onCommit({
        afterAddress: afterAddress.trim(),
        beforeAddress: beforeAddress.trim(),
        caseId,
        caseReference,
        confirmation: typedConfirmation || "",
        expectedRevision,
        idempotencyKey,
        invalidations: invalidations.map((item) => ({ ...item })),
        reason: reason.trim(),
      });
    } catch (error) {
      const failedResult: AddressCorrectionCommitResult = {
        kind: "error",
        message: t.requestFailed,
        retryable: true,
      };
      setResult(failedResult);
      setUiState("error");
      onResult?.(failedResult);
      throw error;
    }
    setResult(nextResult);
    onResult?.(nextResult);
    if (nextResult.kind === "success") {
      setUiState("success");
      return;
    }
    setUiState(nextResult.kind);
    throw new Error(`Address correction returned ${nextResult.kind}`);
  };

  const feedbackState: AdminAsyncState =
    uiState === "conflict" ? "error" : uiState;
  const feedbackMessage =
    result?.kind === "success"
      ? result.message || t.success
      : result?.kind === "conflict"
        ? t.conflict(
            result.message,
            result.currentAddress,
            result.currentRevision,
          )
        : result?.kind === "error"
          ? result.message
          : undefined;
  const postCommitState =
    result?.kind === "success"
      ? t.postSuccess(result.caseRevision)
      : result?.kind === "conflict"
        ? t.postConflict
        : result?.kind === "error"
          ? t.postError
          : t.postIdle;

  return (
    <ReviewAndCommit
      changes={[t.changedAddress, t.invalidatedDependants]}
      commitLabel={t.commit}
      description={t.description}
      feedbackCorrelationId={
        result?.kind === "error" ? result.correlationId : undefined
      }
      feedbackDelayMs={150}
      feedbackMessage={feedbackMessage}
      feedbackRetryIsSafe={result?.kind === "error" && result.retryable}
      idempotencyKey={idempotencyKey}
      locale={locale}
      onCommit={runCommit}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setResult(null);
          setUiState("idle");
        }
        onOpenChange(nextOpen);
      }}
      open={open}
      postCommitState={postCommitState}
      preflight={preflight}
      risk="destructive"
      state={feedbackState}
      title={t.title}
      typedConfirmation={{
        expectedValue: confirmationPhrase,
        hint: t.confirmationHint(confirmationPhrase),
        label: t.confirmationLabel,
      }}
      untouched={t.untouched}
    >
      <div data-address-correction-state={uiState}>
        <section aria-labelledby={comparisonTitleId}>
          <h3
            className="flex items-center gap-2 text-sm font-bold"
            id={comparisonTitleId}
          >
            <MapPin
              aria-hidden="true"
              className="size-4 text-[var(--an-action)]"
            />
            {t.changedAddress}
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            <div
              className="rounded-xl border border-[var(--an-border)] bg-[var(--an-canvas)] p-3"
              data-address-correction-before
            >
              <dt className="text-xs font-bold text-[var(--an-text-subtle)]">
                {t.before}
              </dt>
              <dd className="mt-1 text-sm font-bold">{beforeAddress}</dd>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="mx-auto size-5 rotate-90 self-center text-[var(--an-action)] sm:rotate-0"
            />
            <div
              className="rounded-xl border border-[var(--an-action)] bg-[var(--an-action-soft)] p-3"
              data-address-correction-after
            >
              <dt className="text-xs font-bold text-[var(--an-action)]">
                {t.after}
              </dt>
              <dd className="mt-1 text-sm font-bold">{afterAddress}</dd>
            </div>
          </dl>
          <div className="mt-3 rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-3">
            <strong className="block text-xs text-[var(--an-text-subtle)]">
              {t.reason}
            </strong>
            <p className="mt-1 text-sm leading-relaxed">{reason}</p>
          </div>
        </section>

        <section
          aria-labelledby={invalidationsTitleId}
          className="mt-5 rounded-xl border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-4"
        >
          <h3
            className="flex items-center gap-2 text-sm font-bold text-[var(--an-danger)]"
            id={invalidationsTitleId}
          >
            <FileWarning aria-hidden="true" className="size-4" />
            {t.invalidations}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--an-text-muted)]">
            {t.invalidationsIntro}
          </p>
          {invalidations.length ? (
            <ul className="mt-3 grid gap-2">
              {invalidations.map((item) => (
                <li
                  className="rounded-lg border border-[var(--an-border)] bg-[var(--an-canvas)] p-3"
                  data-address-correction-invalidation={item.kind}
                  key={`${item.kind}:${item.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--an-danger)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-danger)]">
                      {t.invalidationKinds[item.kind]}
                    </span>
                    <strong className="text-sm">{item.label}</strong>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--an-text-muted)]">
                    {item.reason}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--an-text-muted)]">
              {t.noInvalidations}
            </p>
          )}
        </section>
      </div>
    </ReviewAndCommit>
  );
}
