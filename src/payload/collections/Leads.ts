import type { CollectionConfig } from "payload";
import { adminOnly, adminOnlyField, adminsAndEditors } from "../access/roles";

const adminManagedField = {
  update: adminOnlyField,
};

export const Leads: CollectionConfig = {
  slug: "leads",
  labels: { singular: "Henvendelse", plural: "Henvendelser" },
  admin: {
    group: "Henvendelser",
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "phone",
      "postal",
      "inquiryType",
      "utmSource",
      "utmCampaign",
      "language",
      "createdAt",
    ],
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminsAndEditors,
    update: adminsAndEditors,
  },
  fields: [
    { name: "name", type: "text", required: true, access: adminManagedField },
    { name: "email", type: "email", access: adminManagedField },
    { name: "phone", type: "text", access: adminManagedField },
    {
      name: "address",
      type: "text",
      required: true,
      access: adminManagedField,
    },
    { name: "houseNumber", type: "text", access: adminManagedField },
    { name: "postal", type: "text", required: true, access: adminManagedField },
    { name: "city", type: "text", access: adminManagedField },
    { name: "approxSqm", type: "number", access: adminManagedField },
    {
      name: "photoUrls",
      type: "textarea",
      access: adminManagedField,
      admin: {
        description:
          "Lead photos from the website form. Previews work in admin; direct Blob links are private.",
        components: {
          Field: "/components/LeadPhotoUrlsField#LeadPhotoUrlsField",
        },
      },
    },
    {
      name: "inquiryType",
      type: "select",
      required: true,
      access: adminManagedField,
      options: [
        { label: "Takvask", value: "takvask" },
        {
          label: "Takvask + impregnering",
          value: "takvask_impregnering",
        },
        { label: "Impregnering", value: "impregnering" },
        { label: "Takmaling", value: "takmaling" },
        { label: "Nytt tak", value: "nytt_tak" },
        { label: "Usikker – taksjekk", value: "usikker" },
        // legacy values (existing leads)
        { label: "Renewal (legacy)", value: "vedlikehold" },
        { label: "Cladding (legacy)", value: "kledning" },
      ],
    },
    { name: "message", type: "textarea", access: adminManagedField },
    {
      name: "language",
      type: "select",
      required: true,
      access: adminManagedField,
      options: [
        { label: "Norwegian", value: "no" },
        { label: "English", value: "en" },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      options: [
        { label: "New", value: "new" },
        { label: "Contacted", value: "contacted" },
        { label: "Qualified", value: "qualified" },
        { label: "Closed", value: "closed" },
      ],
    },
    {
      name: "consentAt",
      type: "date",
      access: adminManagedField,
      admin: {
        readOnly: true,
        description: "When the visitor accepted the privacy consent checkbox.",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "consentText",
      type: "textarea",
      access: adminManagedField,
      admin: {
        readOnly: true,
        description: "Exact consent label shown at submit time.",
      },
    },
    {
      type: "collapsible",
      label: "Advertising attribution",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "utmSource",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "utmMedium",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "utmCampaign",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "utmContent",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "utmTerm",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "gclid",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "gbraid",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "wbraid",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "fbclid",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "msclkid",
          type: "text",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "landingPage",
          type: "textarea",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "contentSourcePath",
          type: "text",
          label: "Article attribution",
          access: adminManagedField,
          admin: {
            readOnly: true,
            description: "Last blog article CTA used before this inquiry.",
          },
        },
        {
          name: "referrer",
          type: "textarea",
          access: adminManagedField,
          admin: { readOnly: true },
        },
        {
          name: "marketingConsent",
          type: "select",
          access: adminManagedField,
          admin: { readOnly: true },
          options: [
            { label: "Granted", value: "granted" },
            { label: "Denied", value: "denied" },
            { label: "Unknown", value: "unknown" },
          ],
        },
      ],
    },
  ],
};
