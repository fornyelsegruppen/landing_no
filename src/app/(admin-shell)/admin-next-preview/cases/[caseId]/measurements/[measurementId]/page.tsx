import { notFound, redirect } from "next/navigation";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";
import { adminNextFixtureR4Adapter } from "@/lib/admin-next/r4-read-adapter";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";

type Params = Promise<{ caseId: string; measurementId: string }>;

export default async function AdminNextR4MeasurementPage({
  params,
}: {
  params: Params;
}) {
  const user = await requireAdminUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "roofWorkbench");
  if (access.kind === "legacy_fallback") redirect(access.href);

  const { caseId, measurementId } = await params;
  const selection = resolveAdminNextServerRead({
    moduleId: "roofWorkbench",
    rollout,
    role: user.role,
    canonical: undefined,
    fixture: adminNextFixtureR4Adapter,
  });
  if (selection.kind === "legacy_fallback") redirect(selection.href);
  const result = await selection.adapter.load(caseId, measurementId);

  if (result.status === "not_found") notFound();

  return (
    <AdminNextR4MeasurementReview
      caseReference={caseId}
      customer={adminNextCaseWorkspaceFixture.customer}
      locale={user.interfaceLanguage}
      measurement={result.value}
    />
  );
}
