import { notFound, redirect } from "next/navigation";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import { loadAdminNextCaseWorkspace } from "@/lib/admin-next/case-workspace-contract";
import { adminNextFixtureCaseWorkspaceAdapter } from "@/lib/admin-next/case-workspace-fixture";
import { createAdminNextCanonicalCaseWorkspaceAdapter } from "@/lib/admin-next/case-read-adapter";
import { resolveAdminNextServerRead } from "@/lib/admin-next/server-read-resolver";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";
import { getPayload } from "@/lib/payload";

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
  const canonical = process.env.VERCEL_ENV === "preview"
    ? createAdminNextCanonicalCaseWorkspaceAdapter(await getPayload())
    : undefined;
  const selection = resolveAdminNextServerRead({
    moduleId: "caseWorkspace",
    rollout,
    role: user.role,
    canonical,
    fixture: adminNextFixtureCaseWorkspaceAdapter,
  });
  if (selection.kind === "legacy_fallback") redirect(selection.href);
  const result = await loadAdminNextCaseWorkspace(
    selection.adapter,
    caseId,
  );

  if (result.status === "not_found") notFound();

  return <AdminNextCaseWorkspace locale={user.interfaceLanguage} value={result.value} />;
}
