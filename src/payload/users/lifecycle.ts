import { Forbidden } from "payload";

type UserData = {
  active?: boolean | null;
  sessions?: unknown[] | null;
};

export function roleForNewAccount(options: {
  existingUsers: number;
  requestedRole?: string | null;
}): "admin" | "worker" {
  if (options.existingUsers === 0) return "admin";
  return options.requestedRole === "admin" ? "admin" : "worker";
}

export function revokeSessionsWhenDeactivated<T extends UserData>(data: T): T {
  if (data.active !== false) return data;
  return { ...data, sessions: [] };
}

export function assertUserMayLogin(user: UserData) {
  if (user.active !== true) {
    throw new Forbidden();
  }
}

export function removesActiveAdmin(
  original: UserData & { role?: string | null },
  next: UserData & { role?: string | null },
) {
  const nextRole = next.role ?? original.role;
  const nextActive = next.active ?? original.active;
  return (
    original.role === "admin" &&
    original.active === true &&
    (nextRole !== "admin" || nextActive !== true)
  );
}

export function assertAnotherAdminRemains(otherActiveAdmins: number) {
  if (otherActiveAdmins < 1) throw new Forbidden();
}
