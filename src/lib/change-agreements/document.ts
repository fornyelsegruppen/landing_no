import { createHash, createHmac } from "node:crypto";
import { z } from "zod";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function changeDocumentHash(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

const ore = z.number().int().nonnegative().safe();
export const changeAgreementSnapshotSchema = z.object({
  schemaVersion: z.literal("change-v1"),
  reference: z.string().min(1),
  workOrderId: z.number().int().positive(),
  contractId: z.number().int().positive(),
  contractDocumentHash: z.string().length(64),
  reasonCode: z.enum(["over_tolerance", "over_maximum", "scope_change"]),
  reasonDescription: z.string().min(5).max(2_000),
  before: z.object({ areaTenths: z.number().int().positive(), totalIncVatOre: ore, maximumTotalIncVatOre: ore.nullable() }),
  after: z.object({ areaTenths: z.number().int().positive(), subtotalExVatOre: ore, vatOre: ore, totalIncVatOre: ore }),
  issuedAt: z.string(),
  validUntil: z.string(),
});

export type ChangeAgreementSnapshot = z.infer<typeof changeAgreementSnapshotSchema>;

export function buildChangeAgreementSnapshot(input: Omit<ChangeAgreementSnapshot, "schemaVersion">, now = new Date()) {
  const snapshot = changeAgreementSnapshotSchema.parse({ schemaVersion: "change-v1", ...input });
  if (new Date(snapshot.validUntil).getTime() <= now.getTime()) throw new Error("Change agreement must be valid in the future");
  return snapshot;
}

export function createChangeAcceptanceEvidence(input: {
  snapshot: ChangeAgreementSnapshot;
  expectedDocumentHash: string;
  customerName: string;
  accepted: boolean;
  ipAddress: string;
  userAgent: string;
  securitySalt: string;
  now?: Date;
}) {
  const documentHash = changeDocumentHash(input.snapshot);
  if (documentHash !== input.expectedDocumentHash) throw new Error("Change agreement has changed");
  if (!input.accepted) throw new Error("Explicit written acceptance is required");
  const customerName = input.customerName.trim();
  if (customerName.length < 3 || customerName.length > 160) throw new Error("Customer name is invalid");
  if (input.securitySalt.length < 32) throw new Error("Acceptance evidence secret is too short");
  const hmac = (value: string) => createHmac("sha256", input.securitySalt).update(value || "unknown").digest("hex");
  return {
    documentHash,
    customerName,
    acceptedAt: (input.now ?? new Date()).toISOString(),
    method: "typed-name-and-explicit-checkbox" as const,
    explicitAcceptance: true as const,
    ipEvidenceHash: hmac(input.ipAddress),
    userAgentEvidenceHash: hmac(input.userAgent),
  };
}
