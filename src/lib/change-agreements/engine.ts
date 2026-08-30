import type { Payload } from "payload";
import { enqueueMessageJob } from "@/lib/messages/message-engine";
import { quoteSnapshotSchema } from "@/lib/quotes/document";
import { appendTimeline, relationId } from "@/lib/work-orders/access";
import { buildChangeAgreementSnapshot, changeDocumentHash } from "./document";
import { issueChangeAccessToken } from "./customer-access";

export async function createChangeAgreementDraft(
  payload: Payload,
  input: {
    workOrderId: number;
    proposedTotalIncVatOre?: number;
    reasonDescription?: string;
  },
  now = new Date(),
) {
  const order = await payload.findByID({
    collection: "work-orders",
    id: input.workOrderId,
    depth: 0,
    overrideAccess: true,
  });
  if (order.status !== "blocked")
    throw new Error("Only a blocked work order can receive a change agreement");
  if (order.priceOutcome === "hms_blocked")
    throw new Error(
      "HMS risk cannot be approved through a price change agreement",
    );
  if (
    !order.priceOutcome ||
    !["over_tolerance", "over_maximum", "scope_change"].includes(
      order.priceOutcome,
    )
  )
    throw new Error("The blocked outcome does not require a change agreement");
  const contractId = relationId(order.contract);
  const quoteId = relationId(order.quote);
  if (!contractId || !quoteId)
    throw new Error("Work order contract basis is incomplete");
  const [contract, quote, existing] = await Promise.all([
    payload.findByID({
      collection: "contracts",
      id: contractId,
      depth: 0,
      overrideAccess: true,
    }),
    payload.findByID({
      collection: "quotes",
      id: quoteId,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: "change-agreements",
      depth: 0,
      limit: 1,
      sort: "-version",
      overrideAccess: true,
      where: { workOrder: { equals: order.id } },
    }),
  ]);
  if (contract.status !== "signed" || quote.status !== "accepted")
    throw new Error("Signed contract and accepted quote are required");
  const quoteSnapshot = quoteSnapshotSchema.parse(quote.snapshot);
  const reasonCode = order.priceOutcome as
    "over_tolerance" | "over_maximum" | "scope_change";
  let afterTotal = order.actualTotalIncVatOre;
  if (reasonCode === "scope_change") afterTotal = input.proposedTotalIncVatOre;
  if (!Number.isSafeInteger(afterTotal) || !afterTotal || afterTotal <= 0)
    throw new Error(
      "A controlled proposed total is required for the scope change",
    );
  const controlledAfterTotal = afterTotal as number;
  const subtotal =
    reasonCode === "scope_change"
      ? Math.round(
          (controlledAfterTotal * 10_000) /
            (10_000 + quoteSnapshot.pricing.vatBasisPoints),
        )
      : order.actualSubtotalExVatOre;
  const vat =
    reasonCode === "scope_change" && typeof subtotal === "number"
      ? controlledAfterTotal - subtotal
      : order.actualVatOre;
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(vat))
    throw new Error("The onsite price calculation is incomplete");
  if (!Number.isSafeInteger(order.actualAreaTenths) || !order.actualAreaTenths)
    throw new Error("The onsite area calculation is incomplete");
  const controlledSubtotal = subtotal as number;
  const controlledVat = vat as number;
  const description = (
    input.reasonDescription ||
    order.scopeChangeDetails ||
    (Array.isArray(order.blockingReasons)
      ? order.blockingReasons.join(" ")
      : "")
  ).trim();
  if (description.length < 5)
    throw new Error("A clear reason for the change is required");
  const previous = existing.docs[0];
  const version = (previous?.version ?? 0) + 1;
  const reference = `E-${order.id}-V${version}`;
  const snapshot = buildChangeAgreementSnapshot(
    {
      reference,
      workOrderId: order.id,
      contractId,
      contractDocumentHash: contract.documentHash,
      reasonCode,
      reasonDescription: description,
      before: {
        areaTenths: quoteSnapshot.measurement.actualAreaMaxTenths,
        totalIncVatOre: quoteSnapshot.pricing.totalIncVatOre,
        maximumTotalIncVatOre: quoteSnapshot.pricing.maximumTotalIncVatOre,
      },
      after: {
        areaTenths: order.actualAreaTenths,
        subtotalExVatOre: controlledSubtotal,
        vatOre: controlledVat,
        totalIncVatOre: controlledAfterTotal,
      },
      issuedAt: now.toISOString(),
      validUntil: new Date(now.getTime() + 14 * 24 * 60 * 60_000).toISOString(),
    },
    now,
  );
  const agreement = await payload.create({
    collection: "change-agreements",
    overrideAccess: true,
    data: {
      reference,
      workOrder: order.id,
      contract: contractId,
      version,
      supersedes: previous?.id,
      snapshot,
      documentHash: changeDocumentHash(snapshot),
      reasonCode,
      reasonDescription: description,
      beforeTotalIncVatOre: snapshot.before.totalIncVatOre,
      afterTotalIncVatOre: snapshot.after.totalIncVatOre,
      validUntil: snapshot.validUntil,
      status: "draft",
    },
  });
  if (
    previous &&
    ["draft", "approved", "sent", "viewed"].includes(previous.status)
  )
    await payload.update({
      collection: "change-agreements",
      id: previous.id,
      overrideAccess: true,
      data: { status: "superseded" },
    });
  return agreement;
}

