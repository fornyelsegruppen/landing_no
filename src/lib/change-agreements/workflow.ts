export const changeStatuses = ["draft", "approved", "sent", "viewed", "accepted", "declined", "revoked", "superseded"] as const;
export type ChangeStatus = (typeof changeStatuses)[number];

const transitions: Record<ChangeStatus, readonly ChangeStatus[]> = {
  draft: ["approved", "revoked", "superseded"], approved: ["sent", "revoked", "superseded"], sent: ["viewed", "accepted", "declined", "revoked", "superseded"],
  viewed: ["accepted", "declined", "revoked", "superseded"], accepted: [], declined: [], revoked: [], superseded: [],
};

export function assertChangeTransition(from: ChangeStatus, to: ChangeStatus) {
  if (from === to) return;
  if (!transitions[from]?.includes(to)) throw new Error(`Invalid change-agreement transition: ${from} -> ${to}`);
}
