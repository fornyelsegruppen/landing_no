import { AlertTriangle, CheckCircle2, Clock3, DatabaseBackup, MailCheck, ShieldCheck } from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import { panelDateLocale } from "@/lib/panel-i18n";
import type { OperationalHealth, PlatformHealth } from "@/lib/platform/health";
import type { buildReleaseGate } from "@/lib/platform/release-gate";

type ReleaseGate = ReturnType<typeof buildReleaseGate>;

const copy = {
  nb: { title: "Systemstatus og produksjonsport", intro: "Trygg driftsstatus uten nøkler eller kundedata.", ready: "Klar", attention: "Må rettes", disabled: "Deaktivert med vilje", production: "Produksjonsport", productionReady: "Alle aktive porter er godkjent", productionBlocked: "Produksjon er fortsatt blokkert", integrations: "Integrasjoner", operations: "Drift", lastJob: "Siste fullførte job", overdueJobs: "Forfalte jobber", failedJobs: "Feilede jobber", email: "Siste leverte e-post", emailFailures: "E-postfeil", seo: "Siste SEO-kjøring", seoFailures: "SEO-feil", quota: "Quota-varsler", backup: "Sist verifiserte backup", missing: "Ikke registrert", evidence: "Restore-bevis er registrert", noEvidence: "Restore-bevis mangler", blockers: "Aktive production-blokkeringer" },
  lt: { title: "Sistemos būklė ir production vartai", intro: "Saugi veikimo santrauka be raktų ir klientų duomenų.", ready: "Paruošta", attention: "Reikia taisyti", disabled: "Sąmoningai išjungta", production: "Production vartai", productionReady: "Visi aktyvūs vartai patvirtinti", productionBlocked: "Production vis dar užblokuota", integrations: "Integracijos", operations: "Veikimas", lastJob: "Paskutinis sėkmingas job", overdueJobs: "Vėluojantys job", failedJobs: "Nepavykę job", email: "Paskutinis pristatytas laiškas", emailFailures: "El. pašto klaidos", seo: "Paskutinis SEO vykdymas", seoFailures: "SEO klaidos", quota: "Quota perspėjimai", backup: "Paskutinis patikrintas backup", missing: "Neužfiksuota", evidence: "Atkūrimo įrodymas užfiksuotas", noEvidence: "Atkūrimo įrodymo nėra", blockers: "Aktyvūs production blokavimai" },
  en: { title: "System health and production gate", intro: "Safe operational summary without keys or customer data.", ready: "Ready", attention: "Needs attention", disabled: "Intentionally disabled", production: "Production gate", productionReady: "All active gates are approved", productionBlocked: "Production remains blocked", integrations: "Integrations", operations: "Operations", lastJob: "Last completed job", overdueJobs: "Overdue jobs", failedJobs: "Failed jobs", email: "Last delivered email", emailFailures: "Email failures", seo: "Last SEO run", seoFailures: "SEO failures", quota: "Quota warnings", backup: "Last verified backup", missing: "Not recorded", evidence: "Restore evidence is recorded", noEvidence: "Restore evidence is missing", blockers: "Active production blockers" },
} as const;

function tone(ok: boolean) {
  return ok ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200" : "border-danger/35 bg-danger/10 text-white";
}

export function PlatformHealthPanel({ health, locale, operational, releaseGate }: { health: PlatformHealth; locale: PanelLocale; operational: OperationalHealth; releaseGate: ReleaseGate }) {
  const t = copy[locale];
  const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(panelDateLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : t.missing;
  const stats = [
    [t.lastJob, formatDate(operational.jobs.lastCompletedAt), operational.jobs.failed === 0 && operational.jobs.overdue === 0],
    [t.overdueJobs, String(operational.jobs.overdue), operational.jobs.overdue === 0],
    [t.failedJobs, String(operational.jobs.failed), operational.jobs.failed === 0],
    [t.email, formatDate(operational.email.lastDeliveredAt), operational.email.failed === 0],
    [t.emailFailures, String(operational.email.failed), operational.email.failed === 0],
    [t.seo, formatDate(operational.seo.lastCompletedAt), operational.seo.failed === 0],
    [t.seoFailures, String(operational.seo.failed), operational.seo.failed === 0],
    [t.quota, String(operational.jobs.quotaWarnings), operational.jobs.quotaWarnings === 0],
  ] as const;
  const blockers = Object.entries(releaseGate.features).filter(([, item]) => item.status === "no_go");

  return <section className="space-y-5 rounded-3xl border border-white/10 bg-background-elevated/75 p-5 sm:p-6">
    <header><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">{t.production}</p><h2 className="mt-2 text-2xl font-bold">{t.title}</h2><p className="mt-2 text-sm text-muted-foreground">{t.intro}</p></header>
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${tone(releaseGate.productionReady)}`}>{releaseGate.productionReady ? <ShieldCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0"/> : <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-danger"/>}<div><strong>{releaseGate.productionReady ? t.productionReady : t.productionBlocked}</strong><p className="mt-1 text-sm opacity-80">GO {releaseGate.counts.go} · NO-GO {releaseGate.counts.noGo} · {t.disabled} {releaseGate.counts.disabled}</p></div></div>
    <div><h3 className="mb-3 font-bold">{t.integrations}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.values(health.integrations).map((integration) => { const ok = integration.readiness === "ready"; const intentionallyDisabled = integration.readiness === "disabled"; return <article className={`rounded-2xl border p-4 ${intentionallyDisabled ? "border-white/10 bg-black/15" : tone(ok)}`} key={integration.name}><div className="flex items-center gap-2">{ok ? <CheckCircle2 aria-hidden="true" className="size-4"/> : <AlertTriangle aria-hidden="true" className="size-4"/>}<strong className="capitalize">{integration.name}</strong></div><p className="mt-2 text-sm">{intentionallyDisabled ? t.disabled : ok ? t.ready : t.attention} · {integration.provider}</p>{integration.missing.length ? <p className="mt-2 break-words text-xs opacity-75">{integration.missing.join(", ")}</p> : null}</article>; })}</div></div>
    <div><h3 className="mb-3 font-bold">{t.operations}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value, ok]) => <article className={`rounded-2xl border p-4 ${tone(ok)}`} key={label}><Clock3 aria-hidden="true" className="size-4"/><p className="mt-3 text-xs font-bold uppercase tracking-wider opacity-70">{label}</p><strong className="mt-1 block break-words text-lg">{value}</strong></article>)}</div></div>
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${tone(Boolean(operational.backup.lastVerifiedAt && operational.backup.referenceConfigured))}`}><DatabaseBackup aria-hidden="true" className="mt-0.5 size-5 shrink-0"/><div><strong>{t.backup}: {formatDate(operational.backup.lastVerifiedAt)}</strong><p className="mt-1 text-sm opacity-80">{operational.backup.referenceConfigured ? t.evidence : t.noEvidence}</p></div></div>
    {blockers.length ? <details className="rounded-2xl border border-danger/30 p-4"><summary className="cursor-pointer font-bold text-danger">{t.blockers} ({blockers.length})</summary><div className="mt-3 grid gap-2">{blockers.map(([name, item]) => <div className="rounded-xl bg-black/20 p-3 text-sm" key={name}><strong>{name}</strong><p className="mt-1 break-words text-muted-foreground">{[...item.unavailableIntegrations, ...item.missingEvidence].join(", ")}</p></div>)}</div></details> : null}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><MailCheck aria-hidden="true" className="size-4"/> {new Intl.DateTimeFormat(panelDateLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(health.generatedAt))}</p>
  </section>;
}
