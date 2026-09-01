import { notFound, redirect } from "next/navigation";
import { AdminNextDocumentPreflight } from "@/components/admin-next/admin-next-document-preflight";
import { loadAdminNextCaseWorkspace } from "@/lib/admin-next/case-workspace-contract";
import { adminNextFixtureCaseWorkspaceAdapter } from "@/lib/admin-next/case-workspace-fixture";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireAdminUser } from "@/lib/auth/internal-session";

type Params = Promise<{ caseId: string }>;

export default async function AdminNextDocumentPreflightPage({
  params,
}: {
  params: Params;
}) {
  const user = await requireAdminUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "documentPreflight");
  if (access.kind === "legacy_fallback") redirect(access.href);

  const { caseId } = await params;
  const result = await loadAdminNextCaseWorkspace(
    adminNextFixtureCaseWorkspaceAdapter,
    caseId,
  );
  if (result.status === "not_found") notFound();

  const preflight = result.value.documentPreflight;
  const measurement = result.value.measurementReview;
  if (!preflight || !measurement) notFound();

  return (
    <AdminNextDocumentPreflight
      caseReference={result.value.reference}
      customer={result.value.customer}
      locale={user.interfaceLanguage}
      measurementFallbackHref={measurement.fallbackHref}
      preflight={preflight}
    />
  );
}
