import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import {
  NORGE_I_BILDER_EXACT_ATTRIBUTION,
  assertNorgeIBilderScreenshotEvidence,
  isNorgeIBilderScreenshotSource,
} from "@/lib/measurements/evidence-policy";
import { siteConfig } from "@/lib/site";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stable(item === undefined ? null : item)).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function documentHash(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

const integer = z.number().int().nonnegative().safe();
export const quoteSnapshotSchema = z.object({
  schemaVersion: z.enum(["quote-v1", "quote-v2"]),
  quoteReference: z.string(),
  leadId: z.number().int().positive(),
  serviceKey: z.string(),
  serviceDescription: z.string(),
  propertyAddress: z.string(),
  measurement: z.object({
    id: z.number().int().positive(), version: z.number().int().positive(), inputHash: z.string().length(64),
    horizontalAreaTenths: integer, actualAreaMinTenths: integer, actualAreaMaxTenths: integer,
    source: z.string(), credits: z.string(), capturedAt: z.string(), assumptions: z.array(z.string()),
    mode: z.enum(["legacy", "schematic", "schematic_with_context", "manual_no_visual"]).optional().default("legacy"),
    buildingIdentifier: z.string().optional(),
    evidenceMediaId: z.number().int().positive().optional(),
    evidenceHash: z.string().length(64).optional(),
    evidenceSource: z.string().optional(),
    evidenceAttribution: z.string().optional(),
    imageryCapturedAt: z.string().optional(),
    evidenceTrainingProhibited: z.boolean().optional(),
    angleMinDegrees: z.number().min(0).max(89).optional(),
    angleMaxDegrees: z.number().min(0).max(89).optional(),
    approvedByName: z.string().optional(),
    approvedAt: z.string().optional(),
    manualAreaSource: z.enum(["customer", "drawing", "admin_estimate", "onsite"]).optional(),
    manualAreaReason: z.string().optional(),
  }),
  pricing: z.object({
    calculationId: z.number().int().positive(), inputHash: z.string().length(64), ruleId: z.number().int().positive(), ruleVersion: z.number().int().positive(),
    unitPriceExVatOre: integer, subtotalExVatOre: integer, vatBasisPoints: integer, vatOre: integer,
    totalIncVatOre: integer, toleranceBasisPoints: integer, maximumTotalIncVatOre: integer.nullable(),
    depositBasisPoints: integer.max(10000).optional().default(0),
    depositAmountIncVatOre: integer.optional().default(0),
  }),
  termsVersion: z.string(),
  validUntil: z.string(),
});

export type QuoteSnapshot = z.infer<typeof quoteSnapshotSchema>;
export type QuoteSnapshotInput = Omit<z.input<typeof quoteSnapshotSchema>, "schemaVersion">;

export function buildQuoteSnapshot(input: QuoteSnapshotInput): QuoteSnapshot {
  const snapshot = quoteSnapshotSchema.parse({ schemaVersion: "quote-v2", ...input });
  if (new Date(snapshot.validUntil).getTime() <= Date.now()) throw new TypeError("Quote validity must be in the future");
  if (snapshot.measurement.actualAreaMinTenths > snapshot.measurement.actualAreaMaxTenths) throw new TypeError("Minimum area cannot exceed maximum area");
  const expectedDeposit = Math.round(snapshot.pricing.totalIncVatOre * snapshot.pricing.depositBasisPoints / 10000);
  if (snapshot.pricing.depositAmountIncVatOre !== expectedDeposit) throw new TypeError("Deposit amount does not match the selected percentage");
  if (isNorgeIBilderScreenshotSource(snapshot.measurement.evidenceSource)) {
    assertNorgeIBilderScreenshotEvidence({
      source: snapshot.measurement.evidenceSource,
      attribution: snapshot.measurement.evidenceAttribution,
      capturedAt: snapshot.measurement.imageryCapturedAt,
      trainingProhibited: snapshot.measurement.evidenceTrainingProhibited,
    });
    if (snapshot.measurement.mode !== "schematic_with_context") {
      throw new TypeError(
        "Approved Norge i bilder screenshot evidence requires schematic_with_context mode",
      );
    }
  }
  return snapshot;
}

export function quoteDisplayModel(snapshotInput: unknown) {
  const snapshot = quoteSnapshotSchema.parse(snapshotInput);
  return {
    reference: snapshot.quoteReference,
    service: snapshot.serviceDescription,
    address: snapshot.propertyAddress,
    estimatedAreaMin: snapshot.measurement.actualAreaMinTenths / 10,
    estimatedAreaMax: snapshot.measurement.actualAreaMaxTenths / 10,
    unitPriceExVatNok: snapshot.pricing.unitPriceExVatOre / 100,
    subtotalExVatNok: snapshot.pricing.subtotalExVatOre / 100,
    vatPercent: snapshot.pricing.vatBasisPoints / 100,
    vatNok: snapshot.pricing.vatOre / 100,
    totalIncVatNok: snapshot.pricing.totalIncVatOre / 100,
    tolerancePercent: snapshot.pricing.toleranceBasisPoints / 100,
    maximumTotalIncVatNok: snapshot.pricing.maximumTotalIncVatOre == null ? null : snapshot.pricing.maximumTotalIncVatOre / 100,
    depositPercent: snapshot.pricing.depositBasisPoints / 100,
    depositAmountIncVatNok: snapshot.pricing.depositAmountIncVatOre / 100,
    assumptions: snapshot.measurement.assumptions,
    source: snapshot.measurement.source,
    credits: isNorgeIBilderScreenshotSource(snapshot.measurement.evidenceSource)
      ? NORGE_I_BILDER_EXACT_ATTRIBUTION
      : snapshot.measurement.credits,
    validUntil: snapshot.validUntil,
    termsVersion: snapshot.termsVersion,
    measurementReference: `TM-${snapshot.leadId}-V${snapshot.measurement.version}`,
    measurement: snapshot.measurement,
  };
}

export type ContractSnapshot = {
  schemaVersion: "contract-v1" | "contract-v2";
  contractReference: string;
  quoteHash: string;
  quote: QuoteSnapshot;
  supplier: { name: string; orgNumber: string; address: string; email: string; phone: string };
  customer: { name: string; address: string; email?: string | null; phone?: string | null };
  terms: { version: string; text: string; withdrawalInstructions: string; withdrawalFormUrl: string };
};

export function buildContractSnapshot(input: {
  contractReference: string;
  quote: QuoteSnapshot;
  customer: ContractSnapshot["customer"];
  terms: ContractSnapshot["terms"];
}): ContractSnapshot {
  if (!input.terms.text.trim() || !input.terms.withdrawalInstructions.trim() || !input.terms.withdrawalFormUrl.trim()) {
    throw new TypeError("Approved contract and withdrawal terms are required");
  }
  return {
    schemaVersion: "contract-v2",
    contractReference: input.contractReference,
    quoteHash: documentHash(input.quote),
    quote: quoteSnapshotSchema.parse(input.quote),
    supplier: {
      name: siteConfig.parentOrg,
      orgNumber: siteConfig.orgNr,
      address: `${siteConfig.address.street}, ${siteConfig.address.postal} ${siteConfig.address.city}`,
      email: siteConfig.email,
      phone: siteConfig.phone,
    },
    customer: input.customer,
    terms: input.terms,
  };
}

export type SignatureEvidenceRecord = {
  documentHash: string;
  signatureHash: string;
  signerName: string;
  signedAt: string;
  method: "drawn-and-typed";
  paymentObligationAccepted: true;
  termsAccepted: true;
  withdrawalInformationReceived: true;
  earlyStartRequested: boolean;
  earlyStartLossAcknowledged: boolean;
  ipEvidenceHash: string;
  userAgentEvidenceHash: string;
};

export type CompanySignatureEvidenceRecord = {
  documentHash: string;
  signatureHash: string;
  signerName: string;
  signerUserId: number;
  signedAt: string;
  method: "drawn-and-typed";
  ipEvidenceHash: string;
  userAgentEvidenceHash: string;
};

export function validatedPngSignature(dataUrl: string) {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix) || dataUrl.length > 1_500_000) {
    throw new TypeError("Signature drawing is invalid");
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(dataUrl.slice(prefix.length), "base64");
  } catch {
    throw new TypeError("Signature drawing is invalid");
  }
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 64 || !bytes.subarray(0, pngMagic.length).equals(pngMagic)) {
    throw new TypeError("Signature drawing is invalid");
  }
  return bytes;
}

