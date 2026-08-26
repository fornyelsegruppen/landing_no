import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";

const customerEvidenceFields = [
  "lead",
  "quote",
  "contract",
  "workOrder",
  "kind",
  "reasonCode",
  "reasonText",
  "followUpConsent",
  "preferredFollowUp",
  "preferredFollowUpAt",
  "receivedAt",
  "contractSignedAt",
  "companySignedAt",
  "nominalWithdrawalDeadline",
  "withinNominalWithdrawalPeriod",
  "earlyStartRequested",
  "workStatusAtReceipt",
  "depositStatusAtReceipt",
  "sourceMessage",
  "requestFingerprint",
] as const;

export const protectCustomerContractRequest: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation === "create") return data;
  if (!originalDoc) return data;
  const changedEvidence = customerEvidenceFields.some(
    (field) => field in data && JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]),
  );
  if (changedEvidence) throw new Error("Customer-submitted contract request evidence is immutable");
  return data;
};

export const CustomerContractRequests: CollectionConfig = {
  slug: "customer-contract-requests",
  defaultSort: "-receivedAt",
  labels: { singular: "Angre- eller endringsmelding", plural: "Angre- og endringsmeldinger" },
  admin: {
    group: "Henvendelser",
    useAsTitle: "reference",
    defaultColumns: ["reference", "lead", "kind", "reasonCode", "status", "recoveryPotential", "receivedAt"],
    description: "Strukturerte, tidsstemplete kundemeldinger om angrerett, endring eller kansellering.",
  },
  access: { create: adminOnly, delete: () => false, read: adminOnly, update: adminOnly },
  hooks: { beforeChange: [protectCustomerContractRequest] },
  fields: [
    { name: "reference", type: "text", required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: "lead", type: "relationship", relationTo: "leads", required: true, index: true, admin: { readOnly: true } },
    { name: "quote", type: "relationship", relationTo: "quotes", required: true, index: true, admin: { readOnly: true } },
    { name: "contract", type: "relationship", relationTo: "contracts", required: true, index: true, admin: { readOnly: true } },
    { name: "workOrder", type: "relationship", relationTo: "work-orders", index: true, admin: { readOnly: true } },
    { name: "kind", type: "select", required: true, index: true, admin: { readOnly: true }, options: [
      { label: "Bruk av angrerett", value: "withdrawal" },
      { label: "Endring eller kansellering", value: "change_or_cancel" },
    ] },
    { name: "reasonCode", type: "select", required: true, index: true, admin: { readOnly: true }, options: [
      { label: "Prisen passer ikke", value: "price" },
      { label: "Vil vente / ikke nå", value: "wait" },
      { label: "Tidspunktet passer ikke", value: "timing" },
      { label: "Valgte en annen leverandør", value: "other_supplier" },
      { label: "Omfanget passer ikke", value: "scope" },
      { label: "Trenger mer informasjon", value: "need_information" },
      { label: "Personlige eller økonomiske årsaker", value: "personal_financial" },
      { label: "Kommunikasjonen fungerte ikke", value: "communication" },
      { label: "Tjenesten er ikke lenger nødvendig", value: "not_needed" },
      { label: "Annen årsak", value: "other" },
      { label: "Ønsker ikke å oppgi årsak", value: "prefer_not_to_say" },
    ] },
    { name: "reasonText", type: "textarea", maxLength: 2_000, admin: { readOnly: true } },
    { name: "followUpConsent", type: "checkbox", required: true, defaultValue: false, admin: { readOnly: true } },
    { name: "preferredFollowUp", type: "select", admin: { readOnly: true }, options: [
      { label: "Om 1 måned", value: "one_month" },
      { label: "Om 3 måneder", value: "three_months" },
      { label: "Om 6 måneder", value: "six_months" },
      { label: "Neste vår", value: "next_spring" },
      { label: "Egendefinert dato", value: "custom" },
      { label: "Ikke kontakt igjen", value: "never" },
    ] },
    { name: "preferredFollowUpAt", type: "date", index: true, admin: { readOnly: true } },
    { name: "status", type: "select", required: true, defaultValue: "received", index: true, options: [
      { label: "Mottatt", value: "received" },
      { label: "Til administratorvurdering", value: "admin_review" },
      { label: "Alternativt tilbud ønsket", value: "alternative_requested" },
      { label: "Oppfølging planlagt", value: "follow_up_scheduled" },
      { label: "Kunden beholdt", value: "recovered" },
      { label: "Avsluttet", value: "closed" },
      { label: "Ikke kontakt", value: "do_not_contact" },
    ] },
    { name: "recoveryPotential", type: "select", required: true, defaultValue: "yellow", index: true, options: [
      { label: "Grønn – kunden tillater oppfølging", value: "green" },
      { label: "Gul – må vurderes", value: "yellow" },
      { label: "Rød – ikke kontakt", value: "red" },
    ] },
    { name: "receivedAt", type: "date", required: true, index: true, admin: { readOnly: true } },
    { name: "contractSignedAt", type: "date", admin: { readOnly: true } },
    { name: "companySignedAt", type: "date", admin: { readOnly: true } },
    { name: "nominalWithdrawalDeadline", type: "date", admin: { readOnly: true } },
    { name: "withinNominalWithdrawalPeriod", type: "checkbox", admin: { readOnly: true } },
    { name: "earlyStartRequested", type: "checkbox", admin: { readOnly: true } },
    { name: "workStatusAtReceipt", type: "text", admin: { readOnly: true } },
    { name: "depositStatusAtReceipt", type: "text", admin: { readOnly: true } },
    { name: "sourceMessage", type: "relationship", relationTo: "messages", required: true, admin: { readOnly: true } },
    { name: "requestFingerprint", type: "text", required: true, unique: true, index: true, admin: { hidden: true } },
    { name: "administratorDecision", type: "textarea", maxLength: 2_000 },
    { name: "reviewedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "reviewedAt", type: "date", admin: { readOnly: true } },
    { name: "followUpAt", type: "date", index: true },
    { name: "followUpAttempts", type: "number", min: 0, defaultValue: 0 },
    { name: "followUpOutcome", type: "textarea", maxLength: 2_000 },
    { name: "closedAt", type: "date", admin: { readOnly: true } },
    { name: "aiSummary", type: "textarea", maxLength: 2_000, admin: { readOnly: true } },
    { name: "aiSuggestedAction", type: "textarea", maxLength: 2_000, admin: { readOnly: true } },
  ],
};
