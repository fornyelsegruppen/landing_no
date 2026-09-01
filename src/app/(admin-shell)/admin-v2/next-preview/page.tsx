import { AdminNextCapabilityBoard } from "@/components/admin-next/admin-next-capability-board";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";

export const dynamic = "force-dynamic";

export default async function AdminNextPreviewPage() {
  const user = await requireAdminUser();

  return (
    <AdminNextCapabilityBoard
      locale={user.interfaceLanguage}
      rollout={buildAdminNextRolloutView()}
    />
  );
}
