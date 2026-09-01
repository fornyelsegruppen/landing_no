import { notFound } from "next/navigation";
import { AdminNextCaseWorkspace } from "@/components/admin-next/admin-next-case-workspace";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { adminNextCaseWorkspaceFixture } from "@/lib/admin-next/case-workspace-fixture";

export default function AdminNextCaseVisualFixture() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true"
  ) {
    notFound();
  }

  return (
    <AdminNextShell displayName="Demo administratorius" locale="lt">
      <AdminNextCaseWorkspace
        locale="lt"
        value={adminNextCaseWorkspaceFixture}
      />
    </AdminNextShell>
  );
}
