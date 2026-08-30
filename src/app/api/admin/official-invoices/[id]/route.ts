import { NextResponse } from "next/server";
import { z } from "zod";
import { createPayloadAuditWriter } from "@/lib/audit/payload-audit-writer";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import {
  assertPaymentReminderCooldown,
  assertPaymentReminderInvoiceReady,
  paymentReminderKey,
  paymentReminderPrefix,
} from "@/lib/invoices/payment-reminder-policy";
import { withPaymentInvoiceOperationLock } from "@/lib/invoices/payment-operation-lock";
import {
  deliverMessage,
  enqueueMessageJob,
} from "@/lib/messages/message-engine";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { userIsAdmin } from "@/payload/access/roles";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    invoiceNumber: z.string().trim().min(1).max(80),
    issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    subtotalExVatOre: z.number().int().min(0),
    vatOre: z.number().int().min(0),
    totalIncVatOre: z.number().int().min(1),
    adminNote: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("send") }),
  z.object({ action: z.literal("check_bank") }),
  z.object({
    action: z.literal("record_payment"),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paidAmountOre: z.number().int().positive(),
    bankReference: z.string().trim().max(160).optional(),
  }),
  z.object({ action: z.literal("draft_reminder") }),
]);

function relationId(value: unknown) {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "number"
  )
    return (value as { id: number }).id;
  return null;
}

