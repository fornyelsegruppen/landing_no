import { notFound } from "next/navigation";
import { AdminNextShell } from "@/components/admin-next/admin-next-shell";
import { AdminSystemCatalog } from "@/components/admin-next/admin-system-catalog";

export default function AdminNextSystemVisualFixture() {
  if (process.env.NODE_ENV === "production" || process.env.ADMIN_NEXT_VISUAL_FIXTURE !== "true") {
    notFound();
  }
  return <AdminNextShell displayName="Demo administratorius" locale="lt" mode="preview"><AdminSystemCatalog /></AdminNextShell>;
}
