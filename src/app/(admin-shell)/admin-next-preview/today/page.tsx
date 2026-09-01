import { AdminNextToday } from "@/components/admin-next/admin-next-today";
import { parseAdminNextTodayView } from "@/lib/admin-next/today-fixture";
import { requireAdminUser } from "@/lib/auth/internal-session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminNextTodayPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdminUser();
  const params = await searchParams;

  return (
    <AdminNextToday
      locale={user.interfaceLanguage}
      view={parseAdminNextTodayView(params.view)}
    />
  );
}
