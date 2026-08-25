export const workOrderStatuses = [
  "unassigned",
  "assigned",
  "scheduled",
  "on_way",
  "arrived",
  "precheck",
  "ready",
  "blocked",
  "in_progress",
  "completed",
  "documented",
  "cancelled",
] as const;

export type WorkOrderStatus = (typeof workOrderStatuses)[number];

const transitions: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  unassigned: ["assigned", "scheduled", "blocked", "cancelled"],
  assigned: ["scheduled", "blocked", "cancelled"],
  scheduled: ["on_way", "blocked", "cancelled"],
  on_way: ["arrived", "scheduled", "blocked"],
  arrived: ["precheck", "blocked"],
  precheck: ["ready", "blocked"],
  ready: ["in_progress", "blocked"],
  blocked: ["unassigned", "assigned", "scheduled", "on_way", "precheck", "cancelled"],
  in_progress: ["completed", "blocked"],
  completed: ["documented"],
  documented: [],
  cancelled: [],
};

export function assertWorkOrderTransition(from: WorkOrderStatus, to: WorkOrderStatus) {
  if (from === to) return;
  if (!transitions[from]?.includes(to)) {
    throw new Error(`Invalid work-order transition: ${from} -> ${to}`);
  }
}

export function nextWorkerActions(status: WorkOrderStatus) {
  return transitions[status];
}
