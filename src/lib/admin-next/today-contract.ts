export type AdminNextTodayView = "all" | "overdue" | "mine" | "waiting";

export type AdminNextTaskPriority =
  | "critical"
  | "today"
  | "waiting"
  | "scheduled";

export type AdminNextTodayTask = {
  id: string;
  customer: string;
  address: string;
  stage: "measurement" | "offer" | "documents" | "visit";
  action:
    | "reviewMeasurement"
    | "approveOffer"
    | "sendDocuments"
    | "confirmVisit";
  reason:
    | "lowConfidence"
    | "priceChanged"
    | "missingSignature"
    | "visitTomorrow";
  due: string;
  owner: string;
  ownedByCurrentUser: boolean;
  priority: AdminNextTaskPriority;
  href: string;
};

export type AdminNextTodayLoadResult = {
  status: "ready";
  source: "fixture" | "canonical";
  value: readonly AdminNextTodayTask[];
};

export interface AdminNextTodayAdapter {
  load(): Promise<AdminNextTodayLoadResult>;
}
