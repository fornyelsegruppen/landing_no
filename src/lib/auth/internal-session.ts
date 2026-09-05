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
import { adminAccessDecision } from "@/lib/admin-v2/access";
import { adminNextPreviewWorkQueueEntry } from "@/lib/admin-next/work-queue-navigation";

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

export function adminLoginHref(
  input: {
    environment?: Pick<NodeJS.ProcessEnv, "VERCEL_ENV">;
    returnTo?: string;
  } = {},
) {
  const environment = input.environment ?? process.env;
  const returnTo =
    environment.VERCEL_ENV === "preview" &&
    input.returnTo === adminNextPreviewWorkQueueEntry
      ? adminNextPreviewWorkQueueEntry
      : "/admin-v2";
  return `/admin/login?redirect=${encodeURIComponent(returnTo)}`;
}

export async function requireAdminUser(options?: { loginReturnTo?: string }) {
  const user = await getInternalUser();
  const decision = adminAccessDecision(user);
  if (decision === "login") {
    redirect(adminLoginHref({ returnTo: options?.loginReturnTo }));
  }
  if (decision === "worker-portal") redirect("/user");
  if (!user) throw new Error("Unreachable admin access state");
  return user;
}
