import { notFound, redirect } from "next/navigation";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import { loadAdminNextCaseWorkspace } from "@/lib/admin-next/case-workspace-contract";
import { adminNextFixtureCaseWorkspaceAdapter } from "@/lib/admin-next/case-workspace-fixture";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
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
  const access = resolveAdminNextPreviewAccess(rollout, "caseWorkspace");
  if (access.kind === "legacy_fallback") redirect(access.href);

  const { caseId } = await params;
  const result = await loadAdminNextCaseWorkspace(
    adminNextFixtureCaseWorkspaceAdapter,
    caseId,
  );

  if (result.status === "not_found") notFound();

  return <AdminNextCaseWorkspace locale={user.interfaceLanguage} value={result.value} />;
}
