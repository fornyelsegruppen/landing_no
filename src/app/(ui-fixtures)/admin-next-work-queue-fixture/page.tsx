import { notFound, redirect } from "next/navigation";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import {
  adminNextWorkQueueHref,
  AdminNextWorkQueue,
  parseAdminNextWorkQueueRouteState,
  workQueueFilterOptionsFromFacets,
} from "@/components/admin-next/admin-next-work-queue";
import type { PanelLocale } from "@/lib/panel-i18n";
import { createAdminNextWorkQueueFixture } from "@/lib/admin-next/work-queue-fixture";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function fixtureLocale(value: string | string[] | undefined): PanelLocale {
  return value === "nb" || value === "en" ? value : "lt";
}

export default async function AdminNextWorkQueueVisualFixture({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }
  const rawParams = await searchParams;
  const locale = fixtureLocale(rawParams.lang);
  const state = parseAdminNextWorkQueueRouteState(rawParams, ["lang"]);
  if (!state.parsed.ok) {
    redirect(
      `/admin-next-work-queue-fixture?view=today&queue=all&limit=25&lang=${locale}`,
    );
  }
  if (state.needsCanonicalRedirect) {
    redirect(
      adminNextWorkQueueHref({
        basePath: "/admin-next-work-queue-fixture",
        query: state.parsed.value,
        selectedCaseId: state.selectedCaseId,
      }),
    );
  }
  const page = createAdminNextWorkQueueFixture(locale, state.parsed.value);
  const filterOptions = workQueueFilterOptionsFromFacets(page, locale);

  return (
    <AdminNextShell displayName="Demo administratorius" locale={locale}>
      <AdminNextWorkQueue
        actionKinds={filterOptions.actionKinds}
        basePath="/admin-next-work-queue-fixture"
        filterOwners={filterOptions.filterOwners}
        locale={locale}
        page={page}
        processStages={filterOptions.processStages}
        selectedCaseId={state.selectedCaseId}
      />
    </AdminNextShell>
  );
}
