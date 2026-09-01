import { notFound, redirect } from "next/navigation";
import { AdminNextR4MeasurementReview } from "@/components/admin-next/admin-next-r4-measurement-review";
import { loadAdminNextCaseWorkspace } from "@/lib/admin-next/case-workspace-contract";
import { adminNextFixtureCaseWorkspaceAdapter } from "@/lib/admin-next/case-workspace-fixture";
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
  const caseModule = rollout.modules.find(({ id }) => id === "caseWorkspace");

  if (rollout.state !== "preview" || caseModule?.state !== "preview_ready") {
    redirect(caseModule?.legacyHref || "/admin-v2/cases");
  }

  const { caseId, measurementId } = await params;
  const result = await loadAdminNextCaseWorkspace(
    adminNextFixtureCaseWorkspaceAdapter,
    caseId,
  );

  if (result.status === "not_found") notFound();
  const measurement = result.value.measurementReview;
  if (!measurement || measurement.reference !== measurementId) notFound();

  return (
    <AdminNextR4MeasurementReview
      caseReference={result.value.reference}
      customer={result.value.customer}
      locale={user.interfaceLanguage}
      measurement={measurement}
    />
  );
}

