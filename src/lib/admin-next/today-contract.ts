import type {
  CanonicalWorkQueueQuery,
  WorkQueueItem,
  WorkQueuePage,
} from "./work-queue-contract";

export type AdminNextTodayView = "all" | "overdue" | "mine" | "waiting";

export type AdminNextTaskPriority =
  "critical" | "today" | "waiting" | "scheduled";

export type AdminNextTodayTask = {
  id: string;
  customer: string;
  address: string;
  stage: "measurement" | "offer" | "documents" | "visit";
  action:
    "reviewMeasurement" | "approveOffer" | "sendDocuments" | "confirmVisit";
  reason:
    "lowConfidence" | "priceChanged" | "missingSignature" | "visitTomorrow";
  due: string;
  owner: string;
  ownedByCurrentUser: boolean;
  priority: AdminNextTaskPriority;
  href: string;
  /** Canonical F2 source retained while the current Today UI consumes this compatibility view. */
  workQueueItem?: WorkQueueItem;
};

export type AdminNextTodayLoadResult = {
  status: "ready";
  source: "fixture" | "canonical";
  value: readonly AdminNextTodayTask[];
  /** Present for canonical reads; fixtures remain valid during the staged rollout. */
  workQueue?: WorkQueuePage;
};

export interface AdminNextTodayAdapter {
  load(query?: CanonicalWorkQueueQuery): Promise<AdminNextTodayLoadResult>;
}
