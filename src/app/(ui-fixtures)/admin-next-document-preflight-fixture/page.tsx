import { notFound } from "next/navigation";
import { AdminNextDocumentPreflight } from "@/components/admin-next/admin-next-document-preflight";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

export default function AdminNextDocumentPreflightVisualFixture() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }
  const preflight = adminNextCaseWorkspaceFixture.documentPreflight;
  const measurement = adminNextCaseWorkspaceFixture.measurementReview;
  if (!preflight || !measurement) notFound();

  return (
    <AdminNextShell displayName="Demo administratorius" locale="lt">
      <AdminNextDocumentPreflight
        caseReference={adminNextCaseWorkspaceFixture.reference}
        customer={adminNextCaseWorkspaceFixture.customer}
        locale="lt"
        measurementFallbackHref={measurement.fallbackHref}
        preflight={preflight}
      />
    </AdminNextShell>
  );
}
