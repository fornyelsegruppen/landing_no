import type { Payload } from "payload";

type UnknownRecord = Record<string, unknown>;

const sha256Pattern = /^[a-f0-9]{64}$/;

export class ContractSigningInvariantError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "ContractSigningInvariantError";
  }
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function relationId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0)
    return value;
  const related = record(value);
  return related &&
    typeof related.id === "number" &&
    Number.isInteger(related.id) &&
    related.id > 0
    ? related.id
    : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function validEvidenceHash(value: unknown) {
  return typeof value === "string" && sha256Pattern.test(value);
}

function assertDocumentEvidence(
  evidence: UnknownRecord,
  contract: UnknownRecord,
  signedAt: unknown,
) {
  if (
    !validEvidenceHash(contract.documentHash) ||
    evidence.documentHash !== contract.documentHash
  ) {
    throw new ContractSigningInvariantError(
      "Signature evidence does not match the immutable contract document",
    );
  }
  if (!nonEmptyString(signedAt) || evidence.signedAt !== signedAt) {
    throw new ContractSigningInvariantError(
      "Signature evidence timestamp does not match the contract signature timestamp",
    );
  }
  if (
    evidence.method !== "drawn-and-typed" ||
    !nonEmptyString(evidence.signerName) ||
    !validEvidenceHash(evidence.signatureHash) ||
    !validEvidenceHash(evidence.ipEvidenceHash) ||
    !validEvidenceHash(evidence.userAgentEvidenceHash)
  ) {
    throw new ContractSigningInvariantError(
      "Signature evidence is incomplete or invalid",
    );
  }
}

export function assertCustomerSignatureProof(contractValue: unknown) {
  const contract = record(contractValue);
  if (!contract || contract.status !== "signed") {
    throw new ContractSigningInvariantError(
      "Only a contract signed by the customer can continue",
    );
  }
  const evidence = record(contract.signatureEvidence);
  if (!evidence || !relationId(contract.signedDocument)) {
    throw new ContractSigningInvariantError(
      "Customer signature evidence and the customer-signed contract PDF are required",
    );
  }
  assertDocumentEvidence(evidence, contract, contract.signedAt);
  if (
    evidence.paymentObligationAccepted !== true ||
    evidence.termsAccepted !== true ||
    evidence.withdrawalInformationReceived !== true ||
    typeof evidence.earlyStartRequested !== "boolean" ||
    typeof evidence.earlyStartLossAcknowledged !== "boolean" ||
    (evidence.earlyStartRequested === true &&
      evidence.earlyStartLossAcknowledged !== true)
  ) {
    throw new ContractSigningInvariantError(
      "Required customer contract consents are missing from the signature evidence",
    );
  }
}

export function assertFullySignedContractProof(contractValue: unknown) {
  assertCustomerSignatureProof(contractValue);
  const contract = record(contractValue)!;
  const evidence = record(contract.companySignatureEvidence);
  const companySignedBy = relationId(contract.companySignedBy);
  if (
    !evidence ||
    !companySignedBy ||
    !relationId(contract.companySignatureImage) ||
    !relationId(contract.companySignedDocument)
  ) {
    throw new ContractSigningInvariantError(
      "Supplier counter-signature evidence and the final contract PDF signed by both parties are required",
    );
  }
  assertDocumentEvidence(evidence, contract, contract.companySignedAt);
  if (evidence.signerUserId !== companySignedBy) {
    throw new ContractSigningInvariantError(
      "Supplier signature evidence does not match the recorded administrator",
    );
  }
}

export async function assertContractReadyForWorkOrder(
  payload: Payload,
  contractValue: unknown,
) {
  assertFullySignedContractProof(contractValue);
  const contract = record(contractValue)!;
  const finalDocumentId = relationId(contract.companySignedDocument)!;
  const finalDocument = await payload
    .findByID({
      collection: "private-media",
      id: finalDocumentId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (
    !finalDocument ||
    finalDocument.mimeType !== "application/pdf" ||
    finalDocument.classification !== "contract" ||
    finalDocument.ownerType !== "contract" ||
    finalDocument.ownerId !== String(contract.id)
  ) {
    throw new ContractSigningInvariantError(
      "The final contract signed by both parties is not a verified private contract PDF",
    );
  }
}
