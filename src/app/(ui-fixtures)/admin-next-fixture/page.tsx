import { notFound } from "next/navigation";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { AdminNextToday } from "@/components/admin-next/admin-next-today";
import { parseAdminNextTodayView } from "@/lib/admin-next/today-fixture";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminNextVisualFixture({ searchParams }: { searchParams: SearchParams }) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }
  const params = await searchParams;

  return (
    <AdminNextShell displayName="Demo administratorius" locale="lt">
      <AdminNextToday locale="lt" view={parseAdminNextTodayView(params.view)} />
    </AdminNextShell>
  );
}
