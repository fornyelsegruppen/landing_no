export type TodayHardStop = "integrity" | "legal" | "safety";
export type TodayRecovery = "command_failure" | "delivery_failure";
export type TodayWaitingParty = "customer" | "system" | "worker";
export type TodaySlaBand = "due_today" | "future" | "none" | "overdue";

export type TodayPriorityInput = {
  caseId: string;
  dueAt?: string | null;
  hardStop?: TodayHardStop | null;
  ownerId?: string | null;
  recovery?: TodayRecovery | null;
  transitionBlocked?: boolean;
  waitingParty?: TodayWaitingParty | null;
  wakeAt?: string | null;
};

export type TodayPriorityDimensions = {
  assignmentGap: boolean;
  dueAt: string | null;
  hardStop: TodayHardStop | null;
  reasonCode:
    | "ASSIGNMENT_REQUIRED"
    | "COMMAND_RECOVERY_REQUIRED"
    | "DELIVERY_RECOVERY_REQUIRED"
    | "DUE_TODAY"
    | "FUTURE_ACTION"
    | "INTEGRITY_STOP"
    | "LEGAL_STOP"
    | "NO_DUE_DATE"
    | "OVERDUE"
    | "SAFETY_STOP"
    | "TRANSITION_BLOCKED"
    | "WAITING_NOT_DUE"
    | "WAITING_WAKE_DUE";
  recovery: TodayRecovery | null;
  slaBand: TodaySlaBand;
  transitionBlocked: boolean;
  waitingParty: TodayWaitingParty | null;
  waitingWakeDue: boolean;
  wakeAt: string | null;
};

export type RankedTodayItem<T extends TodayPriorityInput = TodayPriorityInput> = T & {
  priority: TodayPriorityDimensions;
};

const hardStopRank: Record<TodayHardStop, number> = { legal: 0, safety: 1, integrity: 2 };
const recoveryRank: Record<TodayRecovery, number> = { command_failure: 0, delivery_failure: 1 };
const slaRank: Record<TodaySlaBand, number> = { overdue: 0, due_today: 1, future: 2, none: 3 };

function timestamp(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function osloDayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Oslo",
    year: "numeric",
  }).format(value);
}

export function deriveTodayPriority(input: TodayPriorityInput, now: Date): TodayPriorityDimensions {
  const dueTimestamp = timestamp(input.dueAt);
  const wakeTimestamp = timestamp(input.wakeAt);
  const nowTimestamp = now.getTime();
  const slaBand: TodaySlaBand = dueTimestamp === null
    ? "none"
    : dueTimestamp <= nowTimestamp
      ? "overdue"
      : osloDayKey(new Date(dueTimestamp)) === osloDayKey(now)
        ? "due_today"
        : "future";
  const waitingWakeDue = Boolean(input.waitingParty && wakeTimestamp !== null && wakeTimestamp <= nowTimestamp);
  const reasonCode: TodayPriorityDimensions["reasonCode"] = input.hardStop
    ? `${input.hardStop.toUpperCase()}_STOP` as TodayPriorityDimensions["reasonCode"]
    : input.recovery === "command_failure"
      ? "COMMAND_RECOVERY_REQUIRED"
      : input.recovery === "delivery_failure"
        ? "DELIVERY_RECOVERY_REQUIRED"
        : input.transitionBlocked
          ? "TRANSITION_BLOCKED"
          : waitingWakeDue
            ? "WAITING_WAKE_DUE"
            : input.waitingParty
              ? "WAITING_NOT_DUE"
              : slaBand === "overdue"
                ? "OVERDUE"
                : slaBand === "due_today"
                  ? "DUE_TODAY"
                  : !input.ownerId
                    ? "ASSIGNMENT_REQUIRED"
                    : slaBand === "future"
                      ? "FUTURE_ACTION"
                      : "NO_DUE_DATE";

  return {
    assignmentGap: !input.ownerId,
    dueAt: dueTimestamp === null ? null : new Date(dueTimestamp).toISOString(),
    hardStop: input.hardStop || null,
    reasonCode,
    recovery: input.recovery || null,
    slaBand,
    transitionBlocked: Boolean(input.transitionBlocked),
    waitingParty: input.waitingParty || null,
    waitingWakeDue,
    wakeAt: wakeTimestamp === null ? null : new Date(wakeTimestamp).toISOString(),
  };
}

function compareRankedTodayItems(left: RankedTodayItem, right: RankedTodayItem) {
  const leftTuple = [
    left.priority.hardStop ? hardStopRank[left.priority.hardStop] : 3,
    left.priority.recovery ? recoveryRank[left.priority.recovery] : 2,
    slaRank[left.priority.slaBand],
    left.priority.transitionBlocked ? 0 : 1,
    left.priority.assignmentGap ? 0 : 1,
    left.priority.waitingWakeDue ? 0 : left.priority.waitingParty ? 2 : 1,
    left.priority.waitingWakeDue && left.priority.wakeAt ? Date.parse(left.priority.wakeAt) : Number.POSITIVE_INFINITY,
    left.priority.dueAt ? Date.parse(left.priority.dueAt) : Number.POSITIVE_INFINITY,
  ];
  const rightTuple = [
    right.priority.hardStop ? hardStopRank[right.priority.hardStop] : 3,
    right.priority.recovery ? recoveryRank[right.priority.recovery] : 2,
    slaRank[right.priority.slaBand],
    right.priority.transitionBlocked ? 0 : 1,
    right.priority.assignmentGap ? 0 : 1,
    right.priority.waitingWakeDue ? 0 : right.priority.waitingParty ? 2 : 1,
    right.priority.waitingWakeDue && right.priority.wakeAt ? Date.parse(right.priority.wakeAt) : Number.POSITIVE_INFINITY,
    right.priority.dueAt ? Date.parse(right.priority.dueAt) : Number.POSITIVE_INFINITY,
  ];
  for (let index = 0; index < leftTuple.length; index += 1) {
    if (leftTuple[index] !== rightTuple[index]) return leftTuple[index] - rightTuple[index];
  }
  return left.caseId.localeCompare(right.caseId, "en", { numeric: true });
}

export function rankTodayItems<T extends TodayPriorityInput>(items: readonly T[], now: Date): RankedTodayItem<T>[] {
  const bestByCase = new Map<string, RankedTodayItem<T>>();
  for (const item of items) {
    const ranked = { ...item, priority: deriveTodayPriority(item, now) };
    const current = bestByCase.get(item.caseId);
    if (!current || compareRankedTodayItems(ranked, current) < 0) bestByCase.set(item.caseId, ranked);
  }
  return [...bestByCase.values()].sort(compareRankedTodayItems);
}
