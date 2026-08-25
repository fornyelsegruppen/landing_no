"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAdminV2Copy } from "@/lib/admin-v2/i18n";
import type { PanelLocale } from "@/lib/panel-i18n";

type Values = { brandName: string; city: string; closingTime: string; email: string; openingDays: string; openingTime: string; orgNr: string; phone: string; postal: string; street: string };

export function SettingsForm({ locale, values }: { locale: PanelLocale; values: Values }) {
  const copy = getAdminV2Copy(locale).settingsAdmin;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function save(formData: FormData) {
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) });
    const result = await response.json() as { error?: string };
    setBusy(false); setNotice(response.ok ? copy.saved : result.error || "Failed");
    if (response.ok) router.refresh();
  }
  const fields: Array<[keyof Values, string, string?]> = [["brandName", copy.brand], ["phone", copy.phone], ["email", copy.email, "email"], ["street", copy.street], ["postal", copy.postal], ["city", copy.city], ["orgNr", copy.org]];
  return <form action={save} className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-background-elevated/75 p-5 sm:p-6"><h2 className="text-xl font-bold">{copy.company}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(([name, label, type]) => <label className="grid gap-1.5" key={name}><span className="text-xs font-bold uppercase text-muted-foreground">{label}</span><input className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3" defaultValue={values[name]} name={name} required type={type || "text"} /></label>)}</div></section>
    <section className="rounded-3xl border border-white/10 bg-background-elevated/75 p-5 sm:p-6"><h2 className="text-xl font-bold">{copy.opening}</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="grid gap-1.5 sm:col-span-3"><span className="text-xs font-bold uppercase text-muted-foreground">{copy.days}</span><input className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3" defaultValue={values.openingDays} name="openingDays" required /></label><label className="grid gap-1.5"><span className="text-xs font-bold uppercase text-muted-foreground">{copy.from}</span><input className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3" defaultValue={values.openingTime} name="openingTime" required type="time" /></label><label className="grid gap-1.5"><span className="text-xs font-bold uppercase text-muted-foreground">{copy.to}</span><input className="min-h-12 rounded-xl border border-white/10 bg-black/15 px-3" defaultValue={values.closingTime} name="closingTime" required type="time" /></label></div></section>
    <button className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-60" disabled={busy} type="submit">{copy.save}</button>
    {notice ? <p className="text-sm text-muted-foreground" role="status">{notice}</p> : null}
  </form>;
}
