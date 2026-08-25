import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from "payload";
import { deletePrivateMedia } from "@/lib/private-media-storage";
import { adminOnly, adminOnlyField, adminsAndEditors } from "../access/roles";

const adminManagedField = {
  update: adminOnlyField,
};

const caseStateFields = new Set([
  "status", "recordState", "archiveClassification", "archiveReason", "assignedTo",
  "nextAction", "nextActionAt", "nextActionOwner", "nextActionBlocker", "caseRevision",
]);

export const protectCaseStateWrites: CollectionBeforeChangeHook = ({ context, data, operation, originalDoc, req }) => {
  if (operation !== "update" || !originalDoc) return data;
  const actualRevision = Number(originalDoc.caseRevision || 1);
  const requestedRevision = "caseRevision" in data ? Number(data.caseRevision) : null;
  // Payload can drop custom context when a Local API update crosses a
  // serverless bundle boundary. A local, monotonic +1 revision remains an
  // internal command write; REST writes and skipped revisions stay blocked.
  const trustedLocalRevisionWrite = req.payloadAPI === "local"
    && requestedRevision === actualRevision + 1;
  const trustedCaseCommand = context?.trustedCaseCommand === true || trustedLocalRevisionWrite;
  if (context?.trustedCaseCommand === true && typeof context.expectedCaseRevision === "number") {
    if (actualRevision !== context.expectedCaseRevision) {
      throw new Error(`CASE_REVISION_CONFLICT:${context.expectedCaseRevision}:${actualRevision}`);
    }
  }
  if ("caseRevision" in data && !trustedCaseCommand) {
    throw new Error("Case revision is managed by the central case command layer");
  }
  if (process.env.FEATURE_CASE_STATE_ENGINE_V2 !== "true" || trustedCaseCommand) return data;
  const directStateFields = Object.keys(data).filter((key) => caseStateFields.has(key));
  if (directStateFields.length) {
    throw new Error(`Case state fields require the central command layer: ${directStateFields.join(", ")}`);
  }
  return data;
};

