import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  adminNextWorkQueueHref,
  AdminNextWorkQueue,
  parseAdminNextWorkQueueRouteState,
  workQueueFilterOptionsFromFacets,
} from "@/components/admin-next/admin-next-work-queue";
import { AdminAsyncFeedback } from "@/components/admin-next/admin-async-feedback";
import { adminNextRoleHasReadCapability } from "@/lib/admin-next/capability-registry";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { resolvePreviewE2eOperatorCapabilities } from "@/lib/admin-next/preview-e2e-operator-capabilities";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";
import type { AdminNextTodayAdapter } from "@/lib/admin-next/today-contract";
import { createAdminNextCanonicalTodayAdapter } from "@/lib/admin-next/today-read-adapter";
import { createAdminNextWorkQueueFixture } from "@/lib/admin-next/work-queue-fixture";
import {
  adminNextPreviewCaseWorkspaceHref,
  adminNextPreviewWorkQueueEntry,
} from "@/lib/admin-next/work-queue-navigation";
import type { CaseNextActionCapability } from "@/lib/admin-v2/case-next-action-presentation";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import type { PanelLocale } from "@/lib/panel-i18n";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const loadErrorCopy = {
  nb: {
    action: "Laster canonical arbeidskø",
    message:
      "Arbeidskøen kunne ikke lastes fra canonical data. Ingen syntetiske data ble vist.",
    recovery: "Åpne dagens eksisterende arbeidsflate",
  },
  lt: {
    action: "Įkeliama canonical darbų eilė",
    message:
      "Darbų eilės nepavyko įkelti iš canonical duomenų. Sintetiniai duomenys nebuvo parodyti.",
    recovery: "Atverti esamą šiandienos darbo sritį",
  },
  en: {
    action: "Loading canonical Work Queue",
    message:
      "The Work Queue could not be loaded from canonical data. No synthetic data was shown.",
    recovery: "Open the existing Today workspace",
  },
} as const;

function fixtureAdapter(locale: PanelLocale): AdminNextTodayAdapter {
  return {
    async load(query) {
      if (!query) throw new TypeError("Work Queue fixture requires a query");
      return {
        status: "ready",
        source: "fixture",
        value: [],
        workQueue: createAdminNextWorkQueueFixture(locale, query),
      };
    },
  };
}

function WorkQueueLoadError({ locale }: { locale: PanelLocale }) {
  const copy = loadErrorCopy[locale];
  return (
    <section
      className="mx-auto max-w-[900px] space-y-4"
      data-work-queue-load-state="canonical_error"
    >
      <AdminAsyncFeedback
        action={copy.action}
        locale={locale}
        message={copy.message}
        state="error"
      />
      <Link
        className="inline-flex min-h-11 items-center rounded-xl border border-[var(--an-border-strong)] bg-[var(--an-surface-base)] px-4 text-sm font-bold text-[var(--an-text-primary)]"
        href="/admin-v2"
      >
        {copy.recovery}
      </Link>
    </section>
  );
}

export default async function AdminNextPreviewWorkQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const user = await requireAdminUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "today");
  if (access.kind === "legacy_fallback") redirect(access.href);

  const state = parseAdminNextWorkQueueRouteState(await searchParams);
  if (!state.parsed.ok) redirect(adminNextPreviewWorkQueueEntry);
  if (state.needsCanonicalRedirect) {
    redirect(
      adminNextWorkQueueHref({
        basePath: "/admin-next-preview/work",
        query: state.parsed.value,
        selectedCaseId: state.selectedCaseId,
      }),
    );
  }
  const canReadCases = adminNextRoleHasReadCapability(user.role, "case.read");
  const localFixture = fixtureAdapter(user.interfaceLanguage);
  let canonical: AdminNextTodayAdapter | undefined;
  if (process.env.VERCEL_ENV === "preview") {
    try {
      const grantedCapabilities: readonly CaseNextActionCapability[] =
        canReadCases
          ? [
              ...new Set<CaseNextActionCapability>([
                "case.read",
                ...resolvePreviewE2eOperatorCapabilities({ role: user.role }),
              ]),
            ]
          : [];
      canonical = createAdminNextCanonicalTodayAdapter(
        await getPayload(),
        user.displayName || "",
        {
          currentUserId: `user:${user.id}`,
          grantedCapabilities,
          locale: user.interfaceLanguage,
        },
      );
    } catch {
      return <WorkQueueLoadError locale={user.interfaceLanguage} />;
    }
  }

  const selection = resolveAdminNextServerRead({
    moduleId: "today",
    rollout,
    role: user.role,
    canonical,
    fixture: localFixture,
  });
  if (selection.kind === "legacy_fallback") redirect(selection.href);

  let result;
  try {
    result = await selection.adapter.load(state.parsed.value);
  } catch {
    return <WorkQueueLoadError locale={user.interfaceLanguage} />;
  }
  if (
    !result.workQueue ||
    (selection.kind === "canonical_read" && result.source !== "canonical") ||
    (selection.kind === "fixture_fallback" && result.source !== "fixture")
  ) {
    return <WorkQueueLoadError locale={user.interfaceLanguage} />;
  }

  const filterOptions = workQueueFilterOptionsFromFacets(
    result.workQueue,
    user.interfaceLanguage,
  );
  const workQueueQuery = result.workQueue.query;
  const source = result.source;
  const workQueue = canReadCases
    ? {
        ...result.workQueue,
        items: result.workQueue.items.map((item) => ({
          ...item,
          case: {
            ...item.case,
            href: adminNextPreviewCaseWorkspaceHref({
              caseReference: item.case.reference,
              returnTo: adminNextWorkQueueHref({
                basePath: "/admin-next-preview/work",
                query: workQueueQuery,
                selectedCaseId: item.case.id,
              }),
            }),
          },
        })),
      }
    : result.workQueue;

  return (
    <AdminNextWorkQueue
      actionKinds={filterOptions.actionKinds}
      filterOwners={filterOptions.filterOwners}
      locale={user.interfaceLanguage}
      page={workQueue}
      processStages={filterOptions.processStages}
      selectedCaseId={state.selectedCaseId}
      source={source}
    />
  );
}
