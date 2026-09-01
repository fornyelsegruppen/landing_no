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
  action: "reviewMeasurement" | "approveOffer" | "sendDocuments" | "confirmVisit";
  reason: "lowConfidence" | "priceChanged" | "missingSignature" | "visitTomorrow";
  due: string;
  owner: string;
  ownedByCurrentUser: boolean;
  priority: AdminNextTaskPriority;
  href: string;
};

export const adminNextTodayTasks: readonly AdminNextTodayTask[] = [
  {
    id: "TF-1042",
    customer: "Demo · Kari Nilsen",
    address: "Testveien 12, Oslo",
    stage: "measurement",
    action: "reviewMeasurement",
    reason: "lowConfidence",
    due: "09:30",
    owner: "Marius",
    ownedByCurrentUser: true,
    priority: "critical",
    href: "/admin-next-preview/cases/TF-1042",
  },
  {
    id: "TF-1038",
    customer: "Demo · Henrik Solberg",
    address: "Eksempelveien 8, Bærum",
    stage: "offer",
    action: "approveOffer",
    reason: "priceChanged",
    due: "11:00",
    owner: "Marius",
    ownedByCurrentUser: true,
    priority: "today",
    href: "/admin-v2/cases",
  },
  {
    id: "TF-1031",
    customer: "Demo · Ingrid Dahl",
    address: "Prøvegata 24, Lillestrøm",
    stage: "documents",
    action: "sendDocuments",
    reason: "missingSignature",
    due: "13:15",
    owner: "Rasa",
    ownedByCurrentUser: false,
    priority: "waiting",
    href: "/admin-v2/cases",
  },
  {
    id: "TF-1027",
    customer: "Demo · Ola Berg",
    address: "Mønsterveien 5, Asker",
    stage: "visit",
    action: "confirmVisit",
    reason: "visitTomorrow",
    due: "15:30",
    owner: "Marius",
    ownedByCurrentUser: true,
    priority: "scheduled",
    href: "/admin-v2/work",
  },
] as const;

export function parseAdminNextTodayView(value: unknown): AdminNextTodayView {
  return value === "overdue" || value === "mine" || value === "waiting"
    ? value
    : "all";
}

export function filterAdminNextTodayTasks(
  tasks: readonly AdminNextTodayTask[],
  view: AdminNextTodayView,
) {
  if (view === "overdue")
    return tasks.filter(({ priority }) => priority === "critical");
  if (view === "mine")
    return tasks.filter(({ ownedByCurrentUser }) => ownedByCurrentUser);
  if (view === "waiting")
    return tasks.filter(({ priority }) => priority === "waiting");
  return [...tasks];
}
