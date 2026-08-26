import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { updateCaseState } from "@/lib/cases/case-command";
import { prepareContractChangePackage } from "@/lib/contracts/contract-change-package";
import { contractChangeServiceKeys } from "@/lib/contracts/contract-change-service";
import { makeIdempotencyKey } from "@/lib/jobs/idempotency";
import { buildBrandedEmailHtml } from "@/lib/messages/email-template";
import { deliverMessage, enqueueMessageJob } from "@/lib/messages/message-engine";
import { captureException } from "@/lib/monitoring";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { userIsAdmin } from "@/payload/access/roles";

export const maxDuration = 60;

const schema = z.object({
  decision: z.enum(["close", "continue", "alternative", "schedule_follow_up", "do_not_contact"]),
  reason: z.string().trim().min(10).max(2_000),
  followUpAt: z.string().datetime().optional(),
  targetServiceKey: z.enum(contractChangeServiceKeys).optional(),
}).superRefine((value, context) => {
  if (value.decision === "schedule_follow_up" && !value.followUpAt) {
    context.addIssue({ code: "custom", message: "Follow-up date is required", path: ["followUpAt"] });
  }
  if (value.decision === "alternative" && !value.targetServiceKey) {
    context.addIssue({ code: "custom", message: "Replacement service is required", path: ["targetServiceKey"] });
  }
});

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers: request.headers });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!userIsAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid decision", details: parsed.error.flatten() }, { status: 400 });

    const contractRequest = await payload.findByID({ collection: "customer-contract-requests", id: Number(id), depth: 0, overrideAccess: true });
    const leadId = relationId(contractRequest.lead);
    if (!leadId) throw new TypeError("The request has no customer case");
    if (["closed", "recovered", "do_not_contact"].includes(contractRequest.status)) {
      return NextResponse.json({ ok: true, status: contractRequest.status, idempotent: true });
    }
    const lead = await payload.findByID({ collection: "leads", id: leadId, depth: 0, overrideAccess: true });
    const workOrders = await payload.find({ collection: "work-orders", depth: 0, limit: 1, sort: "-createdAt", overrideAccess: true, where: { lead: { equals: leadId } } });
    const workOrder = workOrders.docs[0];
    const now = new Date().toISOString();
    const closes = parsed.data.decision === "close" || parsed.data.decision === "do_not_contact";
    const resumes = parsed.data.decision === "continue";
    if (closes && !lead.email) {
      throw new TypeError("Customer email is required before the closure can be confirmed");
    }

    let revisedPackage: Awaited<ReturnType<typeof prepareContractChangePackage>> | undefined;
    if (parsed.data.decision === "alternative") {
      if (workOrder) throw new TypeError("A started work flow must be changed through a controlled work change agreement");
      revisedPackage = await prepareContractChangePackage(payload, {
        administratorId: user.id,
        contractRequestId: contractRequest.id,
        leadId,
        targetServiceKey: parsed.data.targetServiceKey!,
      });
      const staleHoldingDrafts = await payload.find({ collection: "messages", depth: 0, limit: 20, overrideAccess: true, where: { and: [
        { lead: { equals: leadId } },
        { category: { equals: "follow_up" } },
        { status: { equals: "draft" } },
      ] } });
      for (const draft of staleHoldingDrafts.docs) {
        const analysis = draft.aiAnalysis && typeof draft.aiAnalysis === "object" ? draft.aiAnalysis as Record<string, unknown> : {};
        if (analysis.customerContractRequestId === contractRequest.id && analysis.decision === "alternative") {
          await payload.update({ collection: "messages", id: draft.id, overrideAccess: true, data: { status: "cancelled" } });
        }
      }
    }

    if ((closes || resumes) && workOrder && workOrder.status === "blocked" && Array.isArray(workOrder.blockingReasons) && workOrder.blockingReasons.includes("CUSTOMER_CANCELLATION_REQUEST")) {
      const previousStatus = workOrder.statusBeforeCustomerCancellation;
      const restored: "unassigned" | "assigned" | "scheduled" | "on_way" = previousStatus && ["unassigned", "assigned", "scheduled", "on_way"].includes(previousStatus)
        ? previousStatus as "unassigned" | "assigned" | "scheduled" | "on_way"
        : "unassigned";
      await payload.update({ collection: "work-orders", id: workOrder.id, overrideAccess: true, data: {
        status: closes ? "cancelled" : restored,
        blockingReasons: workOrder.blockingReasons.filter((item) => item !== "CUSTOMER_CANCELLATION_REQUEST"),
        customerCancellationResolvedAt: now,
        customerCancellationResolution: `${parsed.data.decision}: ${parsed.data.reason}`,
      } });
    }

    const status = parsed.data.decision === "close" ? "closed"
      : parsed.data.decision === "continue" ? "recovered"
      : parsed.data.decision === "alternative" ? "alternative_requested"
      : parsed.data.decision === "schedule_follow_up" ? "follow_up_scheduled"
      : "do_not_contact";
    await payload.update({ collection: "customer-contract-requests", id: contractRequest.id, overrideAccess: true, data: {
      status,
      administratorDecision: parsed.data.reason,
      reviewedBy: user.id,
      reviewedAt: now,
      ...(parsed.data.followUpAt ? { followUpAt: parsed.data.followUpAt } : {}),
      ...(closes ? { closedAt: now } : {}),
      ...(parsed.data.decision === "do_not_contact" ? { recoveryPotential: "red" } : {}),
      ...(parsed.data.decision === "continue" ? { recoveryPotential: "green", followUpOutcome: "Avtalen fortsetter etter administratoravklaring." } : {}),
      ...(parsed.data.decision === "alternative" && revisedPackage ? {
        followUpOutcome: `Revidert tilbud ${revisedPackage.quote.reference} er klargjort for administratorkontroll.`,
      } : {}),
    } });

    let delivery: "draft" | "queued" | "sent" | undefined;
    let messageId: number | undefined;
    if (closes || resumes) {
      const subject = closes
        ? contractRequest.kind === "withdrawal" ? "Bekreftelse på behandlet angremelding" : "Bekreftelse på avsluttet bestilling"
        : "Avklaring – avtalen fortsetter";
      const bodyText = closes
        ? contractRequest.kind === "withdrawal"
          ? `Hei ${lead.name},\n\nVi har behandlet angremeldingen din og bekrefter at avtalen er avsluttet. Eventuell planlagt arbeidsstart er stoppet. Dersom det er registrert en betaling, følger vi opp tilbakebetaling eller avregning separat skriftlig.\n\nDette er en skriftlig bekreftelse fra Takfornyelse.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`
          : `Hei ${lead.name},\n\nVi har behandlet forespørselen din og bekrefter at bestillingen er avsluttet. Eventuell planlagt arbeidsstart er stoppet. Dersom det er registrert en betaling, følger vi opp tilbakebetaling eller avregning separat skriftlig.\n\nDette er en skriftlig bekreftelse fra Takfornyelse.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`
        : `Hei ${lead.name},\n\nVi har avklart forespørselen din. Avtalen fortsetter, og vi følger opp videre planlegging skriftlig.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`;
      const message = await payload.create({ collection: "messages", overrideAccess: true, data: {
        lead: leadId,
        replyToMessage: relationId(contractRequest.sourceMessage) || undefined,
        direction: "outbound",
        category: "follow_up",
        channel: lead.email ? "email" : "sms",
        subject,
        bodyText,
        bodyHtml: buildBrandedEmailHtml({ subject, text: bodyText }),
        status: closes ? "queued" : "draft",
        idempotencyKey: makeIdempotencyKey("contract-request.decision", { requestId: contractRequest.id, decision: parsed.data.decision }),
        aiAssisted: false,
        aiAnalysis: { customerContractRequestId: contractRequest.id, decision: parsed.data.decision },
        ...(closes ? { approvedBy: user.id, approvedAt: now, queuedAt: now } : {}),
      } });
      messageId = message.id;
      delivery = closes ? "queued" : "draft";
      if (closes) {
        await enqueueMessageJob(payload, message.id, correlationId);
        const provider = createEmailProvider();
        if (provider.health().status === "ready") {
          try {
            await deliverMessage(payload, provider, message.id, correlationId);
            delivery = "sent";
          } catch (error) {
            captureException(error, { route: "POST /api/admin/customer-contract-requests/[id]", operation: "closure-confirmation-delivery", correlationId });
          }
        }
      }
    }

    await updateCaseState(payload, { leadId, actorId: user.id, command: "resolve_customer_contract_request", idempotencyKey: `${correlationId}:contract-request:${contractRequest.id}`, patch: closes ? {
      status: "closed", nextActionOwner: "system", nextActionBlocker: null, nextAction: "Sluttbekreftelsen er sendt eller lagt i utsendingskø. Saken kan arkiveres.", nextActionAt: null, closedAt: now,
    } : resumes ? {
      status: "converted", nextActionOwner: "administrator", nextActionBlocker: null, nextAction: workOrder ? "Kontroller gjenopptatt arbeidsplan og send kundemeldingen." : "Fortsett planleggingen og send kundemeldingen.", nextActionAt: now, closedAt: null,
    } : parsed.data.decision === "alternative" && revisedPackage ? {
      status: "quoted",
      inquiryType: parsed.data.targetServiceKey,
      nextActionOwner: "administrator",
      nextActionBlocker: null,
      nextAction: `Kontroller revidert tilbud ${revisedPackage.quote.reference} og kontraktsutkast ${revisedPackage.contract.reference}. Godkjenn først etter at pris og vilkår er kontrollert.`,
      nextActionAt: now,
      closedAt: null,
    } : {
      status: "customer_waiting", nextActionOwner: "administrator", nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST",
      nextAction: parsed.data.decision === "alternative" ? "Lag et alternativt tilbud. Arbeidet forblir sperret." : "Følg opp på valgt dato. Arbeidet forblir sperret.",
      nextActionAt: parsed.data.followUpAt || now, closedAt: null,
    } });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "customer.contract_request_reviewed",
      entityType: "customer_contract_request",
      entityId: contractRequest.id,
      correlationId,
      changedFields: ["status", "administratorDecision", "reviewedAt", "workHold"],
      metadata: {
        decision: parsed.data.decision,
        leadId,
        workOrderId: workOrder?.id || null,
        revisedQuoteId: revisedPackage?.quote.id || null,
        revisedContractId: revisedPackage?.contract.id || null,
        targetServiceKey: parsed.data.targetServiceKey || null,
      },
    });
    return NextResponse.json({
      ok: true,
      status,
      messageId,
      delivery,
      revisedQuoteId: revisedPackage?.quote.id,
      revisedContractId: revisedPackage?.contract.id,
      duplicate: revisedPackage?.duplicate,
    });
  } catch (error) {
    captureException(error, { route: "POST /api/admin/customer-contract-requests/[id]", correlationId });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Decision failed", correlationId }, { status: error instanceof TypeError ? 409 : 500 });
  }
}
