import { ControlledPilotBanner } from "@/components/admin-v2/controlled-pilot-banner";
import { AdminNextPreviewNotice } from "@/components/admin-next/admin-next-capability-board";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { buildOperatingMode } from "@/lib/platform/operating-mode";

export const dynamic = "force-dynamic";

export default async function AdminV2Layout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();

  return (
    <AdminNextShell displayName={user.displayName || user.email} locale={user.interfaceLanguage} mode="canonical" notice={<><ControlledPilotBanner locale={user.interfaceLanguage} status={buildOperatingMode()} /><AdminNextPreviewNotice locale={user.interfaceLanguage} rollout={buildAdminNextRolloutView()} /></>}>
      {children}
    </AdminNextShell>
  );
}
