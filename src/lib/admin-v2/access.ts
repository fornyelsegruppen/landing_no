import type { InternalUser } from "@/lib/auth/internal-session";

export type AdminAccessDecision = "allow" | "login" | "worker-portal";

export function adminAccessDecision(
  user: Pick<InternalUser, "role"> | null,
): AdminAccessDecision {
  if (!user) return "login";
  return user.role === "admin" ? "allow" : "worker-portal";
}
