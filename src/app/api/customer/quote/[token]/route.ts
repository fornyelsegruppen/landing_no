import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deliverMessage,
  enqueueCustomerReplyDraft,
  enqueueMessageJob,
} from "@/lib/messages/message-engine";
import {
  loadCustomerQuestionState,
  loadUnresolvedCustomerQuestion,
} from "@/lib/messages/customer-question-state";
import { processOperationalJobs } from "@/lib/jobs/operational-job-processor";
import { captureException } from "@/lib/monitoring";
import { correlationIdFromHeaders } from "@/lib/observability/correlation-id";
import { getPayload } from "@/lib/payload";
import { resolvePayloadSecret } from "@/lib/payload-secret";
import {
  assertFeatureReady,
  FeatureUnavailableError,
} from "@/lib/platform/features";
import {
  createSignatureEvidence,
  type ContractSnapshot,
} from "@/lib/quotes/document";
import { revokeQuoteAccessTokens } from "@/lib/quotes/customer-access";
import { loadCustomerQuote } from "@/lib/quotes/customer-view";
import { buildQuoteContractPdf } from "@/lib/quotes/quote-pdf";
import { loadPdfMeasurementEvidence } from "@/lib/quotes/measurement-evidence";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashOpaqueToken } from "@/lib/security/opaque-token";
import {
  createPrivateMedia,
  deletePrivateMedia,
} from "@/lib/private-media-storage";
import { createEmailProvider } from "@/lib/providers/email-provider";
import { brandPreviewNonbindingEmail } from "@/lib/platform/preview-nonbinding-documents";
import { updateCaseState } from "@/lib/cases/case-command";
import {
  customerContractRequestSchema,
  recordCustomerContractRequest,
  type CustomerContractRequestInput,
} from "@/lib/contracts/customer-contract-request";
import {
  assertCustomerSignatureProof,
  ContractSigningInvariantError,
} from "@/lib/contracts/signing-invariants";

export const runtime = "nodejs";
export const maxDuration = 60;

class CustomerActionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerActionConflictError";
  }
}

const safeSignatureConflictMessages = new Set([
  "Contract document has changed",
  "Early start acknowledgement is required",
  "Required contract consents are missing",
  "Signature drawing is invalid",
  "Signer name is invalid",
]);

