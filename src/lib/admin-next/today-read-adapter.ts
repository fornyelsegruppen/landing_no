import type { Payload } from "payload";
import {
  loadAdminQueue,
  type AdminListItem,
  type AdminQueueKey,
} from "@/lib/admin-v2/dashboard";
import type {
  AdminNextTodayAdapter,
  AdminNextTodayTask,
} from "@/lib/admin-next/today-contract";

const queueProjection = {
  attention: {
    stage: "measurement",
    action: "reviewMeasurement",
    reason: "lowConfidence",
    priority: "critical",
  },
  "quote-review": {
    stage: "offer",
    action: "approveOffer",
    reason: "priceChanged",
    priority: "today",
  },
  "contract-signing": {
    stage: "documents",
    action: "sendDocuments",
    reason: "missingSignature",
    priority: "waiting",
  },
  "upcoming-work": {
    stage: "visit",
    action: "confirmVisit",
    reason: "visitTomorrow",
    priority: "scheduled",
  },
} as const satisfies Partial<Record<
  AdminQueueKey,
  Pick<AdminNextTodayTask, "stage" | "action" | "reason" | "priority">
>>;

function dueTime(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(date);
}

function projectTask(
  queue: keyof typeof queueProjection,
  item: AdminListItem,
  currentUserName: string,
): AdminNextTodayTask {
  const owner = item.employee || currentUserName || "Team";
  return {
    id: item.reference,
    customer: item.customer || item.reference,
    address: item.subtitle || "—",
    ...queueProjection[queue],
    due: dueTime(item.eventAt || item.createdAt),
    owner,
    ownedByCurrentUser: Boolean(
      currentUserName && owner.toLowerCase() === currentUserName.toLowerCase(),
    ),
    href: item.href,
  };
}

export function createAdminNextCanonicalTodayAdapter(
  payload: Pick<Payload, "find">,
  currentUserName = "",
): AdminNextTodayAdapter {
  return {
    async load() {
      const queues = Object.keys(queueProjection) as Array<
        keyof typeof queueProjection
      >;
      const results = await Promise.all(
        queues.map(async (queue) => [queue, await loadAdminQueue(payload, queue)] as const),
      );
      const seen = new Set<string>();
      const tasks = results.flatMap(([queue, items]) =>
        items.flatMap((item) => {
          const key = `${queue}:${item.href}:${item.reference}`;
          if (seen.has(key)) return [];
          seen.add(key);
          return [projectTask(queue, item, currentUserName)];
        }),
      );
      return { status: "ready", source: "canonical", value: tasks };
    },
  };
}
