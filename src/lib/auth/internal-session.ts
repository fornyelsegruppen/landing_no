import { headers } from "next/headers";
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

  return {
    active: true,
    displayName:
      "displayName" in user && typeof user.displayName === "string"
        ? user.displayName
        : null,
    email: typeof user.email === "string" ? user.email : "",
    id: Number(user.id),
    interfaceLanguage: normalizePanelLocale(
      "interfaceLanguage" in user ? user.interfaceLanguage : null,
    ),
    role,
  };
}

export async function requireInternalUser() {
  const user = await getInternalUser();
  if (!user) redirect("/user/login");
  return user;
}
