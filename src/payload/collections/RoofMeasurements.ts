import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import { adminOnly } from "../access/roles";
import { prepareMeasurement } from "@/lib/measurements/proposal";
import { measurementSnapshotHash } from "@/lib/measurements/geometry";
import { verifyMeasurementEvidence } from "@/lib/measurements/persist-evidence";
import {
  assertNorgeIBilderScreenshotEvidence,
  isNorgeIBilderScreenshotSource,
} from "@/lib/measurements/evidence-policy";
import { measurementWorkflowMode } from "@/lib/measurements/workflow-mode";

const lockedFields = [
  "normalizedAddress",
  "latitude",
  "longitude",
  "buildingIdentifier",
  "roofPlanes",
  "source",
  "capturedAt",
  "measurementMode",
  "candidateBuildings",
  "evidenceSnapshot",
  "evidenceHash",
  "evidenceSource",
  "evidenceAttribution",
  "evidenceGeneratedAt",
  "imageryCapturedAt",
  "manualAreaSource",
  "manualAreaReason",
  "sourceKind",
  "caseRevision",
  "addressRevision",
  "rfSnapshotId",
  "rfSnapshotRevision",
  "rfSnapshotHash",
  "rfInputHash",
  "rfRendererHash",
] as const;

const roofFusionProjectionFields = [
  "sourceKind",
  "caseRevision",
  "addressRevision",
  "rfSnapshotId",
  "rfSnapshotRevision",
  "rfSnapshotHash",
  "rfInputHash",
  "rfRendererHash",
] as const;

export const protectRoofFusionMeasurementProjection: CollectionBeforeChangeHook =
  ({ context, data, operation }) => {
    const writesRoofFusionProjection =
      data.sourceKind === "roof_fusion" ||
      roofFusionProjectionFields.some(
        (field) => field !== "sourceKind" && field in data,
      );
    if (
      writesRoofFusionProjection &&
      context?.trustedRoofFusionProjection !== true
    ) {
      throw new Error(
        `${operation} of Roof Fusion measurement bindings requires the canonical Preview bridge`,
      );
    }
    return data;
  };

export const protectApprovedMeasurement: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
}) => {
  if (operation === "update" && originalDoc?.status === "approved") {
    const changed = lockedFields.some(
      (field) =>
        field in data &&
        JSON.stringify(data[field]) !== JSON.stringify(originalDoc[field]),
    );
    if (changed)
      throw new Error(
        "An approved measurement is immutable. Create a new version instead.",
      );
  }
  return data;
};

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  )
    return (value as { id: number }).id;
  return null;
}

