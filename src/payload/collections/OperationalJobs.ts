import type { CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

export const OperationalJobs: CollectionConfig = {
  slug: "operational-jobs",
  defaultSort: "-createdAt",
  labels: { singular: "Operational job", plural: "Operational jobs" },
  admin: {
    group: "System",
    useAsTitle: "type",
    defaultColumns: [
      "type",
      "status",
      "attempts",
      "availableAt",
      "correlationId",
      "updatedAt",
    ],
    description:
      "Retryable jobs and outbox operations. Payload must contain IDs, not raw customer data.",
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: "type", type: "text", required: true, index: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Running", value: "running" },
        { label: "Retry", value: "retry" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Requires attention", value: "attention" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      name: "idempotencyKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    { name: "correlationId", type: "text", required: true, index: true },
    { name: "attempts", type: "number", required: true, defaultValue: 0 },
    { name: "maxAttempts", type: "number", required: true, defaultValue: 3 },
    {
      name: "availableAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
    },
    { name: "startedAt", type: "date" },
    { name: "completedAt", type: "date" },
    { name: "lastErrorCode", type: "text" },
    {
      name: "lastErrorMessage",
      type: "textarea",
      maxLength: 500,
      admin: { description: "Sanitized operational message; no raw payload." },
    },
    {
      name: "payload",
      type: "json",
      admin: {
        description:
          "References and non-sensitive job options only. Do not copy lead data here.",
      },
    },
    { name: "result", type: "json" },
  ],
};
