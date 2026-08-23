import type { GlobalConfig } from "payload";
import { adminsAndEditors, authenticatedOrPublished } from "../access/roles";
import { pageCopyTabs } from "../fields/page-copy-fields";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Site Settings",
  admin: {
    group: "Innstillinger",
    description:
      "Edit website contact info, images, prices, and all page texts (NO/EN). Upload photos in Media first, then select them under Images.",
  },
  access: {
    read: authenticatedOrPublished,
    readVersions: adminsAndEditors,
    update: adminsAndEditors,
  },
  versions: {
    drafts: true,
    max: 20,
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Contact",
          fields: [
            { name: "brandName", type: "text", defaultValue: "Takfornyelse" },
            { name: "phone", type: "text", defaultValue: "+47 47 73 58 88" },
            {
              name: "email",
              type: "email",
              defaultValue: "post@takfornyelse.as",
            },
            { name: "street", type: "text", defaultValue: "Lyngveien 28" },
            { name: "postal", type: "text", defaultValue: "1182" },
            { name: "city", type: "text", defaultValue: "Oslo" },
            { name: "orgNr", type: "text", defaultValue: "916 693 168" },
            {
              name: "parentOrg",
              type: "text",
              defaultValue: "Fornyelse Gruppen AS",
            },
          ],
        },
        {
          label: "Navigation",
          description:
            "Optional menu builder. When no items are added, the website keeps its built-in menu.",
          fields: [
            {
              name: "navItems",
              type: "array",
              labels: { singular: "Menu item", plural: "Menu items" },
              admin: { initCollapsed: true },
              fields: [
                {
                  name: "labelNo",
                  type: "text",
                  label: "Label (NO)",
                  required: true,
                },
                {
                  name: "labelEn",
                  type: "text",
                  label: "Label (EN)",
                  required: true,
                },
                {
                  name: "href",
                  type: "text",
                  label: "Link",
                  required: true,
                  admin: { description: "Example: /#tjenester or /personvern" },
                },
                {
                  name: "visible",
                  type: "checkbox",
                  label: "Visible",
                  defaultValue: true,
                },
              ],
            },
          ],
        },
        {
          label: "Images",
          description:
            "Upload in Media, then select here. URL fields are fallback only.",
          fields: [
            {
              name: "logo",
              type: "upload",
              relationTo: "media",
              label: "Logo",
            },
            {
              name: "heroImage",
              type: "upload",
              relationTo: "media",
              label: "Hero image",
            },
            {
              name: "aboutImage",
              type: "upload",
              relationTo: "media",
              label: "About image",
            },
            {
              name: "newRoofImage",
              type: "upload",
              relationTo: "media",
              label: "New roof image",
            },
            {
              name: "heroImageUrl",
              type: "text",
              label: "Hero image URL (fallback)",
            },
            {
              name: "aboutImageUrl",
              type: "text",
              label: "About image URL (fallback)",
            },
            {
              name: "newRoofImageUrl",
              type: "text",
              label: "New roof image URL (fallback)",
            },
          ],
        },
        {
          label: "Testimonials",
          description:
            "Structured testimonials. If empty, the legacy testimonial text fields remain in use.",
          fields: [
            {
              name: "testimonialsItems",
              type: "array",
              labels: { singular: "Testimonial", plural: "Testimonials" },
              admin: { initCollapsed: true },
              fields: [
                { name: "quoteNo", type: "textarea", label: "Quote (NO)" },
                { name: "quoteEn", type: "textarea", label: "Quote (EN)" },
                { name: "authorNo", type: "text", label: "Author (NO)" },
                { name: "authorEn", type: "text", label: "Author (EN)" },
                { name: "serviceNo", type: "text", label: "Service (NO)" },
                { name: "serviceEn", type: "text", label: "Service (EN)" },
              ],
            },
          ],
        },
        {
          label: "SEO & schema",
          description: "Structured business data used by search engines.",
          fields: [
            {
              name: "areaServedNo",
              type: "textarea",
              label: "Service area (NO)",
              defaultValue:
                "Oslo, Viken, Innlandet, Vestfold og Telemark, Agder, Rogaland, Vestland, Møre og Romsdal og Trøndelag",
            },
            {
              name: "areaServedEn",
              type: "textarea",
              label: "Service area (EN)",
              defaultValue:
                "Oslo, Viken, Innlandet, Vestfold og Telemark, Agder, Rogaland, Vestland, Møre og Romsdal and Trøndelag",
            },
            {
              name: "openingDays",
              type: "text",
              label: "Opening days (schema.org names, comma-separated)",
              defaultValue: "Monday, Tuesday, Wednesday, Thursday, Friday",
            },
            {
              name: "openingTime",
              type: "text",
              label: "Opening time",
              defaultValue: "08:00",
            },
            {
              name: "closingTime",
              type: "text",
              label: "Closing time",
              defaultValue: "16:00",
            },
          ],
        },
        {
          label: "Calculator & trust",
          fields: [
            {
              name: "calculator",
              type: "group",
              fields: [
                { name: "newRoofPerSqm", type: "number", defaultValue: 2500 },
                {
                  name: "renewalPerSqm",
                  type: "number",
                  defaultValue: 421.25,
                },
                { name: "minSqm", type: "number", defaultValue: 50 },
                { name: "maxSqm", type: "number", defaultValue: 500 },
                { name: "defaultSqm", type: "number", defaultValue: 150 },
              ],
            },
            {
              name: "trust",
              type: "group",
              fields: [
                {
                  name: "sqmRenewed",
                  type: "text",
                  defaultValue: "2.000.000+",
                  admin: { hidden: true },
                },
                {
                  name: "warrantyYears",
                  type: "number",
                  defaultValue: 10,
                  admin: { hidden: true },
                },
                { name: "happyCustomers", type: "text", defaultValue: "100+" },
                { name: "rating", type: "text", defaultValue: "Google" },
              ],
            },
          ],
        },
        {
          label: "Privacy & retention",
          description:
            "Privacy policy page (/personvern) and how long leads/photos are kept.",
          fields: [
            {
              name: "privacyTitleNo",
              type: "text",
              label: "Privacy title (NO)",
            },
            {
              name: "privacyTitleEn",
              type: "text",
              label: "Privacy title (EN)",
            },
            {
              name: "privacyBodyNo",
              type: "textarea",
              label: "Privacy body (NO, Markdown)",
            },
            {
              name: "privacyBodyEn",
              type: "textarea",
              label: "Privacy body (EN, Markdown)",
            },
            {
              name: "privacyLinkNo",
              type: "text",
              label: "Footer privacy link label (NO)",
            },
            {
              name: "privacyLinkEn",
              type: "text",
              label: "Footer privacy link label (EN)",
            },
            {
              name: "consentLabelNo",
              type: "textarea",
              label: "Form consent checkbox (NO)",
            },
            {
              name: "consentLabelEn",
              type: "textarea",
              label: "Form consent checkbox (EN)",
            },
            {
              name: "retentionMonths",
              type: "number",
              label: "Lead retention (months)",
              defaultValue: 24,
              min: 1,
              max: 120,
              admin: {
                description:
                  "Cron deletes leads and their private photos older than this.",
              },
            },
          ],
        },
        ...pageCopyTabs,
      ],
    },
  ],
};