export const deleteLeadMessagesBeforeLead: CollectionBeforeDeleteHook = async ({ context, id, req }) => {
  if (context?.trustedLeadPurge !== true) {
    throw new Error("Customer cases must be archived or moved to trash. Permanent deletion is only available through the controlled retention workflow.");
  }
  const quotes = await req.payload.find({ collection: "quotes", depth: 0, limit: 100, overrideAccess: true, req, where: { lead: { equals: id } } });
  for (const quote of quotes.docs) {
    const contracts = await req.payload.find({ collection: "contracts", depth: 0, limit: 100, overrideAccess: true, req, where: { quote: { equals: quote.id } } });
    if (contracts.docs.some((contract) => contract.status === "signed")) {
      throw new Error("A lead with a signed contract must be archived according to the retention policy, not deleted.");
    }
    for (const contract of contracts.docs) {
      const changes = await req.payload.find({ collection: "change-agreements", depth: 0, limit: 100, overrideAccess: true, req, where: { contract: { equals: contract.id } } });
      for (const change of changes.docs) await req.payload.delete({ collection: "change-agreements", id: change.id, overrideAccess: true, req });
      await req.payload.delete({ collection: "contracts", id: contract.id, overrideAccess: true, req });
    }
    await req.payload.update({ collection: "access-tokens", overrideAccess: true, req, where: { and: [{ subjectType: { equals: "quote" } }, { subjectId: { equals: String(quote.id) } }] }, data: { revokedAt: new Date().toISOString() } });
    await req.payload.delete({ collection: "quotes", id: quote.id, overrideAccess: true, req });
  }
  await req.payload.delete({
    collection: "price-calculations",
    overrideAccess: true,
    req,
    where: { lead: { equals: id } },
  });
  await req.payload.delete({
    collection: "roof-measurements",
    overrideAccess: true,
    req,
    where: { lead: { equals: id } },
  });
  await req.payload.delete({
    collection: "messages",
    overrideAccess: true,
    req,
    where: { lead: { equals: id } },
  });
  const privateMedia = await req.payload.find({
    collection: "private-media",
    depth: 0,
    limit: 500,
    overrideAccess: true,
    req,
    where: { and: [{ ownerType: { equals: "lead" } }, { ownerId: { equals: String(id) } }] },
  });
  for (const media of privateMedia.docs) await deletePrivateMedia(req.payload, media);
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
      "status",
      "nextActionAt",
      "assignedTo",
      "createdAt",
    ],
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminsAndEditors,
    update: adminsAndEditors,
  },
  hooks: { beforeChange: [protectCaseStateWrites], beforeDelete: [deleteLeadMessagesBeforeLead] },
  fields: [
    { name: "name", type: "text", required: true, access: adminManagedField },
    { name: "email", type: "email", access: adminManagedField },
    { name: "phone", type: "text", access: adminManagedField },
    {
      name: "preferredChannel",
      type: "select",
      label: "Foretrukket kanal",
      defaultValue: "email",
      options: [
        { label: "E-post", value: "email" },
        { label: "SMS", value: "sms" },
      ],
    },
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
        { label: "Ny", value: "new" },
        { label: "Svarutkast klart", value: "draft_ready" },
        { label: "Kunden venter på svar", value: "customer_waiting" },
        { label: "Venter på kunde", value: "waiting_customer" },
        { label: "Kvalifisert", value: "qualified" },
        { label: "Måling", value: "measuring" },
        { label: "Tilbud", value: "quoted" },
        { label: "Konvertert", value: "converted" },
        { label: "Lukket", value: "closed" },
        { label: "Kontaktet (eldre)", value: "contacted" },
      ],
    },
    {
      name: "recordState",
      type: "select",
      label: "Arkivstatus",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Aktiv", value: "active" },
        { label: "Arkivert", value: "archived" },
        { label: "I papirkurven", value: "trashed" },
      ],
      admin: { readOnly: true },
    },
    {
      name: "archiveClassification",
      type: "select",
      label: "Arkivklassifisering",
      index: true,
      options: [
        { label: "Fullført", value: "completed" },
        { label: "Kunden avslo", value: "declined" },
        { label: "Tapt", value: "lost" },
        { label: "Ugyldig henvendelse", value: "invalid" },
        { label: "Spam", value: "spam" },
        { label: "Duplikat", value: "duplicate" },
        { label: "Annet", value: "other" },
      ],
      admin: { readOnly: true },
    },
    { name: "archiveReason", type: "textarea", label: "Begrunnelse", admin: { readOnly: true } },
    { name: "archivedAt", type: "date", label: "Arkivert", index: true, admin: { readOnly: true } },
    { name: "archivedBy", type: "relationship", relationTo: "users", label: "Arkivert av", admin: { readOnly: true } },
    { name: "trashedAt", type: "date", label: "Flyttet til papirkurven", index: true, admin: { readOnly: true } },
    { name: "trashedBy", type: "relationship", relationTo: "users", label: "Flyttet av", admin: { readOnly: true } },
    { name: "purgeAfter", type: "date", label: "Tidligste permanente sletting", index: true, admin: { readOnly: true } },
    { name: "assignedTo", type: "relationship", relationTo: "users", label: "Ansvarlig", index: true },
    { name: "nextAction", type: "textarea", label: "Neste handling" },
    { name: "nextActionAt", type: "date", label: "Frist", index: true },
    {
      name: "nextActionOwner",
      type: "select",
      label: "Neste handlings eier",
      required: true,
      defaultValue: "administrator",
      index: true,
      options: ["administrator", "customer", "system", "worker"],
      admin: { readOnly: true },
    },
    { name: "nextActionBlocker", type: "text", label: "Blokkeringskode", admin: { readOnly: true } },
    { name: "caseRevision", type: "number", label: "Saksversjon", required: true, defaultValue: 1, min: 1, admin: { readOnly: true } },
    { name: "lastContactAt", type: "date", label: "Sist kontaktet" },
    { name: "adminReviewedAt", type: "date", label: "Først gjennomgått", index: true, admin: { readOnly: true } },
    { name: "adminReviewedBy", type: "relationship", relationTo: "users", label: "Gjennomgått av", admin: { readOnly: true } },
    { name: "closedAt", type: "date", label: "Lukket" },
    { name: "qualification", type: "json", label: "AI-oppsummering (kontrolleres av admin)" },
    {
      name: "workflowActions",
      type: "ui",
      admin: { components: { Field: "/components/LeadWorkflowActions" } },
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
