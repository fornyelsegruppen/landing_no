"use client";

import type { PanelLocale } from "@/lib/panel-i18n";
import type {
  RfContinueOldAction,
  RfContinueOldIntent,
  RfDraftRecoveryDecision,
  RfDraftStaleReason,
  RfStartNewAction,
  RfStartNewIntent,
} from "@/lib/admin-next/rf-draft-recovery-contract";

const copy = {
  nb: {
    eyebrow: "Preview · RF-utkast",
    title: "Gjenopprett måleutkast",
    current:
      "Utkastet stemmer med gjeldende sak, adresse-, kilde- og snapshot-revisjon. Velg om du vil fortsette eller starte på nytt.",
    noDraft: "Det finnes ikke et tidligere utkast å fortsette.",
    missingBinding:
      "Det tidligere utkastet mangler en verifiserbar adresse- og snapshot-binding og kan ikke fortsettes.",
    stale:
      "Det tidligere utkastet er utdatert. Det kan ikke fortsettes eller brukes til pris eller tilbud.",
    invalid:
      "Utkastkonteksten kunne ikke verifiseres. Begge handlingene er trygt deaktivert.",
    binding: "Gjeldende binding",
    addressRevision: "adresse r",
    sourceRevision: "kilde r",
    snapshotRevision: "snapshot r",
    continueOld: "Fortsett tidligere utkast",
    startNew: "Start ny måling",
    commercial:
      "Utkastet er ikke kommersiell sannhet. Pris og tilbud krever et separat godkjent kanonisk RF-snapshot med eksakt hash.",
    previewRequired: "Bare tilgjengelig i Preview",
    capabilityMissing: "Du mangler nødvendig tilgang",
    unavailable: "Handlingen er ikke tilgjengelig for denne bindingen",
  },
  lt: {
    eyebrow: "Preview · RF juodraštis",
    title: "Atkurti matavimo juodraštį",
    current:
      "Juodraštis sutampa su dabartine byla, adreso, šaltinio ir snapshot revizija. Pasirinkite tęsti arba pradėti iš naujo.",
    noDraft: "Nėra ankstesnio juodraščio, kurį būtų galima tęsti.",
    missingBinding:
      "Ankstesnis juodraštis neturi patikrinamo adreso ir snapshot susiejimo, todėl jo tęsti negalima.",
    stale:
      "Ankstesnis juodraštis paseno. Jo negalima tęsti ar naudoti kainodarai bei pasiūlymui.",
    invalid:
      "Juodraščio konteksto patikrinti nepavyko. Abu veiksmai saugiai išjungti.",
    binding: "Dabartinis susiejimas",
    addressRevision: "adresas r",
    sourceRevision: "šaltinis r",
    snapshotRevision: "snapshot r",
    continueOld: "Tęsti seną juodraštį",
    startNew: "Pradėti naują matavimą",
    commercial:
      "Juodraštis nėra komercinis šaltinis. Kainodarai ir pasiūlymui būtinas atskirai patvirtintas kanoninis RF snapshot su tiksliu hash.",
    previewRequired: "Pasiekiama tik Preview aplinkoje",
    capabilityMissing: "Neturite reikiamos teisės",
    unavailable: "Šis veiksmas negalimas dabartiniam susiejimui",
  },
  en: {
    eyebrow: "Preview · RF draft",
    title: "Recover measurement draft",
    current:
      "The draft matches the current case, address, source and snapshot revision. Continue it or start again.",
    noDraft: "There is no previous draft to continue.",
    missingBinding:
      "The previous draft has no verifiable address and snapshot binding and cannot be continued.",
    stale:
      "The previous draft is stale. It cannot be continued or used for pricing or an offer.",
    invalid:
      "The draft context could not be verified. Both actions are safely disabled.",
    binding: "Current binding",
    addressRevision: "address r",
    sourceRevision: "source r",
    snapshotRevision: "snapshot r",
    continueOld: "Continue old draft",
    startNew: "Start new measurement",
    commercial:
      "A draft is not commercial truth. Pricing and offers require a separately approved canonical RF snapshot pinned by exact hash.",
    previewRequired: "Available in Preview only",
    capabilityMissing: "You do not have the required capability",
    unavailable: "This action is unavailable for the current binding",
  },
} as const;