export function createCompanySignatureEvidence(input: {
  contract: ContractSnapshot;
  expectedDocumentHash: string;
  signatureData: string;
  signerName: string;
  signerUserId: number;
  ipAddress: string;
  userAgent: string;
  securitySalt: string;
  now?: Date;
}): CompanySignatureEvidenceRecord {
  const actualHash = documentHash(input.contract);
  if (actualHash !== input.expectedDocumentHash) throw new Error("Contract document has changed");
  const signerName = input.signerName.trim();
  if (signerName.length < 3 || signerName.length > 160) throw new TypeError("Signer name is invalid");
  if (!Number.isInteger(input.signerUserId) || input.signerUserId < 1) throw new TypeError("Signer user is invalid");
  validatedPngSignature(input.signatureData);
  if (input.securitySalt.length < 32) throw new TypeError("Signature evidence secret is too short");
  const hmac = (value: string) => createHmac("sha256", input.securitySalt).update(value).digest("hex");
  return {
    documentHash: actualHash,
    signatureHash: createHash("sha256").update(input.signatureData).digest("hex"),
    signerName,
    signerUserId: input.signerUserId,
    signedAt: (input.now ?? new Date()).toISOString(),
    method: "drawn-and-typed",
    ipEvidenceHash: hmac(input.ipAddress || "unknown"),
    userAgentEvidenceHash: hmac(input.userAgent || "unknown"),
  };
}

