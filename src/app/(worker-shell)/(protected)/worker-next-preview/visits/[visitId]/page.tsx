import { notFound, redirect } from "next/navigation";
import { AdminNextFieldVisit } from "@/components/admin-next/admin-next-field-visit";
import {
  loadAdminNextFieldVisit,
  parseAdminNextFieldVisitState,
} from "@/lib/admin-next/field-visit-contract";
import { adminNextFixtureFieldVisitAdapter } from "@/lib/admin-next/field-visit-fixture";
import { resolveAdminNextPreviewAccess } from "@/lib/admin-next/preview-access";
import { buildAdminNextRolloutView } from "@/lib/admin-next/rollout-view";
import { requireInternalUser } from "@/lib/auth/internal-session";

type Params = Promise<{ visitId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminNextWorkerVisitPreviewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireInternalUser();
  const rollout = buildAdminNextRolloutView();
  const access = resolveAdminNextPreviewAccess(rollout, "fieldVisit", "worker");
  if (access.kind === "legacy_fallback") redirect(access.href);

  const [{ visitId }, query] = await Promise.all([params, searchParams]);
  const state = parseAdminNextFieldVisitState(query.state);
  const result = await loadAdminNextFieldVisit(
    adminNextFixtureFieldVisitAdapter,
    visitId,
    state,
  );
  if (result.status === "not_found") notFound();

  return (
    <AdminNextFieldVisit
      locale={user.interfaceLanguage}
      stateHrefBase={`/worker-next-preview/visits/${result.value.reference}`}
      visit={result.value}
    />
  );
}
