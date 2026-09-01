import { AlertTriangle, PauseCircle } from "lucide-react";
import type { PanelLocale } from "@/lib/panel-i18n";
import type { buildOperatingMode } from "@/lib/platform/operating-mode";
import type { FeatureFlagName } from "@/lib/platform/features";

type OperatingStatus = ReturnType<typeof buildOperatingMode>;

const copy = {
  nb: {
    pilot: "Kontrollert pilot",
    full: "Full drift",
    wave: "Aktiv bølge",
    enabled: "aktive funksjoner",
    disabled: "fortsatt deaktivert",
    paused: "Automatiske kommersielle og operative utsendelser er satt på pause",
    running: "Automatiske utsendelser er aktivert for godkjent bølge",
    details: "Vis funksjonsstatus",
  },
  lt: {
    pilot: "Kontroliuojamas pilotas",
    full: "Pilnas veikimas",
    wave: "Aktyvi banga",
    enabled: "aktyvios funkcijos",
    disabled: "dar išjungta",
    paused: "Automatiniai komerciniai ir operaciniai siuntimai pristabdyti",
    running: "Automatiniai siuntimai įjungti patvirtintai bangai",
    details: "Rodyti funkcijų būseną",
  },
  en: {
    pilot: "Controlled pilot",
    full: "Full operation",
    wave: "Active wave",
    enabled: "active features",
    disabled: "still disabled",
    paused: "Automated commercial and operational sends are paused",
    running: "Automated sends are enabled for the approved wave",
    details: "Show feature status",
  },
} as const;

const featureLabels: Record<FeatureFlagName, string> = {
  aiDrafts: "AI drafts",
  roofMeasurement: "Roof measurement",
  roofFusionV1: "Roof Fusion v1 Preview",
  customerQuotes: "Customer quotes",
  contractSigning: "Contract signing",
  workerPortal: "Worker portal",
  automatedReminders: "Automated reminders",
  seoScheduler: "SEO scheduler",
  caseStateEngineV2: "Case state engine",
  measurementEvidenceV2: "Measurement evidence",
  adminExceptionFlowsV2: "Admin exception flows",
  communicationRoutingV2: "Communication routing",
  customerLifecycleV2: "Customer lifecycle",
  securityHardeningV2: "Security hardening",
};

export function ControlledPilotBanner({
  locale,
  status,
}: {
  locale: PanelLocale;
  status: OperatingStatus;
}) {
  const t = copy[locale];
  const controlled = status.mode === "controlled_pilot";

  return (
    <section
      aria-label={controlled ? t.pilot : t.full}
      className="mx-auto mb-5 max-w-7xl rounded-2xl border border-accent/35 bg-accent/8 px-4 py-3 text-sm shadow-lg shadow-black/10"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2 font-black uppercase tracking-[.12em] text-accent">
          <AlertTriangle aria-hidden="true" className="size-4" />
          {controlled ? t.pilot : t.full}
        </span>
        <strong>{t.wave}: {status.activeWave}</strong>
        <span className="text-muted-foreground">
          {status.enabledFeatures.length} {t.enabled} · {status.disabledFeatures.length} {t.disabled}
        </span>
      </div>
      <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <PauseCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {status.automaticCommunicationPaused ? t.paused : t.running}
      </p>
      {status.disabledFeatures.length ? (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold hover:text-white">{t.details}</summary>
          <p className="mt-2 leading-5">
            {status.disabledFeatures.map((feature) => featureLabels[feature]).join(" · ")}
          </p>
        </details>
      ) : null}
    </section>
  );
}
