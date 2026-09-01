import { redirect } from "next/navigation";
import { AdminNextToday } from "@/components/admin-next/admin-next-today";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { parseAdminNextTodayView } from "@/lib/admin-next/today-fixture";
import { requireAdminUser } from "@/lib/auth/internal-session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminNextTodayPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const access = resolveAdminNextPreviewAccess(
    buildAdminNextRolloutView(),
    "today",
  );
  if (access.kind === "legacy_fallback") redirect(access.href);
  const params = await searchParams;

  return (
    <AdminNextToday
      locale={user.interfaceLanguage}
      view={parseAdminNextTodayView(params.view)}
    />
  );
}
