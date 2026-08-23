export type QuoteStatus = "draft" | "approved" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "revoked" | "superseded";
export type ContractStatus = "draft" | "issued" | "signed" | "declined" | "revoked" | "superseded";

const quoteTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["approved", "revoked", "superseded"], approved: ["sent", "revoked", "superseded"],
  sent: ["viewed", "accepted", "declined", "expired", "revoked", "superseded"], viewed: ["accepted", "declined", "expired", "revoked", "superseded"],
  accepted: [], declined: [], expired: [], revoked: [], superseded: [],
};
const contractTransitions: Record<ContractStatus, ContractStatus[]> = {
  draft: ["issued", "revoked", "superseded"], issued: ["signed", "declined", "revoked", "superseded"],
  signed: [], declined: [], revoked: [], superseded: [],
};

export function assertQuoteTransition(from: QuoteStatus, to: QuoteStatus) {
  if (!quoteTransitions[from].includes(to)) throw new Error(`Invalid quote transition: ${from} -> ${to}`);
}
export function assertContractTransition(from: ContractStatus, to: ContractStatus) {
  if (!contractTransitions[from].includes(to)) throw new Error(`Invalid contract transition: ${from} -> ${to}`);
}
