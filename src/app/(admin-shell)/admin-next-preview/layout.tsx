import { redirect } from "next/navigation";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { adminNextPreviewWorkQueueEntry } from "@/lib/admin-next/work-queue-navigation";
import { requireAdminUser } from "@/lib/auth/internal-session";

export const dynamic = "force-dynamic";

export default async function AdminNextLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser({
    loginReturnTo: adminNextPreviewWorkQueueEntry,
  });
  const rollout = buildAdminNextRolloutView();
  if (rollout.state === "legacy") redirect("/admin-v2/next-preview");

  return (
    <AdminNextShell
      displayName={user.displayName || user.email}
      locale={user.interfaceLanguage}
      mode="preview"
    >
      {children}
    </AdminNextShell>
  );
}
