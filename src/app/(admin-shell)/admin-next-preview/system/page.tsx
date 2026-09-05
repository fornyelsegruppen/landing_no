import { PlatformHealthPanel } from "@/components/admin-v2/platform-health-panel";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";
import {
  buildPlatformHealth,
  loadOperationalHealth,
} from "@/lib/platform/health";
import { buildReleaseGate } from "@/lib/platform/release-gate";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const user = await requireAdminUser();
  const payload = await getPayload();
  const operational = await loadOperationalHealth(payload);

  return (
    <PlatformHealthPanel
      headingLevel="h1"
      health={buildPlatformHealth()}
      locale={user.interfaceLanguage}
      operational={operational}
      releaseGate={buildReleaseGate()}
      rollout={buildAdminNextRolloutView()}
    />
  );
}