const reasonCopy: Record<RfDraftStaleReason, Record<PanelLocale, string>> = {
  draft_reference_conflict: {
    nb: "Utkastreferansen stemmer ikke med den lagrede bindingen.",
    lt: "Juodraščio nuoroda nesutampa su išsaugotu susiejimu.",
    en: "The draft reference does not match its stored binding.",
  },
  case_id_changed: {
    nb: "Utkastet tilhører en annen sak.",
    lt: "Juodraštis priklauso kitai bylai.",
    en: "The draft belongs to a different case.",
  },
  address_revision_changed: {
    nb: "Saksadressen er endret etter at utkastet ble opprettet.",
    lt: "Bylos adresas pakeistas po juodraščio sukūrimo.",
    en: "The case address changed after the draft was created.",
  },
  source_id_changed: {
    nb: "RF-kilden er byttet.",
    lt: "RF šaltinis pakeistas.",
    en: "The RF source changed.",
  },
  source_revision_changed: {
    nb: "RF-kilderevisjonen er endret.",
    lt: "RF šaltinio revizija pasikeitė.",
    en: "The RF source revision changed.",
  },
  source_hash_changed: {
    nb: "RF-kildeinnholdet har en annen hash.",
    lt: "RF šaltinio turinys turi kitą hash.",
    en: "The RF source content has a different hash.",
  },
  snapshot_id_changed: {
    nb: "RF-snapshotet er byttet.",
    lt: "RF snapshot pakeistas.",
    en: "The RF snapshot changed.",
  },
  snapshot_revision_changed: {
    nb: "RF-snapshot-revisjonen er endret.",
    lt: "RF snapshot revizija pasikeitė.",
    en: "The RF snapshot revision changed.",
  },
  snapshot_hash_changed: {
    nb: "RF-snapshotet har en annen hash.",
    lt: "RF snapshot turi kitą hash.",
    en: "The RF snapshot has a different hash.",
  },
};

function unavailableLabel(
  locale: PanelLocale,
  action: RfContinueOldAction | RfStartNewAction,
) {
  const t = copy[locale];
  if (action.available) return undefined;
  if (action.unavailableReason === "preview_required") {
    return t.previewRequired;
  }
  if (action.unavailableReason === "capability_missing") {
    return t.capabilityMissing;
  }
  return t.unavailable;
}

export function AdminNextRfDraftRecoveryDecision({
  decision,
  locale,
  onContinueOld,
  onStartNew,
}: {
  decision: RfDraftRecoveryDecision;
  locale: PanelLocale;
  onContinueOld: (intent: RfContinueOldIntent) => void;
  onStartNew: (intent: RfStartNewIntent) => void;
}) {
  const t = copy[locale];
  const summary =
    decision.reason === "current_binding"
      ? t.current
      : decision.reason === "no_previous_draft"
        ? t.noDraft
        : decision.reason === "recovery_binding_missing"
          ? t.missingBinding
          : decision.reason === "stale_binding"
            ? t.stale
            : t.invalid;

  return (
    <section
      aria-labelledby="rf-draft-recovery-title"
      className="rounded-2xl border border-[var(--an-border-strong)] bg-[var(--an-surface-base)] p-4"
      data-rf-commercial-use="forbidden"
      data-rf-draft-recovery={decision.state}
      data-rf-recovery-scope={decision.scope}
    >
      <p className="text-[10px] font-bold tracking-[.12em] text-[var(--an-muted)] uppercase">
        {t.eyebrow}
      </p>
      <h2
        className="mt-1 text-lg font-bold text-[var(--an-text)]"
        id="rf-draft-recovery-title"
      >
        {t.title}
      </h2>
      <p
        className="mt-2 text-sm leading-6 text-[var(--an-muted)]"
        role={decision.state === "continue_or_start_new" ? undefined : "alert"}
      >
        {summary}
      </p>

      {decision.staleReasons.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--an-danger)]">
          {decision.staleReasons.map((reason) => (
            <li key={reason}>{reasonCopy[reason][locale]}</li>
          ))}
        </ul>
      ) : null}

      {decision.current ? (
        <p
          className="mt-3 rounded-xl bg-[var(--an-surface-raised)] px-3 py-2 text-xs text-[var(--an-subtle)]"
          data-rf-recovery-binding
        >
          <strong>{t.binding}:</strong> {decision.current.case.caseId} ·{" "}
          {t.addressRevision}
          {decision.current.case.addressRevision} · {t.sourceRevision}
          {decision.current.source.revision} · {t.snapshotRevision}
          {decision.current.snapshot.revision}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          aria-disabled={!decision.continueOld.available}
          className="min-h-11 rounded-xl border border-[var(--an-action)] px-3 text-sm font-bold text-[var(--an-action)] disabled:cursor-not-allowed disabled:opacity-45"
          data-rf-draft-recovery-action="continue_old"
          disabled={!decision.continueOld.available}
          onClick={() => {
            if (decision.continueOld.available) {
              onContinueOld(decision.continueOld.intent);
            }
          }}
          title={unavailableLabel(locale, decision.continueOld)}
          type="button"
        >
          {t.continueOld}
        </button>
        <button
          aria-disabled={!decision.startNew.available}
          className="min-h-11 rounded-xl bg-[var(--an-action)] px-3 text-sm font-bold text-[var(--an-action-text)] disabled:cursor-not-allowed disabled:opacity-45"
          data-rf-draft-recovery-action="start_new"
          disabled={!decision.startNew.available}
          onClick={() => {
            if (decision.startNew.available) {
              onStartNew(decision.startNew.intent);
            }
          }}
          title={unavailableLabel(locale, decision.startNew)}
          type="button"
        >
          {t.startNew}
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-[var(--an-subtle)]">
        {t.commercial}
      </p>
    </section>
  );
}
