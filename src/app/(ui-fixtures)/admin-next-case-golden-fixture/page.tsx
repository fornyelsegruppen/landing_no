import { notFound } from "next/navigation";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import {
  getCaseWorkspaceGoldenVisualFixture,
  parseCaseWorkspaceGoldenVisualFixtureState,
  projectCaseWorkspaceGoldenVisualFixture,
} from "@/lib/admin-next/case-workspace-golden-view-fixture";
import type { PanelLocale } from "@/lib/panel-i18n";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function fixtureLocale(
  value: string | string[] | undefined,
): PanelLocale | null {
  return value === "nb" || value === "lt" || value === "en" ? value : null;
}

export default async function AdminNextCaseGoldenVisualFixture({
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

  const query = await searchParams;
  const fixtureId = parseCaseWorkspaceGoldenVisualFixtureState(query.state);
  const locale = fixtureLocale(query.lang);
  if (!fixtureId || !locale) notFound();

  const fixture = getCaseWorkspaceGoldenVisualFixture(fixtureId);
  const value = projectCaseWorkspaceGoldenVisualFixture(fixture, locale);

  return (
    <AdminNextShell displayName="Golden fixture operator" locale={locale}>
      <AdminNextCaseWorkspace locale={locale} value={value} />
    </AdminNextShell>
  );
}
