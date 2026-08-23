import type { Access, FieldAccess, PayloadRequest } from "payload";

export type UserRole = "admin" | "worker";

type UserWithRole = {
  active?: boolean | null;
  id?: string | number;
  role?: string | null;
};

export function getUserRole(user: PayloadRequest["user"]): UserRole | null {
  if (!user) return null;
  const role = (user as UserWithRole).role;
  return role === "admin" || role === "worker" ? role : null;
}

export function userIsActive(user: PayloadRequest["user"]): boolean {
  return Boolean(user && (user as UserWithRole).active === true);
}

export function userIsAdmin(user: PayloadRequest["user"]): boolean {
  return userIsActive(user) && getUserRole(user) === "admin";
}

export function userIsWorker(user: PayloadRequest["user"]): boolean {
  return userIsActive(user) && getUserRole(user) === "worker";
}

export const userCanEditContent = userIsAdmin;

export const adminOnly: Access = ({ req }) => userIsAdmin(req.user);

export const adminsAndEditors: Access = ({ req }) =>
  userCanEditContent(req.user);

export const authenticated: Access = ({ req }) => userIsActive(req.user);

export const authenticatedOrPublished: Access = ({ req }) => {
  if (userIsActive(req.user)) return true;

  return {
    _status: {
      equals: "published",
    },
  };
};

export const adminOnlyField: FieldAccess = ({ req }) => userIsAdmin(req.user);

export const assignedWorkerOrAdmin: Access = ({ req }) => {
  if (userIsAdmin(req.user)) return true;
  if (!userIsWorker(req.user)) return false;

  return {
    assignedWorker: {
      equals: req.user?.id,
    },
  };
};
