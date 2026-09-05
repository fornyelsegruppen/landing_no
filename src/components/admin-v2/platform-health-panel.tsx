import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Info,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import type {
  AdminNextCapabilityState,
  AdminNextRolloutView,
} from "@/lib/admin-next/rollout-view";
import type { PanelLocale } from "@/lib/panel-i18n";
import { panelDateLocale } from "@/lib/panel-i18n";
import {
  featureEnvironmentKeys,
  type FeatureFlagName,
} from "@/lib/platform/features";
import type { OperationalHealth, PlatformHealth } from "@/lib/platform/health";
import type { buildReleaseGate } from "@/lib/platform/release-gate";
import {
  evidenceLabels,
  featureLabels,
  integrationLabels,
  moduleLabels,
  platformHealthCopy,
  stateLabels,
} from "./platform-health-copy";

type ReleaseGate = ReturnType<typeof buildReleaseGate>;

function tone(ok: boolean) {
  return ok
    ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200"
    : "border-[var(--an-danger)] bg-[color:rgba(244,63,94,.08)] text-[var(--an-text-primary)]";
}

function stateTone(state: AdminNextCapabilityState) {
  if (state === "preview_ready" || state === "enabled") return tone(true);
  if (state === "planned" || state === "legacy_active") {
    return "border-[var(--an-border)] bg-[var(--an-surface-soft)] text-[var(--an-text-muted)]";
  }
  return tone(false);
}

function technicalList(values: readonly string[]) {
  return values.length ? values.join(" · ") : "—";
}

