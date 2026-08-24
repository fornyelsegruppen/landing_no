import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPayload } from "@/lib/payload";
import {
  getUserRole,
  userIsActive,
  type UserRole,
} from "@/payload/access/roles";
import {
  normalizePanelLocale,
  type PanelLocale,
} from "@/lib/panel-i18n";
import { adminAccessDecision } from "@/lib/admin-v2/access";

export type InternalUser = {
  active: true;
  displayName?: string | null;
  email: string;
  id: number;
  interfaceLanguage: PanelLocale;
  role: UserRole;
};

export async function getInternalUser(): Promise<InternalUser | null> {
  if (process.env.PAYLOAD_BUILD_WITHOUT_DB === "1") return null;

  const payload = await getPayload();
  const { user } = await payload.auth({ headers: await headers() });
  const role = getUserRole(user);

  if (!user || !role || !userIsActive(user)) return null;

  const cookieStore = await cookies();
  const savedInterfaceLanguage = cookieStore.get("tf_panel_language")?.value;

  return {
    active: true,
    displayName:
      "displayName" in user && typeof user.displayName === "string"
        ? user.displayName
        : null,
    email: typeof user.email === "string" ? user.email : "",
    id: Number(user.id),
    interfaceLanguage: normalizePanelLocale(
      savedInterfaceLanguage ??
        ("interfaceLanguage" in user ? user.interfaceLanguage : null),
    ),
    role,
  };
}

export async function requireInternalUser() {
  const user = await getInternalUser();
  if (!user) redirect("/user/login");
  return user;
}

export async function requireAdminUser() {
  const user = await getInternalUser();
  const decision = adminAccessDecision(user);
  if (decision === "login") redirect("/admin/login?redirect=%2Fadmin-v2");
  if (decision === "worker-portal") redirect("/user");
  if (!user) throw new Error("Unreachable admin access state");
  return user;
}