export const enforceMeasurementApproval: CollectionBeforeChangeHook = async ({
  context,
  data,
  originalDoc,
  req,
}) => {
  if (data.status !== "approved" || originalDoc?.status === "approved")
    return data;
  const merged = { ...originalDoc, ...data };
  if (context?.trustedRoofFusionProjection === true) {
    const positiveInteger = (value: unknown) =>
      Number.isSafeInteger(value) && Number(value) > 0;
    const sha256 = (value: unknown) =>
      typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
    if (
      merged.sourceKind !== "roof_fusion" ||
      !positiveInteger(merged.caseRevision) ||
      !positiveInteger(merged.addressRevision) ||
      typeof merged.rfSnapshotId !== "string" ||
      !positiveInteger(merged.rfSnapshotRevision) ||
      !sha256(merged.rfSnapshotHash) ||
      !sha256(merged.rfInputHash) ||
      !sha256(merged.rfRendererHash) ||
      !sha256(merged.inputHash) ||
      !positiveInteger(merged.approvedBy) ||
      typeof merged.approvedAt !== "string"
    ) {
      throw new Error(
        "Canonical Roof Fusion projection requires an exact approved snapshot binding",
      );
    }
    return data;
  }
  const leadId = relationId(merged.lead);
  if (!leadId) throw new Error("Measurement approval requires a lead");
  const lead = await req.payload.findByID({
    collection: "leads",
    id: leadId,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const rules = await req.payload.count({
    collection: "price-rules",
    overrideAccess: true,
    req,
    where: {
      and: [
        { serviceKey: { equals: lead.inquiryType } },
        { status: { equals: "approved" } },
      ],
    },
  });
  const storedCalculation =
    merged.calculationSnapshot && typeof merged.calculationSnapshot === "object"
      ? (merged.calculationSnapshot as Record<string, unknown>)
      : null;
  const manualOverride =
    storedCalculation?.manualOverride &&
    typeof storedCalculation.manualOverride === "object"
      ? (storedCalculation.manualOverride as Record<string, unknown>)
      : null;
  const manualAreaTenths =
    typeof manualOverride?.areaTenths === "number"
      ? manualOverride.areaTenths
      : null;
  const { requireApprovedPriceRule } = measurementWorkflowMode();
  if (merged.measurementMode === "manual_no_visual") {
    if (
      !manualAreaTenths ||
      manualAreaTenths < 100 ||
      manualAreaTenths > 50_000
    )
      throw new Error(
        "Manual measurement approval requires an area between 10 and 5000 m²",
      );
    if (
      !merged.manualAreaSource ||
      !merged.manualAreaReason ||
      String(merged.manualAreaReason).trim().length < 5
    )
      throw new Error("Manual measurement approval requires source and reason");
    if (merged.evidenceSnapshot || merged.evidenceHash)
      throw new Error(
        "Manual no-visual measurement cannot claim visual evidence",
      );
    if (requireApprovedPriceRule && rules.totalDocs < 1)
      throw new Error("Measurement approval requires an approved price rule");
    data.horizontalAreaTenths = manualAreaTenths;
    data.actualAreaMinTenths = manualAreaTenths;
    data.actualAreaMaxTenths = manualAreaTenths;
    data.calculationSnapshot = storedCalculation;
    data.inputHash = measurementSnapshotHash({
      mode: "manual_no_visual",
      address: merged.normalizedAddress,
      areaTenths: manualAreaTenths,
      source: merged.manualAreaSource,
      reason: String(merged.manualAreaReason).trim(),
      version: merged.version,
    });
    data.blockingReasons = [];
    data.approvedBy = data.approvedBy ?? req.user?.id;
    data.approvedAt = new Date().toISOString();
    return data;
  }
  const prepared = prepareMeasurement({
    proposal: {
      buildingIdentifier: merged.buildingIdentifier ?? null,
      confidence: merged.confidence,
      confidenceReasoning: merged.confidenceReasoning,
      roofPlanes: merged.roofPlanes,
    },
    addressResolved: Boolean(merged.addressSourceId),
    sourceAuthorized: merged.imageryLicensed === true,
    hasApprovedPriceRule: rules.totalDocs > 0,
    requireApprovedPriceRule,
  });
  if (!prepared.gate.allowed)
    throw new Error(
      `Measurement approval blocked: ${prepared.gate.reasons.join(", ")}`,
    );
  if (process.env.FEATURE_MEASUREMENT_EVIDENCE_V2 === "true") {
    if (isNorgeIBilderScreenshotSource(merged.evidenceSource)) {
      assertNorgeIBilderScreenshotEvidence({
        source: merged.evidenceSource,
        attribution: merged.evidenceAttribution,
        capturedAt: merged.imageryCapturedAt,
        trainingProhibited: true,
      });
    }
    if (
      !relationId(merged.evidenceSnapshot) ||
      !/^[a-f0-9]{64}$/i.test(String(merged.evidenceHash || ""))
    ) {
      throw new Error(
        "Visual measurement approval requires an immutable approved evidence file and hash",
      );
    }
    if (!(await verifyMeasurementEvidence(req.payload, merged)))
      throw new Error(
        "Visual measurement evidence does not match its stored hash",
      );
  }
  if (manualAreaTenths && manualAreaTenths > 0) {
    data.horizontalAreaTenths = merged.horizontalAreaTenths;
    data.actualAreaMinTenths = manualAreaTenths;
    data.actualAreaMaxTenths = manualAreaTenths;
    data.calculationSnapshot = storedCalculation;
    data.inputHash = merged.inputHash;
  } else {
    data.horizontalAreaTenths = prepared.calculation?.horizontalAreaTenths ?? 0;
    data.actualAreaMinTenths = prepared.calculation?.actualAreaMinTenths ?? 0;
    data.actualAreaMaxTenths = prepared.calculation?.actualAreaMaxTenths ?? 0;
    data.calculationSnapshot = prepared.calculation;
    data.inputHash = prepared.inputHash;
  }
  data.blockingReasons = [];
  data.approvedBy = data.approvedBy ?? req.user?.id;
  data.approvedAt = new Date().toISOString();
  return data;
};

export const RoofMeasurements: CollectionConfig = {
  slug: "roof-measurements",
  labels: { singular: "Takmåling", plural: "Takmålinger" },
  admin: {
    group: "Henvendelser",
    useAsTitle: "reference",
    defaultColumns: [
      "reference",
      "lead",
      "version",
      "confidence",
      "status",
      "actualAreaMaxTenths",
      "updatedAt",
    ],
    description:
      "Versjonerte takmålinger. AI kan foreslå; geometri og pris beregnes av kode og må godkjennes av administrator.",
  },
  access: {
    admin: ({ req }) => adminOnly({ req }) === true,
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeChange: [
      protectRoofFusionMeasurementProjection,
      protectApprovedMeasurement,
      enforceMeasurementApproval,
    ],
  },
  fields: [
    {
      name: "reference",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "lead",
      type: "relationship",
      relationTo: "leads",
      required: true,
      index: true,
    },
    { name: "version", type: "number", required: true, min: 1, index: true },
    {
      name: "supersedes",
      type: "relationship",
      relationTo: "roof-measurements",
      index: true,
    },
    {
      name: "sourceKind",
      type: "select",
      required: true,
      defaultValue: "legacy",
      index: true,
      admin: { readOnly: true },
      options: [
        { label: "Legacy", value: "legacy" },
        { label: "Roof Fusion", value: "roof_fusion" },
      ],
    },
    {
      name: "caseRevision",
      type: "number",
      min: 1,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "addressRevision",
      type: "number",
      min: 1,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "rfSnapshotId",
      type: "text",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "rfSnapshotRevision",
      type: "number",
      min: 1,
      admin: { readOnly: true },
    },
    {
      name: "rfSnapshotHash",
      type: "text",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "rfInputHash",
      type: "text",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "rfRendererHash",
      type: "text",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "measurementMode",
      type: "select",
      required: true,
      defaultValue: "schematic",
      index: true,
      options: [
        { label: "Skjematisk målebevis", value: "schematic" },
        {
          label: "Skjema med ekstern bakgrunn",
          value: "schematic_with_context",
        },
        { label: "Manuelt areal uten kart", value: "manual_no_visual" },
      ],
    },
    { name: "normalizedAddress", type: "text", required: true },
    { name: "addressSourceId", type: "text" },
    { name: "latitude", type: "number" },
    { name: "longitude", type: "number" },
    { name: "buildingIdentifier", type: "text" },
    {
      name: "source",
      type: "text",
      required: true,
      defaultValue: "Kartverket / manuell kontroll",
    },
    { name: "sourceUrl", type: "text" },
    {
      name: "license",
      type: "text",
      required: true,
      defaultValue: "CC BY 4.0 / særvilkår for ortofoto",
    },
    {
      name: "credits",
      type: "text",
      required: true,
      defaultValue: "© Kartverket",
    },
    {
      name: "imageryLicensed",
      type: "checkbox",
      required: true,
      defaultValue: false,
      label: "Datakilde og lisensgrunnlag kontrollert",
      admin: {
        description:
          "Teknisk legacy-feltnavn. Gjelder både åpne bygningskonturer og bilder; aktiveres bare når kilden kan brukes og korrekt kreditering er registrert.",
      },
    },
    { name: "capturedAt", type: "date", required: true },
    { name: "mapImage", type: "relationship", relationTo: "private-media" },
    {
      name: "candidateBuildings",
      type: "json",
      admin: {
        readOnly: true,
        description:
          "Kandidater som var tilgjengelige da måleversjonen ble opprettet.",
      },
    },
    {
      name: "evidenceSnapshot",
      type: "relationship",
      relationTo: "private-media",
      admin: { readOnly: true },
    },
    {
      name: "evidenceHash",
      type: "text",
      index: true,
      admin: { readOnly: true },
    },
    { name: "evidenceSource", type: "text", admin: { readOnly: true } },
    { name: "evidenceAttribution", type: "text", admin: { readOnly: true } },
    { name: "evidenceGeneratedAt", type: "date", admin: { readOnly: true } },
    { name: "imageryCapturedAt", type: "date", admin: { readOnly: true } },
    {
      name: "selectionConfirmedBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
    { name: "selectionConfirmedAt", type: "date", admin: { readOnly: true } },
    {
      name: "manualAreaSource",
      type: "select",
      options: [
        { label: "Oppgitt av kunden", value: "customer" },
        { label: "Beregnet fra tegning", value: "drawing" },
        { label: "Administratorens vurdering", value: "admin_estimate" },
        { label: "Målt på stedet", value: "onsite" },
      ],
    },
    { name: "manualAreaReason", type: "textarea", maxLength: 500 },
    {
      name: "roofPlanes",
      type: "json",
      required: true,
      admin: {
        description:
          "Polygonpunkter (lat/lon) og vinkelintervall per takflate. Redigering oppretter ny versjon via kontrollen under.",
      },
    },
    {
      name: "horizontalAreaTenths",
      type: "number",
      required: true,
      admin: { readOnly: true, description: "0,1 m²" },
    },
    {
      name: "actualAreaMinTenths",
      type: "number",
      required: true,
      admin: { readOnly: true, description: "0,1 m²" },
    },
    {
      name: "actualAreaMaxTenths",
      type: "number",
      required: true,
      admin: { readOnly: true, description: "0,1 m²" },
    },
    {
      name: "calculationSnapshot",
      type: "json",
      required: true,
      admin: { readOnly: true },
    },
    {
      name: "inputHash",
      type: "text",
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "confidence",
      type: "select",
      required: true,
      options: [
        { label: "Høy", value: "high" },
        { label: "Middels", value: "medium" },
        { label: "Lav", value: "low" },
      ],
    },
    { name: "confidenceReasoning", type: "textarea", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [
        { label: "Utkast", value: "draft" },
        { label: "Må kontrolleres", value: "review_required" },
        { label: "Blokkert", value: "blocked" },
        { label: "Godkjent", value: "approved" },
        { label: "Erstattet", value: "superseded" },
      ],
    },
    { name: "blockingReasons", type: "json", admin: { readOnly: true } },
    {
      name: "approvedBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
    {
      name: "measurementActions",
      type: "ui",
      admin: { components: { Field: "/components/MeasurementActions" } },
    },
  ],
};
