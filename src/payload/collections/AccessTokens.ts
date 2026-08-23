import type { CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

export const AccessTokens: CollectionConfig = {
  slug: "access-tokens",
  defaultSort: "-createdAt",
  labels: { singular: "Access token", plural: "Access tokens" },
  admin: {
    group: "System",
    useAsTitle: "purpose",
    defaultColumns: [
      "purpose",
      "subjectType",
      "subjectId",
      "expiresAt",
      "revokedAt",
    ],
    description:
      "Hashed tokens for customer links. Plain-text tokens are never persisted.",
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: () => false,
  },
  fields: [
    { name: "purpose", type: "text", required: true, index: true },
    {
      name: "tokenHash",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    { name: "subjectType", type: "text", required: true, index: true },
    { name: "subjectId", type: "text", required: true, index: true },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "revokedAt", type: "date", index: true },
    { name: "usedAt", type: "date" },
    { name: "singleUse", type: "checkbox", defaultValue: false },
    {
      name: "metadata",
      type: "json",
      admin: {
        description:
          "Non-sensitive operational metadata only. Never store the plain token.",
      },
    },
  ],
};