export function PlatformHealthPanel({
  headingLevel = "h2",
  health,
  locale,
  operational,
  releaseGate,
  rollout,
}: {
  headingLevel?: "h1" | "h2";
  health: PlatformHealth;
  locale: PanelLocale;
  operational: OperationalHealth;
  releaseGate: ReleaseGate;
  rollout: AdminNextRolloutView;
}) {
  const t = platformHealthCopy[locale];
  const Title = headingLevel;
  const formatDate = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(panelDateLocale(locale), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Oslo",
        }).format(new Date(value))
      : t.missing;
  const stats = [
    [
      t.lastJob,
      formatDate(operational.jobs.lastCompletedAt),
      operational.jobs.failed === 0 && operational.jobs.overdue === 0,
    ],
    [
      t.overdueJobs,
      String(operational.jobs.overdue),
      operational.jobs.overdue === 0,
    ],
    [
      t.failedJobs,
      String(operational.jobs.failed),
      operational.jobs.failed === 0,
    ],
    [
      t.email,
      formatDate(operational.email.lastDeliveredAt),
      operational.email.failed === 0,
    ],
    [
      t.emailFailures,
      String(operational.email.failed),
      operational.email.failed === 0,
    ],
    [
      t.seo,
      formatDate(operational.seo.lastCompletedAt),
      operational.seo.failed === 0,
    ],
    [
      t.seoFailures,
      String(operational.seo.failed),
      operational.seo.failed === 0,
    ],
    [
      t.quota,
      String(operational.jobs.quotaWarnings),
      operational.jobs.quotaWarnings === 0,
    ],
  ] as const;
  const featureDecisions = Object.entries(releaseGate.features) as [
    FeatureFlagName,
    ReleaseGate["features"][FeatureFlagName],
  ][];
  const activeBlockers = featureDecisions.filter(
    ([, item]) => item.status === "no_go",
  );
  const availableModules = rollout.modules.filter(
    (module) => module.state === "preview_ready" || module.state === "enabled",
  ).length;
  const limitedModules = rollout.modules.filter(
    (module) =>
      module.state === "implemented_disabled" ||
      module.state === "blocked_configuration",
  ).length;
  const operationalIssueCount =
    stats.filter(([, , ok]) => !ok).length +
    (operational.backup.lastVerifiedAt && operational.backup.referenceConfigured
      ? 0
      : 1);
  const previewReady =
    rollout.state === "preview" &&
    availableModules > 0 &&
    limitedModules === 0 &&
    operationalIssueCount === 0;
  const previewHeading =
    rollout.state === "legacy"
      ? t.previewOff
      : rollout.state === "active"
        ? t.canonicalActive
        : previewReady
          ? t.previewReady
          : t.previewAttention;

  return (
    <div className="mx-auto max-w-7xl space-y-6" data-system-health-dashboard>
      <header className="max-w-3xl">
        <p className="text-xs font-bold tracking-[.18em] text-[var(--an-action)] uppercase">
          {t.title}
        </p>
        <Title className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {t.title}
        </Title>
        <p className="mt-3 text-[var(--an-text-muted)]">{t.intro}</p>
      </header>

      <section
        aria-labelledby="preview-health-title"
        className="space-y-4 rounded-3xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-5 sm:p-6"
        data-preview-health-status={previewReady ? "ready" : "attention"}
      >
        <header className="max-w-3xl">
          <p className="text-xs font-bold tracking-[.18em] text-[var(--an-action)] uppercase">
            {t.previewEyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold" id="preview-health-title">
            {t.previewTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--an-text-muted)]">
            {t.previewIntro}
          </p>
        </header>

        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${tone(previewReady)}`}
        >
          {previewReady ? (
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0"
            />
          ) : (
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 text-[var(--an-danger)]"
            />
          )}
          <div>
            <strong>{previewHeading}</strong>
            <p className="mt-1 text-sm opacity-80">
              {t.availableModules}: {availableModules} · {t.moduleAttention}:{" "}
              {limitedModules} · {t.operationalSignals}: {operationalIssueCount}
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <details
            className="rounded-2xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-4 lg:col-span-2"
            data-preview-module-details
          >
            <summary className="cursor-pointer font-bold">{t.modules}</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rollout.modules.map((module) => {
                const visibleDependencies = module.disabledDependencies.map(
                  (feature) => featureLabels[locale][feature],
                );
                const visibleIntegrations = module.unavailableIntegrations.map(
                  (integration) => integrationLabels[locale][integration],
                );
                return (
                  <article
                    className={`rounded-xl border p-3 ${stateTone(module.state)}`}
                    key={module.id}
                  >
                    <div className="flex items-start gap-2">
                      <Layers3
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <strong className="block">
                          {moduleLabels[locale][module.id]}
                        </strong>
                        <span className="mt-1 block text-xs opacity-80">
                          {stateLabels[locale][module.state]}
                        </span>
                      </div>
                    </div>
                    {visibleDependencies.length ||
                    visibleIntegrations.length ? (
                      <p className="mt-2 text-xs opacity-80">
                        {[...visibleDependencies, ...visibleIntegrations].join(
                          " · ",
                        )}
                      </p>
                    ) : null}
                    <details className="mt-3 border-t border-current/15 pt-2 text-xs">
                      <summary className="cursor-pointer font-semibold">
                        {t.technical}
                      </summary>
                      <dl className="mt-2 grid gap-1 break-words opacity-80">
                        <div>
                          <dt className="font-semibold">ID</dt>
                          <dd>{module.id}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold">{t.technicalCodes}</dt>
                          <dd>
                            {technicalList(
                              module.dependencies.map(
                                (feature) => featureEnvironmentKeys[feature],
                              ),
                            )}
                          </dd>
                        </div>
                      </dl>
                    </details>
                  </article>
                );
              })}
            </div>
          </details>

          <details className="rounded-2xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-4">
            <summary className="cursor-pointer font-bold">
              {t.integrations}
            </summary>
            <div className="mt-4 grid gap-2">
              {Object.values(health.integrations).map((integration) => {
                const ok = integration.readiness === "ready";
                const intentionallyDisabled =
                  integration.readiness === "disabled";
                return (
                  <article
                    className={`rounded-xl border p-3 ${
                      intentionallyDisabled
                        ? "border-[var(--an-border)] bg-[var(--an-surface-base)] text-[var(--an-text-muted)]"
                        : tone(ok)
                    }`}
                    key={integration.name}
                  >
                    <div className="flex items-start gap-2">
                      {ok ? (
                        <CheckCircle2
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0"
                        />
                      ) : (
                        <AlertTriangle
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0"
                        />
                      )}
                      <div>
                        <strong>
                          {integrationLabels[locale][integration.name]}
                        </strong>
                        <p className="mt-1 text-xs opacity-80">
                          {intentionallyDisabled
                            ? t.disabled
                            : ok
                              ? t.ready
                              : t.attention}
                        </p>
                      </div>
                    </div>
                    <details className="mt-2 border-t border-current/15 pt-2 text-xs">
                      <summary className="cursor-pointer font-semibold">
                        {t.technical}
                      </summary>
                      <p className="mt-2 break-words opacity-80">
                        {t.provider}: {integration.provider}
                        {integration.missing.length
                          ? ` · ${t.technicalCodes}: ${technicalList(
                              integration.missing,
                            )}`
                          : ""}
                      </p>
                    </details>
                  </article>
                );
              })}
            </div>
          </details>
        </div>

        <details className="rounded-2xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-4">
          <summary className="cursor-pointer font-bold">{t.operations}</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(([label, value, ok]) => (
              <article
                className={`rounded-xl border p-3 ${tone(ok)}`}
                key={label}
              >
                <Clock3 aria-hidden="true" className="size-4" />
                <p className="mt-2 text-xs font-bold tracking-wider uppercase opacity-70">
                  {label}
                </p>
                <strong className="mt-1 block text-base break-words">
                  {value}
                </strong>
              </article>
            ))}
          </div>
          <div
            className={`mt-3 flex items-start gap-3 rounded-xl border p-3 ${tone(
              Boolean(
                operational.backup.lastVerifiedAt &&
                operational.backup.referenceConfigured,
              ),
            )}`}
          >
            <DatabaseBackup
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            <div>
              <strong>
                {t.backup}: {formatDate(operational.backup.lastVerifiedAt)}
              </strong>
              <p className="mt-1 text-sm opacity-80">
                {operational.backup.referenceConfigured
                  ? t.evidence
                  : t.noEvidence}
              </p>
            </div>
          </div>
        </details>
      </section>

      <section
        aria-labelledby="production-release-title"
        className="space-y-4 rounded-3xl border border-[var(--an-border)] bg-[var(--an-surface-base)] p-5 sm:p-6"
        data-production-release-gate={
          releaseGate.productionReady ? "go" : "no_go"
        }
      >
        <header className="max-w-3xl">
          <p className="text-xs font-bold tracking-[.18em] text-[var(--an-warning)] uppercase">
            {t.productionEyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold" id="production-release-title">
            {t.productionTitle}
          </h2>
          <p className="mt-2 text-sm text-[var(--an-text-muted)]">
            {t.productionIntro}
          </p>
        </header>

        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${tone(
            releaseGate.productionReady,
          )}`}
        >
          {releaseGate.productionReady ? (
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0"
            />
          ) : (
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 text-[var(--an-danger)]"
            />
          )}
          <div>
            <strong>
              {releaseGate.productionReady
                ? t.productionReady
                : t.productionBlocked}
            </strong>
            <p className="mt-1 text-sm opacity-80">
              {t.go}: {releaseGate.counts.go} · {t.noGo}:{" "}
              {releaseGate.counts.noGo} · {t.disabled}:{" "}
              {releaseGate.counts.disabled}
            </p>
          </div>
        </div>

        {activeBlockers.length ? (
          <details className="rounded-2xl border border-[var(--an-danger)] bg-[color:rgba(244,63,94,.06)] p-4">
            <summary className="cursor-pointer font-bold text-[var(--an-danger)]">
              {t.blockers} ({activeBlockers.length})
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {activeBlockers.map(([name, item]) => {
                const humanRequirements = [
                  ...item.unavailableIntegrations.map(
                    (integration) => integrationLabels[locale][integration],
                  ),
                  ...item.missingEvidence.map(
                    (requirement) =>
                      evidenceLabels[locale][requirement] ||
                      t.requirementPending,
                  ),
                ];
                return (
                  <article
                    className="rounded-xl border border-[var(--an-border)] bg-[var(--an-surface-soft)] p-3"
                    key={name}
                  >
                    <strong>{featureLabels[locale][name]}</strong>
                    <p className="mt-2 text-xs font-semibold text-[var(--an-text-muted)]">
                      {t.requirements}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--an-text-muted)]">
                      {humanRequirements.map((requirement) => (
                        <li key={requirement}>{requirement}</li>
                      ))}
                    </ul>
                    <details className="mt-3 border-t border-[var(--an-border)] pt-2 text-xs text-[var(--an-text-muted)]">
                      <summary className="cursor-pointer font-semibold text-[var(--an-text-primary)]">
                        {t.technical}
                      </summary>
                      <dl className="mt-2 grid gap-2 break-words">
                        <div>
                          <dt className="font-semibold">{t.featureFlag}</dt>
                          <dd>{item.flag}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold">
                            {t.missingIntegrations}
                          </dt>
                          <dd>{technicalList(item.unavailableIntegrations)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold">{t.missingEvidence}</dt>
                          <dd>{technicalList(item.missingEvidence)}</dd>
                        </div>
                      </dl>
                    </details>
                  </article>
                );
              })}
            </div>
          </details>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/8 p-4 text-sm text-emerald-200">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {t.noBlockers}
          </p>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-[var(--an-text-muted)]">
        <Info aria-hidden="true" className="size-4" />
        {t.generated}: {formatDate(health.generatedAt)}
      </p>
    </div>
  );
}
