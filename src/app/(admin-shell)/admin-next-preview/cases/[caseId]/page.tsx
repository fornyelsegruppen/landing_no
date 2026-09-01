import { notFound, redirect } from "next/navigation";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import { loadAdminNextCaseWorkspace } from "@/lib/admin-next/case-workspace-contract";
import { adminNextFixtureCaseWorkspaceAdapter } from "@/lib/admin-next/case-workspace-fixture";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";

type Params = Promise<{ caseId: string }>;

export default async function AdminNextCaseWorkspacePage({
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

  const { caseId } = await params;
  const result = await loadAdminNextCaseWorkspace(
    adminNextFixtureCaseWorkspaceAdapter,
    caseId,
  );

  if (result.status === "not_found") notFound();

  return <AdminNextCaseWorkspace locale={user.interfaceLanguage} value={result.value} />;
}
