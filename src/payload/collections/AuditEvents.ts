import type { CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

export const AuditEvents: CollectionConfig = {
  slug: "audit-events",
  defaultSort: "-createdAt",
  labels: { singular: "Audit event", plural: "Audit events" },
  admin: {
    group: "Innstillinger",
    useAsTitle: "action",
    defaultColumns: [
      "action",
      "entityType",
      "entityId",
      "correlationId",
      "createdAt",
    ],
    description:
      "Immutable operational audit trail. Sensitive values and raw customer data must not be stored here.",
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "actor",
      type: "relationship",
      relationTo: "users",
      index: true,
    },
    { name: "action", type: "text", required: true, index: true },
    { name: "entityType", type: "text", required: true, index: true },
    { name: "entityId", type: "text", required: true, index: true },
    { name: "correlationId", type: "text", required: true, index: true },
    {
      name: "changedFields",
      type: "json",
      admin: {
        description: "Field names only; never raw before/after values.",
      },
    },
    { name: "beforeHash", type: "text" },
    { name: "afterHash", type: "text" },
    {
      name: "metadata",
      type: "json",
      admin: {
        description:
          "Allow-listed operational identifiers only. No names, addresses, contact details, secrets or tokens.",
      },
    },
  ],
};