export function createSignatureEvidence(input: {
  contract: ContractSnapshot;
  expectedDocumentHash: string;
  signatureData: string;
  signerName: string;
  paymentObligationAccepted: boolean;
  termsAccepted: boolean;
  withdrawalInformationReceived: boolean;
  earlyStartRequested: boolean;
  earlyStartLossAcknowledged: boolean;
  ipAddress: string;
  userAgent: string;
  securitySalt: string;
  now?: Date;
}): SignatureEvidenceRecord {
  const actualHash = documentHash(input.contract);
  if (actualHash !== input.expectedDocumentHash) throw new Error("Contract document has changed");
  if (!input.paymentObligationAccepted || !input.termsAccepted || !input.withdrawalInformationReceived) throw new Error("Required contract consents are missing");
  if (input.earlyStartRequested && !input.earlyStartLossAcknowledged) throw new Error("Early start acknowledgement is required");
  const signerName = input.signerName.trim();
  if (signerName.length < 3 || signerName.length > 160) throw new TypeError("Signer name is invalid");
  validatedPngSignature(input.signatureData);
  if (input.securitySalt.length < 32) throw new TypeError("Signature evidence secret is too short");
  const hmac = (value: string) => createHmac("sha256", input.securitySalt).update(value).digest("hex");
  return {
    documentHash: actualHash,
    signatureHash: createHash("sha256").update(input.signatureData).digest("hex"),
    signerName,
    signedAt: (input.now ?? new Date()).toISOString(),
    method: "drawn-and-typed",
    paymentObligationAccepted: true,
    termsAccepted: true,
    withdrawalInformationReceived: true,
    earlyStartRequested: input.earlyStartRequested,
    earlyStartLossAcknowledged: input.earlyStartLossAcknowledged,
    ipEvidenceHash: hmac(input.ipAddress || "unknown"),
    userAgentEvidenceHash: hmac(input.userAgent || "unknown"),
  };
}
