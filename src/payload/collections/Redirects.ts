import type { CollectionConfig } from "payload";
import { adminOnly, authenticated } from "../access/roles";

function validateInternalPath(
  value: string | null | undefined,
): true | string {
  if (!value) return true;
  if (value !== value.trim()) return "Path cannot start or end with spaces";
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "Use an internal path beginning with one slash";
  }
  if (/[?#]/.test(value)) return "Path cannot contain a query string or hash";
  if (value.length > 1 && value.endsWith("/")) {
    return "Omit the trailing slash";
  }
  return true;
}

export const Redirects: CollectionConfig = {
  slug: "redirects",
  admin: {
    group: "Innstillinger",
    useAsTitle: "fromPath",
    defaultColumns: ["fromPath", "toPath", "toUrl", "permanent"],
    description:
      "Redirects are currently resolved for CMS page slugs and blog post routes.",
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: authenticated,
    update: adminOnly,
  },
  fields: [
    {
      name: "fromPath",
      type: "text",
      required: true,
      unique: true,
      index: true,
      validate: validateInternalPath,
      admin: {
        description:
          "Locale-specific (/no/gammel) or locale-neutral (/gammel) source path.",
      },
    },
    {
      name: "toPath",
      type: "text",
      label: "Destination path",
      validate: (
        value: string | null | undefined,
        { siblingData }: { siblingData: { toUrl?: string | null } },
      ) => {
        const hasPath = Boolean(value);
        const hasUrl = Boolean(siblingData?.toUrl);
        if (hasPath === hasUrl) {
          return "Set exactly one destination: path or external URL";
        }
        return validateInternalPath(value);
      },
      admin: {
        description: "Internal destination beginning with /.",
      },
    },
    {
      name: "toUrl",
      type: "text",
      label: "External destination URL",
      validate: (value: string | null | undefined) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:"
            ? true
            : "External URL must use http or https";
        } catch {
          return "Enter a valid absolute URL";
        }
      },
    },
    {
      name: "permanent",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "Permanent redirects use HTTP 308; temporary ones use 307.",
      },
    },
  ],
};
