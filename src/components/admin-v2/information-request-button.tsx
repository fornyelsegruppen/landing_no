"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

const labels = {
  nb: ["Be om manglende opplysninger", "Utkast opprettet. Kontroller og send det under meldinger."],
  lt: ["Paprašyti trūkstamos informacijos", "Juodraštis sukurtas. Patikrinkite ir išsiųskite jį žinučių skiltyje."],
  en: ["Request missing information", "Draft created. Review and send it under messages."],
} as const;

export function InformationRequestButton({ leadId, locale }: { leadId: number; locale: PanelLocale }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  async function run() {
    if (busy) return; setBusy(true); setNotice("");
    const response = await fetch(`/api/admin/leads/${leadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request_information" }) }).catch(() => null);
    if (!response?.ok) { const body = await response?.json().catch(() => ({})) as { error?: string } | undefined; setNotice(body?.error || "Error"); }
    else { setNotice(labels[locale][1]); router.refresh(); }
    setBusy(false);
  }
  return <div className="mt-4"><button className="min-h-11 rounded-xl border border-accent/40 px-4 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-50" disabled={busy} onClick={() => void run()} type="button">{labels[locale][0]}</button>{notice ? <p className="mt-2 text-sm text-muted-foreground" role="status">{notice}</p> : null}</div>;
}
