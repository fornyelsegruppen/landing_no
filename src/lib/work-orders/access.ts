import type { Payload } from "payload";
import { userIsActive, userIsAdmin, userIsWorker } from "@/payload/access/roles";

export function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

export async function loadAuthorizedWorkOrder(payload: Payload, workOrderId: number, user: Parameters<typeof userIsActive>[0]) {
  if (!userIsActive(user) || (!userIsAdmin(user) && !userIsWorker(user))) return null;
  const order = await payload.findByID({ collection: "work-orders", id: workOrderId, depth: 0, overrideAccess: true }).catch(() => null);
  if (!order) return null;
  if (!userIsAdmin(user) && relationId(order.assignedWorker) !== Number(user?.id)) return null;
  return order;
}

export function appendTimeline(existing: unknown, event: { action: string; actorId: number; changedFields: string[]; at?: string; reason?: string; before?: unknown; after?: unknown }) {
  const timeline = Array.isArray(existing) ? existing.slice(-99) : [];
  return [...timeline, { action: event.action, actorId: event.actorId, changedFields: [...new Set(event.changedFields)].sort(), at: event.at ?? new Date().toISOString(), ...(event.reason ? { reason: event.reason } : {}), ...(event.before !== undefined ? { before: event.before } : {}), ...(event.after !== undefined ? { after: event.after } : {}) }];
}