function formatNok(ore: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
  }).format(ore / 100);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id))
    return NextResponse.json(
      { error: "Invalid official invoice" },
      { status: 400 },
    );
  const payload = await getPayload();
  const { user } = await payload.auth({ headers: request.headers });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!userIsAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message || "Invalid invoice confirmation",
      },
      { status: 400 },
    );

  try {
    const current = await payload.findByID({
      collection: "official-invoices",
      id: Number(id),
      depth: 0,
      overrideAccess: true,
    });
    const correlationId = correlationIdFromHeaders(request.headers);
    const leadId = relationId(current.lead);
    const invoiceRecordId = relationId(current.invoiceRecord);
    if (!leadId || !invoiceRecordId)
      throw new Error("Official invoice relationships are incomplete");

    if (parsed.data.action === "check_bank") {
      if (["paid", "credited", "cancelled"].includes(current.status))
        throw new Error("This invoice no longer requires a bank check");
      const checkedAt = new Date().toISOString();
      const updated = await payload.update({
        collection: "official-invoices",
        id: current.id,
        depth: 0,
        overrideAccess: true,
        data: { bankCheckedAt: checkedAt, bankCheckedBy: user.id },
      });
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "official-invoice.bank-checked",
        entityType: "official-invoice",
        entityId: current.id,
        correlationId,
        changedFields: ["bankCheckedAt", "bankCheckedBy"],
      });
      return NextResponse.json({
        ok: true,
        status: updated.status,
        bankCheckedAt: checkedAt,
      });
    }

    if (parsed.data.action === "record_payment") {
      const paymentInput = parsed.data;
      return await withPaymentInvoiceOperationLock(
        payload,
        current.id,
        async () => {
          const lockedInvoice = await payload.findByID({
            collection: "official-invoices",
            id: current.id,
            depth: 0,
            overrideAccess: true,
          });
          const lockedInvoiceRecordId = relationId(lockedInvoice.invoiceRecord);
          if (!relationId(lockedInvoice.lead) || !lockedInvoiceRecordId)
            throw new Error("Official invoice relationships are incomplete");
          if (
            !["sent", "awaiting_payment", "overdue"].includes(
              lockedInvoice.status,
            )
          )
            throw new Error("Only a sent invoice can be marked as paid");
          if (paymentInput.paidAmountOre < (lockedInvoice.totalIncVatOre || 0))
            throw new Error(
              "The registered amount is lower than the invoice total; partial payment requires manual review",
            );
          const paidAt = new Date(
            `${paymentInput.paidAt}T12:00:00.000Z`,
          ).toISOString();
          const updated = await payload.update({
            collection: "official-invoices",
            id: lockedInvoice.id,
            depth: 0,
            overrideAccess: true,
            data: {
              status: "paid",
              paidAt,
              paidAmountOre: paymentInput.paidAmountOre,
              bankReference: paymentInput.bankReference || null,
              bankCheckedAt: new Date().toISOString(),
              bankCheckedBy: user.id,
            },
          });
          const basis = await payload.findByID({
            collection: "invoice-records",
            id: lockedInvoiceRecordId,
            depth: 0,
            overrideAccess: true,
          });
          if (["exported", "sent", "overdue"].includes(basis.status))
            await payload.update({
              collection: "invoice-records",
              id: basis.id,
              depth: 0,
              overrideAccess: true,
              data: { status: "paid" },
            });
          await recordAuditEvent(createPayloadAuditWriter(payload), {
            actorId: user.id,
            action: "official-invoice.payment-recorded",
            entityType: "official-invoice",
            entityId: lockedInvoice.id,
            correlationId,
            changedFields: [
              "status",
              "paidAt",
              "paidAmountOre",
              "bankReference",
              "bankCheckedAt",
              "bankCheckedBy",
            ],
            metadata: { paidAmountOre: paymentInput.paidAmountOre },
          });
          return NextResponse.json({
            ok: true,
            status: updated.status,
            paidAt,
          });
        },
      );
    }

    if (parsed.data.action === "draft_reminder") {
      const reminderNow = new Date();
      assertPaymentReminderInvoiceReady(current, reminderNow);
      const reminderKey = paymentReminderKey(current.id, reminderNow);
      const prior = await payload.find({
        collection: "messages",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { idempotencyKey: { equals: reminderKey } },
      });
      if (!prior.docs[0]) {
        const history = await payload.find({
          collection: "messages",
          depth: 0,
          limit: 20,
          sort: "-createdAt",
          overrideAccess: true,
          where: {
            idempotencyKey: { contains: paymentReminderPrefix(current.id) },
          },
        });
        assertPaymentReminderCooldown(history.docs, reminderNow);
      }
      const message =
        prior.docs[0] ||
        (await payload.create({
          collection: "messages",
          overrideAccess: true,
          data: {
            lead: leadId,
            direction: "outbound",
            category: "reminder",
            channel: "email",
            subject: `Vennlig påminnelse om faktura ${current.invoiceNumber}`,
            bodyText: `Hei,\n\nVi kan ikke se at faktura ${current.invoiceNumber} på ${formatNok(current.totalIncVatOre || 0)} med forfall ${new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeZone: "Europe/Oslo" }).format(new Date(current.dueAt))} er registrert betalt hos oss. Dersom du allerede har betalt, kan du se bort fra denne meldingen. Ta gjerne kontakt hvis noe er uklart.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`,
            status: "draft",
            idempotencyKey: reminderKey,
            aiAssisted: false,
            aiAnalysis: {
              officialInvoiceId: current.id,
              financeAction: "payment_reminder",
              bankCheckedAt: current.bankCheckedAt,
            },
          },
        }));
      if (current.status !== "overdue")
        await payload.update({
          collection: "official-invoices",
          id: current.id,
          depth: 0,
          overrideAccess: true,
          data: { status: "overdue" },
        });
      const basis = await payload.findByID({
        collection: "invoice-records",
        id: invoiceRecordId,
        depth: 0,
        overrideAccess: true,
      });
      if (basis.status === "sent")
        await payload.update({
          collection: "invoice-records",
          id: basis.id,
          depth: 0,
          overrideAccess: true,
          data: { status: "overdue" },
        });
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "official-invoice.reminder-drafted",
        entityType: "official-invoice",
        entityId: current.id,
        correlationId,
        changedFields: ["status"],
        metadata: {
          messageId: message.id,
          bankCheckedAt: current.bankCheckedAt,
        },
      });
      return NextResponse.json({
        ok: true,
        status: "draft",
        messageId: message.id,
        duplicate: Boolean(prior.docs[0]),
      });
    }

    if (parsed.data.action === "send") {
      if (
        current.extractionStatus !== "confirmed" ||
        current.status !== "issued"
      )
        throw new Error("Confirm the official invoice before sending it");
      const documentId = relationId(current.originalDocument);
      if (!documentId) throw new Error("Original Fiken PDF is missing");
      const key = `official-invoice-send:${current.id}`;
      const prior = await payload.find({
        collection: "messages",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { idempotencyKey: { equals: key } },
      });
      const now = new Date().toISOString();
      const message =
        prior.docs[0] ||
        (await payload.create({
          collection: "messages",
          overrideAccess: true,
          data: {
            lead: leadId,
            direction: "outbound",
            category: "invoice",
            channel: "email",
            subject: `Faktura ${current.invoiceNumber} fra Takfornyelse`,
            bodyText: `Hei,\n\nVedlagt finner du faktura ${current.invoiceNumber} på ${formatNok(current.totalIncVatOre || 0)}. Forfallsdato er ${new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeZone: "Europe/Oslo" }).format(new Date(current.dueAt || now))}. Ta gjerne kontakt dersom du har spørsmål.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`,
            attachments: [documentId],
            status: "queued",
            idempotencyKey: key,
            aiAssisted: false,
            aiAnalysis: {
              officialInvoiceId: current.id,
              financeAction: "official_invoice",
            },
            approvedBy: user.id,
            approvedAt: now,
            queuedAt: now,
          },
        }));
      await enqueueMessageJob(
        payload,
        message.id,
        correlationId,
        "admin_approved",
      );
      const provider = createEmailProvider();
      let delivery: "queued" | "sent" = "queued";
      if (provider.health().status === "ready") {
        await deliverMessage(
          payload,
          provider,
          message.id,
          correlationId,
          "admin_approved",
        );
        delivery = "sent";
      }
      await recordAuditEvent(createPayloadAuditWriter(payload), {
        actorId: user.id,
        action: "official-invoice.send-approved",
        entityType: "official-invoice",
        entityId: current.id,
        correlationId,
        changedFields: ["message"],
        metadata: { messageId: message.id, delivery },
      });
      return NextResponse.json({
        ok: true,
        delivery,
        messageId: message.id,
        duplicate: Boolean(prior.docs[0]),
      });
    }

    const issuedAt = new Date(`${parsed.data.issuedAt}T12:00:00.000Z`);
    const dueAt = new Date(`${parsed.data.dueAt}T12:00:00.000Z`);
    if (dueAt < issuedAt)
      return NextResponse.json(
        { error: "Due date cannot be earlier than invoice date" },
        { status: 400 },
      );
    if (
      parsed.data.subtotalExVatOre + parsed.data.vatOre !==
      parsed.data.totalIncVatOre
    )
      return NextResponse.json(
        { error: "Subtotal plus VAT must equal the total" },
        { status: 400 },
      );
    if (current.extractionStatus === "confirmed")
      return NextResponse.json(
        { error: "This official invoice has already been confirmed" },
        { status: 409 },
      );
    const duplicateNumber = await payload.find({
      collection: "official-invoices",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          { invoiceNumber: { equals: parsed.data.invoiceNumber } },
          { id: { not_equals: current.id } },
        ],
      },
    });
    if (duplicateNumber.docs[0])
      return NextResponse.json(
        { error: "This Fiken invoice number is already registered" },
        { status: 409 },
      );
    const now = new Date().toISOString();
    const updated = await payload.update({
      collection: "official-invoices",
      id: current.id,
      depth: 0,
      overrideAccess: true,
      data: {
        status: "issued",
        extractionStatus: "confirmed",
        invoiceNumber: parsed.data.invoiceNumber,
        issuedAt: issuedAt.toISOString(),
        dueAt: dueAt.toISOString(),
        subtotalExVatOre: parsed.data.subtotalExVatOre,
        vatOre: parsed.data.vatOre,
        totalIncVatOre: parsed.data.totalIncVatOre,
        confirmedBy: user.id,
        confirmedAt: now,
        adminNote: parsed.data.adminNote || null,
      },
    });
    const invoiceRecord = await payload.findByID({
      collection: "invoice-records",
      id: invoiceRecordId,
      depth: 0,
      overrideAccess: true,
    });
    if (invoiceRecord.status === "approved")
      await payload.update({
        collection: "invoice-records",
        id: invoiceRecord.id,
        depth: 0,
        overrideAccess: true,
        data: {
          status: "exported",
          externalReference: parsed.data.invoiceNumber,
        },
      });
    await recordAuditEvent(createPayloadAuditWriter(payload), {
      actorId: user.id,
      action: "official-invoice.metadata-confirmed",
      entityType: "official-invoice",
      entityId: updated.id,
      correlationId,
      changedFields: [
        "status",
        "extractionStatus",
        "invoiceNumber",
        "issuedAt",
        "dueAt",
        "subtotalExVatOre",
        "vatOre",
        "totalIncVatOre",
        "confirmedBy",
        "confirmedAt",
      ],
      metadata: { invoiceRecordId },
    });
    return NextResponse.json({
      ok: true,
      status: updated.status,
      invoiceNumber: updated.invoiceNumber,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Official invoice confirmation failed",
      },
      { status: 409 },
    );
  }
}