export async function issueChangeAgreement(
  payload: Payload,
  agreementId: number,
  origin: string,
  correlationId: string,
  actorId: number,
) {
  const agreement = await payload.findByID({
    collection: "change-agreements",
    id: agreementId,
    depth: 0,
    overrideAccess: true,
  });
  if (agreement.status !== "approved")
    throw new Error("Only an approved change agreement can be sent");
  const order = await payload.findByID({
    collection: "work-orders",
    id: relationId(agreement.workOrder)!,
    depth: 0,
    overrideAccess: true,
  });
  const lead = await payload.findByID({
    collection: "leads",
    id: relationId(order.lead)!,
    depth: 0,
    overrideAccess: true,
  });
  if (lead.preferredChannel === "sms")
    throw new Error(
      "Kunden har valgt SMS. SMS-levering er ikke konfigurert; velg e-post med kundens samtykke før utsending.",
    );
  if (!lead.email)
    throw new Error("Customer email is required to send a change agreement");
  const access = await issueChangeAccessToken(
    payload,
    agreement.id,
    agreement.validUntil,
  );
  const url = `${origin.replace(/\/$/, "")}/endring/${access.token}`;
  const message = await payload.create({
    collection: "messages",
    overrideAccess: true,
    data: {
      lead: lead.id,
      direction: "outbound",
      category: "change_agreement",
      channel: "email",
      subject: `Endringsavtale ${agreement.reference}`,
      bodyText: `Hei ${lead.name},\n\nKontrollen på stedet viser et avvik som må godkjennes skriftlig før berørt arbeid kan starte. Se før-/etter-beløp, årsak og svar her:\n${url}\n\nArbeidet som berøres av avviket er blokkert til du har svart.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`,
      status: "queued",
      idempotencyKey: `change-agreement:${agreement.id}:v${agreement.version}`,
      aiAssisted: false,
      approvedAt: new Date().toISOString(),
      queuedAt: new Date().toISOString(),
      aiAnalysis: { changeAgreementId: agreement.id },
    },
  });
  await enqueueMessageJob(payload, message.id, correlationId, "admin_approved");
  await payload.update({
    collection: "change-agreements",
    id: agreement.id,
    overrideAccess: true,
    data: { status: "sent", sentAt: new Date().toISOString() },
  });
  await payload.update({
    collection: "work-orders",
    id: order.id,
    overrideAccess: true,
    context: { trustedWorkerAction: true },
    data: {
      eventTimeline: appendTimeline(order.eventTimeline, {
        action: "change-agreement.issued",
        actorId,
        changedFields: ["changeAgreement"],
      }),
    },
  });
  return { message, url };
}
