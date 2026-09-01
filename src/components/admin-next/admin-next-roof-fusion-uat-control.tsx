"use client";

import Link from "next/link";
import { CheckCircle2, LoaderCircle, Ruler, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

export type RoofFusionUatActionState =
  | { kind: "idle" }
  | { kind: "error" }
  | {
      kind: "success";
      previewHref: string;
      snapshot: { revision: number; snapshotId: string; state: string };
      status: "prepared" | "already_prepared";
    };

const initialState: RoofFusionUatActionState = { kind: "idle" };

const copy = {
  nb: {
    eyebrow: "Roof Fusion · beskyttet Preview",
    title: "Klargjør syntetisk R4 UAT-måling",
    intro:
      "Oppretter bare den deterministiske golden-serien for den valgte testsaken. Ingen kundevarsler eller produksjonsdata berøres.",
    caseLabel: "Testsak",
    action: "Klargjør R4 UAT",
    working: "Klargjør …",
    ready: "R4 UAT er klart",
    existing: "R4 UAT var allerede klart",
    open: "Åpne canonical R4-visning",
    failure: "UAT-klargjøringen mislyktes. Ingen produksjonsdata ble endret.",
    guard: "Kun Preview · eksplisitt adminhandling · idempotent",
  },
  lt: {
    eyebrow: "Roof Fusion · apsaugotas Preview",
    title: "Paruošti sintetinį R4 UAT matavimą",
    intro:
      "Sukuriama tik deterministinė golden seka pasirinktai testinei bylai. Klientams niekas nesiunčiama, Production duomenys neliečiami.",
    caseLabel: "Testinė byla",
    action: "Paruošti R4 UAT",
    working: "Ruošiama…",
    ready: "R4 UAT paruoštas",
    existing: "R4 UAT jau buvo paruoštas",
    open: "Atidaryti canonical R4 peržiūrą",
    failure: "UAT paruošimas nepavyko. Production duomenys nepakeisti.",
    guard: "Tik Preview · aiškus admin veiksmas · idempotentinis",
  },
  en: {
    eyebrow: "Roof Fusion · protected Preview",
    title: "Prepare a synthetic R4 UAT measurement",
    intro:
      "Creates only the deterministic golden sequence for the selected test case. It sends nothing to customers and never touches Production data.",
    caseLabel: "Test case",
    action: "Prepare R4 UAT",
    working: "Preparing…",
    ready: "R4 UAT is ready",
    existing: "R4 UAT was already ready",
    open: "Open canonical R4 review",
    failure: "UAT preparation failed. No Production data was changed.",
    guard: "Preview only · explicit admin action · idempotent",
  },
} as const;

export function AdminNextRoofFusionUatControl({
  action,
  defaultCaseReference = "TF-13",
  locale,
}: {
  action: (
    previousState: RoofFusionUatActionState,
    formData: FormData,
  ) => Promise<RoofFusionUatActionState>;
  defaultCaseReference?: string;
  locale: PanelLocale;
}) {
  const t = copy[locale];
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <section
      aria-labelledby="roof-fusion-uat-title"
      className="mx-auto max-w-3xl rounded-3xl border border-[var(--an-border)] bg-[var(--an-surface)] p-5 shadow-2xl sm:p-8"
      data-admin-next-section="cases"
      data-roof-fusion-uat="preview-only"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--an-amber-soft)] text-[var(--an-amber)]">
          <Ruler aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="text-xs font-black tracking-[.18em] text-[var(--an-amber)] uppercase">
            {t.eyebrow}
          </p>
          <h1
            className="mt-2 text-2xl font-black sm:text-3xl"
            id="roof-fusion-uat-title"
          >
            {t.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--an-muted)]">
            {t.intro}
          </p>
        </div>
      </div>

      <form
        action={formAction}
        className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto]"
      >
        <label
          className="grid gap-2 text-sm font-bold"
          htmlFor="roof-fusion-uat-case"
        >
          {t.caseLabel}
          <input
            autoCapitalize="characters"
            className="min-h-12 rounded-xl border border-[var(--an-border)] bg-[var(--an-elevated)] px-4 font-mono text-[var(--an-text)] outline-none focus:border-[var(--an-amber)]"
            defaultValue={defaultCaseReference}
            id="roof-fusion-uat-case"
            name="caseReference"
            pattern="TF-[1-9][0-9]*"
            required
          />
        </label>
        <button
          className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--an-amber)] px-5 font-black text-[var(--an-amber-ink)] disabled:cursor-wait disabled:opacity-70"
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
          ) : (
            <ShieldCheck aria-hidden="true" className="size-5" />
          )}
          {pending ? t.working : t.action}
        </button>
      </form>

      <p className="mt-3 text-xs font-semibold text-[var(--an-subtle)]">
        {t.guard}
      </p>

      {state.kind === "success" ? (
        <div className="mt-6 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2 font-black text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="size-5" />
            {state.status === "prepared" ? t.ready : t.existing}
          </div>
          <p className="mt-2 text-xs text-[var(--an-muted)]">
            {state.snapshot.snapshotId} · r{state.snapshot.revision} ·{" "}
            {state.snapshot.state}
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-emerald-300/35 px-4 text-sm font-black text-emerald-200 hover:bg-emerald-300/10"
            href={state.previewHref}
          >
            {t.open}
          </Link>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <p
          className="mt-6 rounded-2xl border border-red-400/35 bg-red-400/10 p-4 text-sm font-bold text-red-200"
          role="alert"
        >
          {t.failure}
        </p>
      ) : null}
    </section>
  );
}
