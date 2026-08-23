import type { Payload } from "payload";
import { relationId } from "@/lib/work-orders/access";
import { changeAgreementSnapshotSchema } from "./document";
import { resolveChangeAccessToken } from "./customer-access";

export async function loadCustomerChange(payload: Payload, token: string) {
  const access = await resolveChangeAccessToken(payload, token); if (!access) return null;
  const agreement = await payload.findByID({ collection: "change-agreements", id: access.agreementId, depth: 0, overrideAccess: true }).catch(() => null);
  if (!agreement || !["sent", "viewed", "accepted", "declined"].includes(agreement.status)) return null;
  const snapshot = changeAgreementSnapshotSchema.parse(agreement.snapshot);
  const order = await payload.findByID({ collection: "work-orders", id: relationId(agreement.workOrder)!, depth: 0, overrideAccess: true });
  const contract = await payload.findByID({ collection: "contracts", id: relationId(agreement.contract)!, depth: 0, overrideAccess: true });
  const contractSnapshot = contract.snapshot as { customer?: { name?: string } };
  if (agreement.status === "sent") await payload.update({ collection: "change-agreements", id: agreement.id, overrideAccess: true, data: { status: "viewed", viewedAt: new Date().toISOString() } });
  return { accessRecordId: access.record.id, agreementId: agreement.id, status: agreement.status === "sent" ? "viewed" : agreement.status, snapshot, documentHash: agreement.documentHash, customerName: contractSnapshot.customer?.name || "", acceptedDocumentId: relationId(agreement.acceptedDocument), workOrderId: order.id, leadId: relationId(order.lead)! };
}
