import { createHash } from "node:crypto";
import type { Payload } from "payload";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { updateCaseState } from "@/lib/cases/case-command";
import { buildBrandedEmailHtml } from "@/lib/messages/email-template";
import { enqueueMessageJob } from "@/lib/messages/message-engine";

export const contractRequestReasonCodes = [
  "price",
  "wait",
  "timing",
  "other_supplier",
  "scope",
  "need_information",
  "personal_financial",
  "communication",
  "not_needed",
  "other",
  "prefer_not_to_say",
] as const;

export const customerContractRequestSchema = z.object({
  action: z.enum(["withdrawal", "change_or_cancel"]),
  reasonCode: z.enum(contractRequestReasonCodes),
  reasonText: z.string().trim().max(2_000).optional(),
  followUpConsent: z.boolean(),
  preferredFollowUp: z.enum(["one_month", "three_months", "six_months", "next_spring", "custom", "never"]).optional(),
  preferredFollowUpAt: z.string().datetime().optional(),
}).superRefine((value, context) => {
  if (value.reasonCode === "other" && (!value.reasonText || value.reasonText.length < 3)) {
    context.addIssue({ code: "custom", message: "Please describe the other reason", path: ["reasonText"] });
  }
  if (value.preferredFollowUp === "custom" && !value.preferredFollowUpAt) {
    context.addIssue({ code: "custom", message: "Choose a follow-up date", path: ["preferredFollowUpAt"] });
  }
  if (!value.followUpConsent && value.preferredFollowUp && value.preferredFollowUp !== "never") {
    context.addIssue({ code: "custom", message: "Follow-up timing requires consent", path: ["preferredFollowUp"] });
  }
});

export type CustomerContractRequestInput = z.infer<typeof customerContractRequestSchema>;

export const reasonLabelsNo: Record<(typeof contractRequestReasonCodes)[number], string> = {
  price: "Prisen passer ikke",
  wait: "Jeg vil vente / ikke gjøre dette nå",
  timing: "Tidspunktet passer ikke",
  other_supplier: "Jeg har valgt en annen leverandør",
  scope: "Tilbudet eller omfanget passer ikke",
  need_information: "Jeg trenger mer informasjon",
  personal_financial: "Personlige eller økonomiske årsaker",
  communication: "Kommunikasjonen fungerte ikke som forventet",
  not_needed: "Tjenesten er ikke lenger nødvendig",
  other: "Annen årsak",
  prefer_not_to_say: "Jeg ønsker ikke å oppgi årsak",
};

export function nominalWithdrawalAssessment(signedAt: string | null | undefined, now: Date) {
  if (!signedAt) return { deadline: undefined, withinPeriod: undefined };
  const deadline = new Date(new Date(signedAt).getTime() + 14 * 24 * 60 * 60_000);
  return { deadline: deadline.toISOString(), withinPeriod: now.getTime() <= deadline.getTime() };
}

export function suggestedFollowUpAt(
  choice: CustomerContractRequestInput["preferredFollowUp"],
  customDate: string | undefined,
  now: Date,
) {
  if (!choice || choice === "never") return undefined;
  if (choice === "custom") return customDate;
  const date = new Date(now);
  if (choice === "one_month") date.setUTCMonth(date.getUTCMonth() + 1);
  if (choice === "three_months") date.setUTCMonth(date.getUTCMonth() + 3);
  if (choice === "six_months") date.setUTCMonth(date.getUTCMonth() + 6);
  if (choice === "next_spring") {
    const year = date.getUTCMonth() >= 4 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
    date.setUTCFullYear(year, 2, 15);
    date.setUTCHours(9, 0, 0, 0);
  }
  return date.toISOString();
}

export function recoveryPotential(input: CustomerContractRequestInput) {
  if (input.preferredFollowUp === "never") return "red" as const;
  if (input.followUpConsent) return "green" as const;
  return "yellow" as const;
}

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

