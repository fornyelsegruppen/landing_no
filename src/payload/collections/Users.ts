import type { CollectionConfig } from "payload";
import { adminOnly, userIsAdmin } from "../access/roles";
import {
  assertUserMayLogin,
  assertAnotherAdminRemains,
  removesActiveAdmin,
  revokeSessionsWhenDeactivated,
  roleForNewAccount,
} from "../users/lifecycle";

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    maxLoginAttempts: 5,
    tokenExpiration: 60 * 60 * 8,
    useSessions: true,
  },
  labels: { singular: "Ansatt", plural: "Ansatte" },
  admin: {
    group: "Ansatte",
    useAsTitle: "email",
    defaultColumns: ["displayName", "email", "role", "active", "updatedAt"],
    description:
      "Opprett egne kontoer for ansatte. Deaktivering avslutter aktive sesjoner.",
  },
  access: {
    admin: ({ req }) => userIsAdmin(req.user),
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  hooks: {
    beforeLogin: [({ user }) => assertUserMayLogin(user)],
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        let nextData = data;
        if (operation === "create") {
          const existing = await req.payload.count({ collection: "users" });
          nextData = {
            ...nextData,
            active: true,
            role: roleForNewAccount({
              existingUsers: existing.totalDocs,
              requestedRole:
                typeof nextData.role === "string" ? nextData.role : null,
            }),
          };
        }
        if (
          operation === "update" &&
          originalDoc &&
          removesActiveAdmin(originalDoc, nextData)
        ) {
          const others = await req.payload.count({
            collection: "users",
            where: {
              and: [
                { id: { not_equals: originalDoc.id } },
                { role: { equals: "admin" } },
                { active: { equals: true } },
              ],
            },
          });
          assertAnotherAdminRemains(others.totalDocs);
        }
        return revokeSessionsWhenDeactivated(nextData);
      },
    ],
  },
  fields: [
    {
      name: "displayName",
      type: "text",
      label: "Navn",
      admin: { description: "Navnet som vises i arbeidsoversikten." },
    },
    {
      name: "phone",
      type: "text",
      label: "Telefon",
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "worker",
      saveToJWT: true,
      options: [
        { label: "Administrator", value: "admin" },
        { label: "Ansatt", value: "worker" },
      ],
    },
    {
      name: "active",
      type: "checkbox",
      label: "Aktiv konto",
      required: true,
      defaultValue: true,
      saveToJWT: true,
      admin: {
        description:
          "Slå av for å stanse innlogging og tilbakekalle aktive sesjoner.",
      },
    },
  ],
};
