import type { Payload, PayloadRequest } from "payload";
import type { AuditEventWriter } from "./audit-event";

export function createPayloadAuditWriter(
  payload: Payload,
  options: { req?: PayloadRequest } = {},
): AuditEventWriter {
  return async (event) => {
    await payload.create({
      collection: "audit-events",
      data: event,
      overrideAccess: true,
      ...(options.req ? { req: options.req } : {}),
    });
  };
}
