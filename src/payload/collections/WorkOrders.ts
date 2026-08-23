import type { CollectionConfig } from "payload";
import {
  adminOnly,
  assignedWorkerOrAdmin,
  userIsAdmin,
} from "../access/roles";

export const WorkOrders: CollectionConfig = {
  slug: "work-orders",
  labels: { singular: "Oppdrag", plural: "Arbeid" },
  admin: {
    group: "Arbeid",
    useAsTitle: "reference",
    defaultColumns: [
      "reference",
      "assignedWorker",
      "scheduledAt",
      "status",
      "updatedAt",
    ],
    description:
      "Grunnskall for tildelte oppdrag. Arbeidsflyt og dokumentasjon utvides i arbeidsordrefasen.",
  },
  access: {
    admin: ({ req }) => userIsAdmin(req.user),
    create: adminOnly,
    delete: adminOnly,
    read: assignedWorkerOrAdmin,
    update: adminOnly,
  },
  fields: [
    {
      name: "reference",
      type: "text",
      label: "Referanse",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "lead",
      type: "relationship",
      relationTo: "leads",
      label: "Henvendelse",
      index: true,
    },
    {
      name: "assignedWorker",
      type: "relationship",
      relationTo: "users",
      label: "Tildelt ansatt",
      index: true,
      filterOptions: {
        and: [
          { role: { equals: "worker" } },
          { active: { equals: true } },
        ],
      },
    },
    {
      name: "scheduledAt",
      type: "date",
      label: "Planlagt tidspunkt",
      index: true,
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "status",
      type: "select",
      label: "Status",
      required: true,
      defaultValue: "unassigned",
      index: true,
      options: [
        { label: "Ikke tildelt", value: "unassigned" },
        { label: "Tildelt", value: "assigned" },
        { label: "Planlagt", value: "scheduled" },
      ],
    },
    {
      name: "workSummary",
      type: "textarea",
      label: "Arbeidsbeskrivelse",
    },
  ],
};
