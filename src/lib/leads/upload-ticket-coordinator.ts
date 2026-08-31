export type UploadTicketState = {
  pending: Promise<string> | null;
  value: string | null;
};

export function createUploadTicketState(): UploadTicketState {
  return { pending: null, value: null };
}

export async function getOrCreateUploadTicket(
  state: UploadTicketState,
  issue: () => Promise<string>,
  afterProofConsumed: () => void,
): Promise<string> {
  if (state.value) return state.value;
  if (state.pending) return state.pending;

  const pending = Promise.resolve().then(issue);
  state.pending = pending;

  try {
    const ticket = await pending;
    state.value = ticket;
    return ticket;
  } finally {
    if (state.pending === pending) state.pending = null;
    afterProofConsumed();
  }
}

export function clearUploadTicket(state: UploadTicketState) {
  state.value = null;
}
