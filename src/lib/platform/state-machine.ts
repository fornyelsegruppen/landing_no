export class InvalidStateTransitionError<State extends string> extends Error {
  constructor(
    readonly from: State,
    readonly to: State,
  ) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

export type TransitionMap<State extends string> = Readonly<
  Record<State, readonly State[]>
>;

export function canTransition<State extends string>(
  transitions: TransitionMap<State>,
  from: State,
  to: State,
) {
  return transitions[from].includes(to);
}

export function assertTransition<State extends string>(
  transitions: TransitionMap<State>,
  from: State,
  to: State,
): void {
  if (!canTransition(transitions, from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}
