import type { Payload } from "payload";
import type { AuditEventWriter } from "./audit-event";

export function createPayloadAuditWriter(payload: Payload): AuditEventWriter {
  return async (event) => {
    await payload.create({
      collection: "audit-events",
      data: event,
      overrideAccess: true,
    });
  };
}