function signatureValue(value: unknown, key: string) {
  return value && typeof value === "object" && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

function acknowledgementCopy(input: { customer: string; contractReference: string; kind: CustomerContractRequestInput["action"]; receivedAt: string }) {
  const received = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" }).format(new Date(input.receivedAt));
  if (input.kind === "withdrawal") {
    return {
      subject: `Vi har mottatt angremeldingen din – ${input.contractReference}`,
      body: `Hei ${input.customer},\n\nVi bekrefter at vi mottok meldingen din om bruk av angreretten for avtale ${input.contractReference} ${received}. Eventuell arbeidsstart er satt på pause mens saken registreres og kontrolleres. Du trenger ikke å oppgi noen grunn for å bruke angreretten.\n\nVi følger opp skriftlig når registreringen er ferdig. Dersom det haster, kan du ringe oss på 47 73 58 88.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`,
    };
  }
  return {
    subject: `Vi har mottatt forespørselen din – ${input.contractReference}`,
    body: `Hei ${input.customer},\n\nVi bekrefter at vi mottok forespørselen din om å endre eller kansellere avtale ${input.contractReference} ${received}. Eventuell arbeidsstart er satt på pause mens administrator vurderer forespørselen. Avtalen er ikke endret eller avsluttet før du mottar en skriftlig bekreftelse fra oss.\n\nVi følger opp så snart saken er vurdert. Dersom det haster, kan du ringe oss på 47 73 58 88.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`,
  };
}

export async function recordCustomerContractRequest(payload: Payload, input: {
  correlationId: string;
  customer: string;
  leadId: number;
  quoteId: number;
  contractId: number;
  contractReference: string;
  contractSignedAt?: string | null;
  companySignedAt?: string | null;
  signatureEvidence?: unknown;
  quoteSnapshot?: unknown;
  request: CustomerContractRequestInput;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const receivedAt = now.toISOString();
  // De-duplicate browser retries on the same day without preventing the
  // customer from submitting a genuinely new request later in the contract.
  const normalized = JSON.stringify({
    contractId: input.contractId,
    requestDate: now.toISOString().slice(0, 10),
    ...input.request,
  });
  const fingerprint = createHash("sha256").update(normalized).digest("hex");
  const existing = await payload.find({
    collection: "customer-contract-requests",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { requestFingerprint: { equals: fingerprint } },
  });
  if (existing.docs[0]) return { duplicate: true as const, request: existing.docs[0] };

  const requestHistory = await payload.find({
    collection: "customer-contract-requests",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { lead: { equals: input.leadId } },
  });
  const requestVersion = requestHistory.totalDocs + 1;

  const workOrders = await payload.find({ collection: "work-orders", depth: 0, limit: 1, sort: "-createdAt", overrideAccess: true, where: { lead: { equals: input.leadId } } });
  const workOrder = workOrders.docs[0];
  const reasonLabel = reasonLabelsNo[input.request.reasonCode];
  const kindLabel = input.request.action === "withdrawal" ? "Bruk av angrerett" : "Endring eller kansellering";
  const bodyText = [
    kindLabel,
    `Avtale: ${input.contractReference}`,
    `Årsak: ${reasonLabel}`,
    input.request.reasonText ? `Kundens kommentar: ${input.request.reasonText}` : null,
    `Samtykke til én oppfølging: ${input.request.followUpConsent ? "Ja" : "Nei"}`,
    input.request.preferredFollowUp ? `Ønsket oppfølgingstid: ${input.request.preferredFollowUp}` : null,
  ].filter(Boolean).join("\n");
  const sourceMessage = await payload.create({ collection: "messages", overrideAccess: true, data: {
    lead: input.leadId,
    direction: "inbound",
    category: "follow_up",
    channel: "email",
    subject: `${kindLabel} – ${input.contractReference}`,
    bodyText,
    status: "delivered",
    idempotencyKey: `contract-request-source:${fingerprint}`,
    aiAssisted: false,
    aiAnalysis: { purpose: input.request.action, reasonCode: input.request.reasonCode, followUpConsent: input.request.followUpConsent },
    deliveredAt: receivedAt,
  } });

  if (workOrder && !["completed", "documented", "cancelled"].includes(workOrder.status)) {
    await payload.update({ collection: "work-orders", id: workOrder.id, overrideAccess: true, data: {
      statusBeforeCustomerCancellation: workOrder.status === "blocked" ? workOrder.statusBeforeCustomerCancellation || "blocked" : workOrder.status,
      status: "blocked",
      customerCancellationRequestedAt: receivedAt,
      cancellationRequestMessage: sourceMessage.id,
      blockingReasons: [...new Set([...(Array.isArray(workOrder.blockingReasons) ? workOrder.blockingReasons : []), "CUSTOMER_CANCELLATION_REQUEST"])],
    } });
  }

  const assessment = nominalWithdrawalAssessment(input.contractSignedAt, now);
  const customFollowUpAt = input.request.followUpConsent
    ? suggestedFollowUpAt(input.request.preferredFollowUp, input.request.preferredFollowUpAt, now)
    : undefined;
  const earlyStartRequested = signatureValue(input.signatureEvidence, "earlyStartRequested") === true;
  const quotePricing = input.quoteSnapshot && typeof input.quoteSnapshot === "object" && "pricing" in input.quoteSnapshot
    ? (input.quoteSnapshot as { pricing?: Record<string, unknown> }).pricing
    : undefined;
  const depositBasisPoints = typeof quotePricing?.depositBasisPoints === "number" ? quotePricing.depositBasisPoints : 0;
  const potential = recoveryPotential(input.request);
  const requestRecord = await payload.create({ collection: "customer-contract-requests", overrideAccess: true, data: {
    reference: `${input.request.action === "withdrawal" ? "ANG" : "END"}-${input.leadId}-V${requestVersion}`,
    lead: input.leadId,
    quote: input.quoteId,
    contract: input.contractId,
    ...(workOrder ? { workOrder: workOrder.id } : {}),
    kind: input.request.action,
    reasonCode: input.request.reasonCode,
    reasonText: input.request.reasonText || null,
    followUpConsent: input.request.followUpConsent,
    preferredFollowUp: input.request.followUpConsent ? input.request.preferredFollowUp || null : input.request.preferredFollowUp === "never" ? "never" : null,
    preferredFollowUpAt: customFollowUpAt || null,
    status: "admin_review",
    recoveryPotential: potential,
    receivedAt,
    contractSignedAt: input.contractSignedAt || null,
    companySignedAt: input.companySignedAt || null,
    nominalWithdrawalDeadline: assessment.deadline || null,
    withinNominalWithdrawalPeriod: assessment.withinPeriod ?? null,
    earlyStartRequested,
    workStatusAtReceipt: workOrder?.status || "not_created",
    depositStatusAtReceipt: depositBasisPoints > 0 ? "required_unverified" : "not_required",
    sourceMessage: sourceMessage.id,
    requestFingerprint: fingerprint,
    followUpAt: customFollowUpAt || null,
    aiSummary: `${kindLabel}. ${reasonLabel}. ${input.request.followUpConsent ? "Kunden tillater én oppfølging." : "Ingen samtykke til salgsoppfølging."}`,
    aiSuggestedAction: potential === "green" ? "Kontroller rettslig og operativ status, og vurder ett relevant alternativ innen samtykket." : potential === "red" ? "Behandle meldingen uten salgsoppfølging." : "Administrator må vurdere saken uten automatisk salgsoppfølging.",
  } });

  const acknowledgement = acknowledgementCopy({ customer: input.customer, contractReference: input.contractReference, kind: input.request.action, receivedAt });
  const message = await payload.create({ collection: "messages", overrideAccess: true, data: {
    lead: input.leadId,
    direction: "outbound",
    category: "follow_up",
    channel: "email",
    subject: acknowledgement.subject,
    bodyText: acknowledgement.body,
    bodyHtml: buildBrandedEmailHtml({ subject: acknowledgement.subject, text: acknowledgement.body }),
    status: "queued",
    idempotencyKey: `contract-request-receipt:${requestRecord.id}`,
    aiAssisted: false,
    approvedAt: receivedAt,
    queuedAt: receivedAt,
    aiAnalysis: { customerContractRequestId: requestRecord.id, purpose: input.request.action },
  } });
  await enqueueMessageJob(payload, message.id, input.correlationId);

  await updateCaseState(payload, { leadId: input.leadId, command: "customer_contract_request_received", idempotencyKey: `customer-contract-request:${requestRecord.id}`, patch: {
    status: "customer_waiting",
    nextActionOwner: "administrator",
    nextActionBlocker: "CUSTOMER_CANCELLATION_REQUEST",
    nextAction: input.request.action === "withdrawal"
      ? `Angremelding ${requestRecord.reference} er mottatt. Kontroller frist, oppstart, arbeid og eventuell betaling før skriftlig sluttbekreftelse.`
      : `Endrings- eller kanselleringsforespørsel ${requestRecord.reference} må vurderes. Arbeidsstart er sperret inntil avgjørelse.`,
    nextActionAt: receivedAt,
  } });
  await recordAuditEvent(createPayloadAuditWriter(payload), {
    action: "customer.contract_request_received",
    entityType: "customer_contract_request",
    entityId: requestRecord.id,
    correlationId: input.correlationId,
    changedFields: ["status", "workHold", "customerReceipt"],
    metadata: { kind: input.request.action, leadId: input.leadId, contractId: input.contractId, workOrderId: relationId(workOrder) || null },
  });
  return { duplicate: false as const, request: requestRecord, acknowledgementMessage: message };
}
