import { notFound } from "next/navigation";
import { AdminNextRoofFusionUatControl } from "@/components/admin-next/admin-next-roof-fusion-uat-control";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";

export default async function AdminNextRoofFusionUatPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();

  const user = await requireAdminUser();
  const access = resolveAdminNextPreviewAccess(
    buildAdminNextRolloutView(),
    "roofWorkbench",
  );
  if (access.kind !== "allow_preview") notFound();

  return (
    <AdminNextRoofFusionUatControl
      defaultCaseReference="TF-13"
      locale={user.interfaceLanguage}
    />
  );
}
