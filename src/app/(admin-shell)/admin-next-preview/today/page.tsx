import { redirect } from "next/navigation";
import { AdminNextToday } from "@/components/admin-next/admin-next-today";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { parseAdminNextTodayView } from "@/lib/admin-next/today-fixture";
import { adminNextFixtureTodayAdapter } from "@/lib/admin-next/today-fixture";
import { createAdminNextCanonicalTodayAdapter } from "@/lib/admin-next/today-read-adapter";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminNextTodayPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "today");
  if (access.kind === "legacy_fallback") redirect(access.href);
  const canonical = process.env.VERCEL_ENV === "preview"
    ? createAdminNextCanonicalTodayAdapter(await getPayload(), user.displayName || user.email)
    : undefined;
  const selection = resolveAdminNextServerRead({
    moduleId: "today",
    rollout,
    role: user.role,
    canonical,
    fixture: adminNextFixtureTodayAdapter,
  });
  if (selection.kind === "legacy_fallback") redirect(selection.href);
  const result = await selection.adapter.load();
  const params = await searchParams;

  return (
    <AdminNextToday
      locale={user.interfaceLanguage}
      source={result.source}
      tasks={result.value}
      view={parseAdminNextTodayView(params.view)}
    />
  );
}
