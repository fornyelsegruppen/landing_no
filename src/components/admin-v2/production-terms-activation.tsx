"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

const copy = {
  nb: {
    active: "Aktiv kontraktsversjon",
    activate: "Aktiver eiergodkjent pilotversjon",
    description:
      "Oppretter PRODUCTION-PILOT-V1, pensjonerer tidligere stagingvilkår og bruker den nye versjonen bare i nye dokumentversjoner.",
    error: "Kontraktsvilkårene kunne ikke aktiveres.",
    pending: "Aktiverer …",
    success: "Produksjonspilotvilkårene er aktivert.",
    title: "Kontraktsvilkår",
  },
  lt: {
    active: "Aktyvi sutarties versija",
    activate: "Aktyvuoti savininko patvirtintą pilotinę versiją",
    description:
      "Sukuria PRODUCTION-PILOT-V1, užbaigia ankstesnių staging sąlygų naudojimą ir naują tekstą taiko tik naujoms dokumentų versijoms.",
    error: "Sutarties sąlygų aktyvuoti nepavyko.",
    pending: "Aktyvuojama…",
    success: "Produkcijos piloto sąlygos aktyvuotos.",
    title: "Sutarties sąlygos",
  },
  en: {
    active: "Active contract version",
    activate: "Activate owner-approved pilot version",
    description:
      "Creates PRODUCTION-PILOT-V1, retires previous staging terms and applies the new text only to new document versions.",
    error: "The contract terms could not be activated.",
    pending: "Activating…",
    success: "The production pilot terms are active.",
    title: "Contract terms",
  },
} as const;

export function ProductionTermsActivation({
  activeVersion,
  locale,
  targetVersion,
}: {
  activeVersion?: string;
  locale: PanelLocale;
  targetVersion: string;
}) {
  const labels = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const isActive = activeVersion === targetVersion;

  async function activate() {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/contract-terms/production-pilot", {
      method: "POST",
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    setNotice(response.ok ? labels.success : result.error || labels.error);
    if (response.ok) router.refresh();
  }

  return (
    <section className="bg-background-elevated/75 rounded-3xl border border-white/10 p-5 sm:p-6">
      <h2 className="text-xl font-bold">{labels.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        {labels.active}: <strong>{activeVersion || "—"}</strong>
      </p>
      <p className="text-muted-foreground mt-3 max-w-3xl text-sm">
        {labels.description}
      </p>
      {!isActive ? (
        <button
          className="bg-accent text-accent-foreground mt-5 min-h-12 rounded-xl px-5 font-bold disabled:opacity-60"
          disabled={busy}
          onClick={activate}
          type="button"
        >
          {busy ? labels.pending : labels.activate}
        </button>
      ) : null}
      {notice ? (
        <p className="text-muted-foreground mt-3 text-sm" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