const actionSchema = z.union([
  z.discriminatedUnion("action", [
    z.object({
      action: z.literal("question"),
      message: z.string().trim().min(5).max(2_000),
      submissionKey: z.string().uuid(),
    }),
    z.object({
      action: z.literal("decline"),
      reason: z.enum([
        "price",
        "timing",
        "chose_other",
        "unsure",
        "scope",
        "other",
      ]),
      comment: z.string().trim().max(1_500).optional(),
    }),
    z.object({
      action: z.literal("cancel_request"),
      message: z.string().trim().min(10).max(2_000),
    }),
    z.object({
      action: z.literal("sign"),
      signerName: z.string().trim().min(3).max(160).optional(),
      signatureData: z.string().min(100).max(1_500_000),
      expectedDocumentHash: z.string().regex(/^[a-f0-9]{64}$/),
      paymentObligationAccepted: z.literal(true),
      termsAccepted: z.literal(true),
      withdrawalInformationReceived: z.literal(true),
      earlyStartRequested: z.boolean(),
      earlyStartLossAcknowledged: z.boolean(),
    }),
  ]),
  customerContractRequestSchema,
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = await getPayload();
  const view = await loadCustomerQuote(payload, token, { markViewed: true });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const questionState = await loadCustomerQuestionState(
    payload,
    view.snapshot.quote.leadId,
  );
  return NextResponse.json(
    {
      quoteStatus: view.quoteStatus,
      quoteReference: view.quoteReference,
      contractStatus: view.contractStatus,
      contractReference: view.contractReference,
      documentHash: view.documentHash,
      display: view.display,
      customerName: view.customerName,
      optionKind: view.optionKind,
      supplier: view.snapshot.supplier,
      terms: view.snapshot.terms,
      signedAt: view.signedAt,
      companySignedAt: view.companySignedAt,
      pdfUrl: `/api/customer/quote/${encodeURIComponent(token)}/pdf`,
      questionPending: questionState.status === "pending",
      questionState: questionState.status,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const correlationId = correlationIdFromHeaders(request.headers);
  try {
    assertFeatureReady("customerQuotes");
    const { token } = await context.params;
    const tokenKey = hashOpaqueToken("quote-customer-access", token).slice(
      0,
      24,
    );
    const limited = await rateLimit(
      "customer-quote",
      `${tokenKey}:${clientIp(request)}`,
      { limit: 12, windowSec: 60 },
    );
    if (!limited.success)
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid action", details: parsed.error.flatten() },
        { status: 400 },
      );
    const payload = await getPayload();
    const view = await loadCustomerQuote(payload, token);
    if (!view)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const leadId = view.snapshot.quote.leadId;

    if (parsed.data.action === "question") {
      if (
        view.contractStatus !== "issued" ||
        !["sent", "viewed"].includes(view.quoteStatus)
      ) {
        throw new CustomerActionConflictError(
          "Questions can only be submitted while the quote is awaiting a decision",
        );
      }
      const digest = createHash("sha256")
        .update(parsed.data.submissionKey)
        .digest("hex")
        .slice(0, 24);
      const idempotencyKey = `quote-question:${view.quoteId}:${digest}`;
      const existing = await payload.find({
        collection: "messages",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          idempotencyKey: {
            equals: idempotencyKey,
          },
        },
      });
      let sourceMessage = existing.docs[0];
      if (sourceMessage && sourceMessage.bodyText !== parsed.data.message) {
        throw new CustomerActionConflictError(
          "Question submission key was already used for different content",
        );
      }
      if (!sourceMessage) {
        try {
          sourceMessage = await payload.create({
            collection: "messages",
            overrideAccess: true,
            data: {
              lead: leadId,
              direction: "inbound",
              category: "customer_question",
              channel: "email",
              subject: `Spørsmål om tilbud ${view.quoteReference}`,
              bodyText: parsed.data.message,
              status: "delivered",
              idempotencyKey,
              aiAssisted: false,
              aiAnalysis: {
                contractId: view.contractId,
                contractReference: view.contractReference,
                quoteId: view.quoteId,
                quoteReference: view.quoteReference,
              },
              deliveredAt: new Date().toISOString(),
            },
          });
        } catch (error) {
          // A concurrent transport retry can win the unique idempotency-key
          // insert. Re-read that exact submission before deciding whether the
          // original create error is recoverable.
          const raced = await payload.find({
            collection: "messages",
            depth: 0,
            limit: 1,
            overrideAccess: true,
            where: { idempotencyKey: { equals: idempotencyKey } },
          });
          sourceMessage = raced.docs[0];
          if (!sourceMessage) throw error;
          if (sourceMessage.bodyText !== parsed.data.message) {
            throw new CustomerActionConflictError(
              "Question submission key was already used for different content",
            );
          }
        }
      }
      await updateCaseState(payload, {
        leadId,
        command: "customer_question",
        idempotencyKey,
        patch: {
          status: "customer_waiting",
          nextActionOwner: "administrator",
          nextAction: `Kunden venter på svar om ${view.quoteReference}. Kontroller AI-utkastet.`,
          nextActionAt: new Date().toISOString(),
          nextActionBlocker: "CUSTOMER_QUESTION_PENDING",
        },
      });
      const replyJob = await enqueueCustomerReplyDraft(payload, {
        correlationId,
        leadId,
        purpose: "question",
        sourceMessageId: sourceMessage.id,
      });
      try {
        await processOperationalJobs(payload, {
          jobIds: [replyJob.id],
          limit: 1,
          rescueStale: false,
        });
      } catch (error) {
        captureException(error, {
          route: "POST /api/customer/quote/[token]",
          operation: "customer-question-draft",
          correlationId,
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "decline") {
      if (view.quoteStatus === "declined")
        return NextResponse.json({
          ok: true,
          status: "declined",
          idempotent: true,
        });
      if (!["sent", "viewed"].includes(view.quoteStatus))
        throw new CustomerActionConflictError(
          "Quote cannot be declined in its current state",
        );
      const now = new Date().toISOString();
      const reasonLabels = {
        price: "Prisen passer ikke",
        timing: "Tidspunktet passer ikke",
        chose_other: "Har valgt en annen leverandør",
        unsure: "Er fortsatt usikker",
        scope: "Tilbudet dekker ikke ønsket behov",
        other: "Annen årsak",
      } as const;
      const reasonText = reasonLabels[parsed.data.reason];
      const feedback = parsed.data.comment
        ? `${reasonText}\n\nKundens kommentar:\n${parsed.data.comment}`
        : reasonText;
      await payload.update({
        collection: "quotes",
        id: view.quoteId,
        overrideAccess: true,
        data: {
          status: "declined",
          declinedAt: now,
          declineReason: parsed.data.reason,
          declineComment: parsed.data.comment || null,
        },
      });
      if (view.contractStatus === "issued")
        await payload.update({
          collection: "contracts",
          id: view.contractId,
          overrideAccess: true,
          data: { status: "declined" },
        });
      const declineMessage = await payload.create({
        collection: "messages",
        overrideAccess: true,
        data: {
          lead: leadId,
          direction: "inbound",
          category: "follow_up",
          channel: "email",
          subject: `Tilbud ${view.quoteReference} ble avslått`,
          bodyText: feedback,
          status: "delivered",
          idempotencyKey: `quote-decline-feedback:${view.quoteId}`,
          aiAssisted: false,
          aiAnalysis: {
            declineReason: parsed.data.reason,
            declineComment: parsed.data.comment || null,
            quoteId: view.quoteId,
          },
          deliveredAt: now,
        },
      });
      await enqueueCustomerReplyDraft(payload, {
        correlationId,
        leadId,
        purpose: "decline",
        sourceMessageId: declineMessage.id,
      });
      await updateCaseState(payload, {
        leadId,
        command: "customer_declined",
        idempotencyKey: `quote-decline:${view.quoteId}`,
        patch: {
          status: "customer_waiting",
          closedAt: null,
          nextActionOwner: "administrator",
          nextAction: `Kunden avslo ${view.quoteReference}: ${reasonText}. Vurder personlig oppfølging eller lukk saken.`,
          nextActionAt: now,
        },
      });
      const acknowledgement = await payload.create({
        collection: "messages",
        overrideAccess: true,
        data: {
          lead: leadId,
          direction: "outbound",
          category: "follow_up",
          channel: "email",
          subject: `Takk for tilbakemeldingen om ${view.quoteReference}`,
          bodyText: `Hei,\n\nTakk for at du ga beskjed. Vi har registrert at du ikke ønsker å gå videre med tilbud ${view.quoteReference} nå. Dersom det gjelder pris, tidspunkt eller innhold, kan du svare på denne e-posten – vi ser gjerne om det finnes en bedre løsning for deg.\n\nVennlig hilsen\nTakfornyelse\n47 73 58 88`,
          status: "queued",
          idempotencyKey: `quote-decline-acknowledgement:${view.quoteId}`,
          aiAssisted: false,
          approvedAt: now,
          queuedAt: now,
        },
      });
      await enqueueMessageJob(
        payload,
        acknowledgement.id,
        correlationId,
        "customer_initiated",
      );
      const provider = createEmailProvider();
      if (provider.health().status === "ready") {
        try {
          await deliverMessage(
            payload,
            provider,
            acknowledgement.id,
            correlationId,
            "customer_initiated",
          );
          await updateCaseState(payload, {
            leadId,
            command: "decline_acknowledgement_sent",
            idempotencyKey: `decline-acknowledgement-sent:${view.quoteId}`,
            patch: {
              status: "customer_waiting",
              nextActionOwner: "administrator",
              nextAction: `Kunden avslo ${view.quoteReference}: ${reasonText}. Vurder personlig oppfølging eller lukk saken.`,
              nextActionAt: now,
            },
          });
        } catch (error) {
          captureException(error, {
            route: "POST /api/customer/quote/[token]",
            operation: "decline-acknowledgement",
            correlationId,
          });
        }
      }
      return NextResponse.json({ ok: true, status: "declined" });
    }

    if (
      parsed.data.action === "withdrawal" ||
      parsed.data.action === "change_or_cancel" ||
      parsed.data.action === "cancel_request"
    ) {
      if (view.contractStatus !== "signed" || view.quoteStatus !== "accepted") {
        throw new CustomerActionConflictError(
          "This action is only available after customer signing",
        );
      }
      let structured: CustomerContractRequestInput;
      if (parsed.data.action === "cancel_request") {
        structured = customerContractRequestSchema.parse({
          action: "change_or_cancel",
          reasonCode: "other",
          reasonText: parsed.data.message,
          followUpConsent: false,
        });
      } else {
        structured = parsed.data;
      }
      const recorded = await recordCustomerContractRequest(payload, {
        correlationId,
        customer: view.customerName,
        leadId,
        quoteId: view.quoteId,
        contractId: view.contractId,
        contractReference: view.contractReference,
        contractSignedAt: view.signedAt,
        companySignedAt: view.companySignedAt,
        signatureEvidence: view.signatureEvidence,
        quoteSnapshot: view.snapshot.quote,
        request: structured,
      });
      if (!recorded.duplicate) {
        const provider = createEmailProvider();
        if (provider.health().status === "ready") {
          try {
            await deliverMessage(
              payload,
              provider,
              recorded.acknowledgementMessage.id,
              correlationId,
              "customer_initiated",
            );
          } catch (error) {
            captureException(error, {
              route: "POST /api/customer/quote/[token]",
              operation: "contract-request-receipt",
              correlationId,
            });
          }
        }
      }
      return NextResponse.json({
        ok: true,
        status: "review_required",
        requestReference: recorded.request.reference,
        idempotent: recorded.duplicate,
      });
    }

    if (parsed.data.action !== "sign")
      throw new CustomerActionConflictError("Unsupported customer action");
    assertFeatureReady("contractSigning");
    const unresolvedQuestion = await loadUnresolvedCustomerQuestion(
      payload,
      leadId,
    );
    if (unresolvedQuestion) {
      return NextResponse.json(
        {
          error: "Vi må svare på spørsmålet ditt før avtalen kan signeres.",
          code: "CUSTOMER_QUESTION_PENDING",
        },
        { status: 409 },
      );
    }
    if (view.contractStatus === "signed" && view.quoteStatus === "accepted") {
      assertCustomerSignatureProof({
        status: view.contractStatus,
        documentHash: view.documentHash,
        signedAt: view.signedAt,
        signatureEvidence: view.signatureEvidence,
        signedDocument: view.signedDocumentId,
      });
      return NextResponse.json({
        ok: true,
        status: "signed",
        idempotent: true,
      });
    }
    if (
      view.contractStatus !== "issued" ||
      !["sent", "viewed"].includes(view.quoteStatus)
    )
      throw new CustomerActionConflictError(
        "Contract is not available for signing",
      );
    const evidence = createSignatureEvidence({
      contract: view.snapshot as ContractSnapshot,
      expectedDocumentHash: parsed.data.expectedDocumentHash,
      signatureData: parsed.data.signatureData,
      signerName: view.customerName,
      paymentObligationAccepted: parsed.data.paymentObligationAccepted,
      termsAccepted: parsed.data.termsAccepted,
      withdrawalInformationReceived: parsed.data.withdrawalInformationReceived,
      earlyStartRequested: parsed.data.earlyStartRequested,
      earlyStartLossAcknowledged: parsed.data.earlyStartLossAcknowledged,
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      securitySalt: process.env.CUSTOMER_TOKEN_SECRET || resolvePayloadSecret(),
    });
    const signatureBytes = Buffer.from(
      parsed.data.signatureData.split(",")[1] ?? "",
      "base64",
    );
    const signatureMedia = await createPrivateMedia(
      payload,
      {
        classification: "contract",
        ownerType: "contract",
        ownerId: String(view.contractId),
        alt: `Kundesignatur ${view.contractReference}`,
      },
      {
        data: signatureBytes,
        mimeType: "image/png",
        filename: `kundesignatur-${view.contractReference.toLowerCase()}.png`,
      },
    );
    const contractSnapshot = view.snapshot as ContractSnapshot;
    const measurementEvidence = await loadPdfMeasurementEvidence(
      payload,
      contractSnapshot,
    );
    const pdfBytes = await buildQuoteContractPdf({
      contract: contractSnapshot,
      signatureData: parsed.data.signatureData,
      evidence,
      measurementEvidence,
    });
    const filename = `signert-${view.contractReference.toLowerCase()}.pdf`;
    const media = await createPrivateMedia(
      payload,
      {
        classification: "contract",
        ownerType: "contract",
        ownerId: String(view.contractId),
        alt: `Signert kontrakt ${view.contractReference}`,
      },
      { data: pdfBytes, mimeType: "application/pdf", filename },
    );
    const updated = await payload.update({
      collection: "contracts",
      overrideAccess: true,
      context: { trustedCustomerSignature: true },
      where: {
        and: [
          { id: { equals: view.contractId } },
          { status: { equals: "issued" } },
        ],
      },
      data: {
        status: "signed",
        signatureEvidence: evidence,
        customerSignatureImage: signatureMedia.id,
        signedDocument: media.id,
        signedAt: evidence.signedAt,
      },
    });
    if (updated.docs.length === 0) {
      await deletePrivateMedia(payload, media);
      await deletePrivateMedia(payload, signatureMedia);
      const latest = await payload.findByID({
        collection: "contracts",
        id: view.contractId,
        depth: 0,
        overrideAccess: true,
      });
      if (latest.status === "signed") {
        assertCustomerSignatureProof(latest);
        return NextResponse.json({
          ok: true,
          status: "signed",
          idempotent: true,
        });
      }
      throw new CustomerActionConflictError("Contract signing conflict");
    }
    await payload.update({
      collection: "quotes",
      id: view.quoteId,
      overrideAccess: true,
      data: {
        status: "accepted",
        acceptedAt: evidence.signedAt,
        selectedOptionQuote: view.quoteId,
      },
    });
    if (view.siblingQuoteId) {
      const sibling = await payload
        .findByID({
          collection: "quotes",
          id: view.siblingQuoteId,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null);
      if (
        sibling &&
        ["draft", "approved", "sent", "viewed", "declined"].includes(
          sibling.status,
        )
      ) {
        if (sibling.status !== "declined")
          await payload.update({
            collection: "quotes",
            id: sibling.id,
            overrideAccess: true,
            data: { status: "superseded", selectedOptionQuote: view.quoteId },
          });
        const siblingContracts = await payload.find({
          collection: "contracts",
          depth: 0,
          limit: 10,
          overrideAccess: true,
          where: { quote: { equals: sibling.id } },
        });
        for (const siblingContract of siblingContracts.docs) {
          if (["draft", "issued"].includes(siblingContract.status))
            await payload.update({
              collection: "contracts",
              id: siblingContract.id,
              overrideAccess: true,
              data: { status: "superseded" },
            });
        }
        await revokeQuoteAccessTokens(payload, sibling.id);
      }
    }
    await payload.update({
      collection: "access-tokens",
      id: view.accessRecordId,
      overrideAccess: true,
      data: { usedAt: evidence.signedAt },
    });
    await updateCaseState(payload, {
      leadId,
      command: "customer_signed",
      idempotencyKey: `customer-signed:${view.contractId}`,
      patch: {
        status: "converted",
        nextActionOwner: "administrator",
        nextAction:
          "Kunden har signert. Leverandøren må kontrollere og medsignere kontrakten.",
        nextActionAt: new Date().toISOString(),
      },
    });
    const key = `contract-signed:${view.contractId}`;
    const prior = await payload.find({
      collection: "messages",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { idempotencyKey: { equals: key } },
    });
    if (!prior.docs[0]) {
      const confirmationEmail = brandPreviewNonbindingEmail({
        subject: `Vi har mottatt signaturen din – ${view.contractReference}`,
        bodyText: `Takk. Vi har mottatt signaturen din på kontrakt ${view.contractReference}. Kundesignert kopi og angrerettskjema er vedlagt. Takfornyelse kontrollerer og medsignerer nå avtalen. Når det er gjort, sender vi deg den endelige kontrakten signert av begge parter og følger opp planlagt oppstart.`,
      });
      const message = await payload.create({
        collection: "messages",
        overrideAccess: true,
        data: {
          lead: leadId,
          direction: "outbound",
          category: "contract",
          channel: "email",
          subject: confirmationEmail.subject,
          bodyText: confirmationEmail.bodyText,
          attachments: [media.id],
          status: "queued",
          idempotencyKey: key,
          aiAssisted: false,
          approvedAt: evidence.signedAt,
          queuedAt: evidence.signedAt,
        },
      });
      await enqueueMessageJob(
        payload,
        message.id,
        correlationId,
        "customer_initiated",
      );
      const provider = createEmailProvider();
      if (provider.health().status === "ready") {
        try {
          await deliverMessage(
            payload,
            provider,
            message.id,
            correlationId,
            "customer_initiated",
          );
        } catch (error) {
          // Contract signing is durable even when delivery is temporarily down;
          // the queued outbox job remains available for a later retry.
          captureException(error, {
            route: "POST /api/customer/quote/[token]",
            operation: "contract-confirmation",
            correlationId,
          });
        }
      }
    }
    return NextResponse.json({
      ok: true,
      status: "signed",
      pdfUrl: `/api/customer/quote/${encodeURIComponent(token)}/pdf`,
    });
  } catch (error) {
    if (error instanceof FeatureUnavailableError)
      return NextResponse.json(
        { error: error.reason, missing: error.unavailable },
        { status: 503 },
      );
    if (error instanceof ContractSigningInvariantError)
      return NextResponse.json(
        {
          error:
            "The stored contract signature evidence is incomplete. Contact Takfornyelse before continuing.",
          correlationId,
        },
        { status: 409 },
      );
    if (
      error instanceof CustomerActionConflictError ||
      (error instanceof Error &&
        safeSignatureConflictMessages.has(error.message))
    )
      return NextResponse.json(
        { error: error.message, correlationId },
        { status: 409 },
      );
    captureException(error, {
      route: "POST /api/customer/quote/[token]",
      correlationId,
    });
    return NextResponse.json(
      { error: "Customer action failed", correlationId },
      { status: 500 },
    );
  }
}
