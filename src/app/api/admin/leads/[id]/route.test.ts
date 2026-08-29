import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSources: vi.fn(),
  assertTrackingReady: vi.fn(),
  approvePackage: vi.fn(),
  auth: vi.fn(),
  capture: vi.fn(),
  create: vi.fn(),
  customerReply: vi.fn(),
  deliver: vi.fn(),
  enqueue: vi.fn(),
  findByID: vi.fn(),
  find: vi.fn(),
  manualReply: vi.fn(),
  loadUnresolved: vi.fn(),
  markLeadReviewed: vi.fn(),
  preparePackage: vi.fn(),
  polishReply: vi.fn(),
  recordAudit: vi.fn(),
  replyEmailText: vi.fn(),
  reserveUsage: vi.fn(),
  update: vi.fn(),
  provider: {
    health: vi.fn(() => ({ provider: "log-email", status: "ready" })),
  },
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    create: mocks.create,
    findByID: mocks.findByID,
    find: mocks.find,
    update: mocks.update,
  })),
}));
vi.mock("@/lib/monitoring", () => ({ captureException: mocks.capture }));
vi.mock("@/lib/messages/message-engine", () => ({
  assertCustomerReplyDeliveryTrackingReady: mocks.assertTrackingReady,
  createCustomerReplyDraft: mocks.customerReply,
  createLeadAiReply: vi.fn(),
  createManualCustomerQuestionReplyDraft: mocks.manualReply,
  deliverMessage: mocks.deliver,
  enqueueMessageJob: mocks.enqueue,
  manualQuestionReplyPlaceholder:
    "Skriv et kontrollert svar til kunden her før utsending.",
}));
vi.mock("@/lib/ai/payload-usage-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ai/payload-usage-limit")
  >("@/lib/ai/payload-usage-limit");
  return { ...actual, reserveCustomerReplyAiRequest: mocks.reserveUsage };
});
vi.mock("@/lib/messages/customer-reply", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/messages/customer-reply")
  >("@/lib/messages/customer-reply");
  return { ...actual, polishCustomerReplyDraft: mocks.polishReply };
});
vi.mock("@/lib/providers/email-provider", () => ({
  createEmailProvider: () => mocks.provider,
}));
vi.mock("@/lib/messages/customer-reply-sources", () => ({
  assertCustomerReplySourcesCurrent: mocks.assertSources,
}));
vi.mock("@/lib/messages/customer-reply-link", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/messages/customer-reply-link")
  >("@/lib/messages/customer-reply-link");
  return { ...actual, customerQuestionReplyEmailText: mocks.replyEmailText };
});
vi.mock("@/lib/messages/customer-question-state", () => ({
  loadUnresolvedCustomerQuestion: mocks.loadUnresolved,
}));
vi.mock("@/lib/leads/automatic-package", () => ({
  approveAndSendPreparedLeadPackage: mocks.approvePackage,
  prepareAutomaticLeadPackage: mocks.preparePackage,
}));
vi.mock("@/payload/access/roles", () => ({
  userIsAdmin: vi.fn(() => true),
}));
vi.mock("@/lib/admin-v2/mark-lead-reviewed", () => ({
  markLeadReviewed: mocks.markLeadReviewed,
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/audit/audit-event", () => ({
  recordAuditEvent: mocks.recordAudit,
}));

import { PrivateMediaTemporarilyUnavailableError } from "@/lib/private-media-content";
import { AiUsageLimitError } from "@/lib/ai/payload-usage-limit";
import { CustomerSecureLinkUnavailableError } from "@/lib/messages/customer-reply-link";
import { POST } from "./route";

function request(body: Record<string, unknown> = { action: "mark_reviewed" }) {
  return new Request("http://localhost/api/admin/leads/10", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("admin lead review marker", () => {
  beforeEach(() => {
    mocks.auth.mockReset().mockResolvedValue({
      user: { id: 3, role: "admin" },
    });
    mocks.capture.mockReset();
    mocks.assertSources
      .mockReset()
      .mockResolvedValue({ context: { purpose: "question" } });
    mocks.assertTrackingReady.mockReset();
    mocks.approvePackage.mockReset();
    mocks.create.mockReset();
    mocks.customerReply.mockReset().mockResolvedValue({
      duplicate: false,
      message: { id: 45 },
    });
    mocks.deliver.mockReset().mockResolvedValue({ duplicate: false });
    mocks.enqueue.mockReset().mockResolvedValue({ id: 73 });
    mocks.find.mockReset().mockResolvedValue({ docs: [] });
    mocks.findByID.mockReset().mockResolvedValue({
      adminReviewedAt: null,
      caseRevision: 12,
      id: 10,
    });
    mocks.markLeadReviewed.mockReset().mockResolvedValue({
      duplicate: false,
      reviewedAt: "2026-08-28T00:00:00.000Z",
    });
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
    mocks.replyEmailText
      .mockReset()
      .mockImplementation(
        async (_payload: unknown, input: { bodyText: string }) =>
          input.bodyText,
      );
    mocks.preparePackage.mockReset();
    mocks.polishReply.mockReset().mockResolvedValue({
      result: {
        replyDraft: "Et forbedret og kontrollert svar til kunden.",
        subject: "Forbedret svar på spørsmålet ditt",
      },
    });
    mocks.manualReply.mockReset().mockResolvedValue({
      duplicate: false,
      message: { id: 44 },
    });
    mocks.loadUnresolved.mockReset().mockResolvedValue({
      question: { id: 33 },
      reply: null,
    });
    mocks.reserveUsage.mockReset().mockResolvedValue({ reserved: 1 });
    mocks.update.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes the automatic marker through the idempotent case command", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(response).toBeDefined();
    if (!response) throw new Error("Expected a review marker response");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      duplicate: false,
      ok: true,
      reviewedAt: "2026-08-28T00:00:00.000Z",
    });
    expect(mocks.markLeadReviewed).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ actorId: 3, leadId: 10 }),
    );
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("creates a human-only draft without requiring the AI provider", async () => {
    const response = await POST(
      request({
        action: "prepare_manual_question_reply",
        expectedRevision: 12,
        sourceMessageId: 33,
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a manual reply response");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      duplicate: false,
      manual: true,
      messageId: 44,
      ok: true,
    });
    expect(mocks.manualReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ leadId: 10, sourceMessageId: 33 }),
    );
  });

  it.each(["prepare_question_reply", "prepare_manual_question_reply"] as const)(
    "rejects %s for a source other than the current unresolved question",
    async (action) => {
      if (action === "prepare_question_reply") {
        vi.stubEnv("FEATURE_AI_DRAFTS", "true");
        vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
      }
      mocks.loadUnresolved.mockResolvedValue({
        question: { id: 34 },
        reply: null,
      });

      const response = await POST(
        request({ action, expectedRevision: 12, sourceMessageId: 33 }),
        { params: Promise.resolve({ id: "10" }) },
      );

      if (!response) throw new Error("Expected a source rejection");
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error:
          "Only the exact currently unresolved customer question can be answered",
      });
      expect(mocks.customerReply).not.toHaveBeenCalled();
      expect(mocks.manualReply).not.toHaveBeenCalled();
    },
  );

  it.each(["prepare_question_reply", "prepare_manual_question_reply"] as const)(
    "rejects %s while an active direct reply exists",
    async (action) => {
      if (action === "prepare_question_reply") {
        vi.stubEnv("FEATURE_AI_DRAFTS", "true");
        vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
      }
      mocks.loadUnresolved.mockResolvedValue({
        question: { id: 33 },
        reply: { id: 45, status: "draft" },
      });

      const response = await POST(
        request({ action, expectedRevision: 12, sourceMessageId: 33 }),
        { params: Promise.resolve({ id: "10" }) },
      );

      if (!response) throw new Error("Expected an active-reply rejection");
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error:
          "An active direct reply already exists for this customer question",
      });
      expect(mocks.customerReply).not.toHaveBeenCalled();
      expect(mocks.manualReply).not.toHaveBeenCalled();
    },
  );

  it("allows AI preparation again after only cancelled replies remain", async () => {
    vi.stubEnv("FEATURE_AI_DRAFTS", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    mocks.customerReply.mockResolvedValue({
      duplicate: false,
      message: { id: 45, status: "draft" },
    });

    const response = await POST(
      request({
        action: "prepare_question_reply",
        expectedRevision: 12,
        sourceMessageId: 33,
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a recreated AI reply");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      duplicate: false,
      messageId: 45,
      ok: true,
    });
    expect(mocks.loadUnresolved).toHaveBeenCalledWith(expect.anything(), 10);
    expect(mocks.customerReply).toHaveBeenCalledTimes(1);
  });

  it("returns a typed recovery when AI safety rejects the replacement twice", async () => {
    vi.stubEnv("FEATURE_AI_DRAFTS", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    mocks.customerReply.mockRejectedValue(
      new TypeError(
        "AI reply contains a price that is not in the approved quote snapshot",
      ),
    );

    const response = await POST(
      request({
        action: "prepare_question_reply",
        expectedRevision: 12,
        sourceMessageId: 33,
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a safety recovery response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "CUSTOMER_REPLY_SAFETY_REJECTED",
    });
  });

  it("returns the exact AI quota reset time without reporting a generic failure", async () => {
    vi.stubEnv("FEATURE_AI_DRAFTS", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    mocks.customerReply.mockRejectedValue(
      new AiUsageLimitError("daily", "2026-08-30T00:00:00.000Z"),
    );

    const response = await POST(
      request({
        action: "prepare_question_reply",
        expectedRevision: 12,
        sourceMessageId: 33,
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected an AI quota recovery response");
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await response.json()).toEqual({
      code: "AI_USAGE_LIMIT_REACHED",
      error: "AI request limit reached. Use a manual reply until it resets.",
      period: "daily",
      retryAt: "2026-08-30T00:00:00.000Z",
    });
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it.each(["ai", "manual"] as const)(
    "replaces a stale failed reply with a fresh %s draft",
    async (recoveryMode) => {
      if (recoveryMode === "ai") {
        vi.stubEnv("FEATURE_AI_DRAFTS", "true");
        vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
      }
      mocks.findByID
        .mockReset()
        .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
        .mockResolvedValueOnce({
          aiAnalysis: {
            manualQuestionReply: false,
            purpose: "question",
            replyFactContext: {
              customerMessage: "Hva er inkludert i maksimalprisen?",
              purpose: "question",
            },
          },
          category: "ai_reply",
          id: 44,
          lead: 10,
          replyToMessage: 33,
          status: "attention",
        });
      mocks.manualReply.mockResolvedValue({
        duplicate: false,
        message: { id: 46 },
      });

      const response = await POST(
        request({
          action: "regenerate_reply",
          expectedRevision: 12,
          messageId: 44,
          recoveryMode,
        }),
        { params: Promise.resolve({ id: "10" }) },
      );

      if (!response) throw new Error("Expected a replacement draft response");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        manual: recoveryMode === "manual",
        regenerated: true,
      });
      const creator =
        recoveryMode === "manual" ? mocks.manualReply : mocks.customerReply;
      expect(creator).toHaveBeenCalledWith(
        expect.anything(),
        ...(recoveryMode === "ai" ? [expect.anything()] : []),
        expect.objectContaining({
          generationKey: "regenerate-44",
          sourceMessageId: 33,
        }),
      );
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: "messages",
          data: { status: "cancelled" },
          id: 44,
        }),
      );
    },
  );

  it("returns a typed retryable response when secure measurement evidence is temporarily unavailable", async () => {
    vi.stubEnv("FEATURE_CUSTOMER_QUOTES", "true");
    vi.stubEnv("FEATURE_CONTRACT_SIGNING", "true");
    vi.stubEnv("LEGAL_REVIEW_REFERENCE", "test-legal-review");
    vi.stubEnv("PAYLOAD_SECRET", "test-payload-secret");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    mocks.approvePackage.mockRejectedValue(
      new PrivateMediaTemporarilyUnavailableError(),
    );

    const response = await POST(
      request({ action: "approve_package", expectedRevision: 12 }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected an evidence failure response");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    const body = await response.json();
    expect(body).toMatchObject({
      code: "MEASUREMENT_EVIDENCE_TEMPORARILY_UNAVAILABLE",
      correlationId: expect.any(String),
      error: expect.stringContaining("temporarily unavailable"),
    });
    expect(JSON.stringify(body)).not.toMatch(
      /fetch failed|blob\.vercel-storage\.com|test-private-blob-token/i,
    );
    expect(mocks.approvePackage).toHaveBeenCalledTimes(1);
    expect(mocks.capture).toHaveBeenCalledWith(
      expect.any(PrivateMediaTemporarilyUnavailableError),
      expect.objectContaining({
        operation: "private-media-read",
        route: "POST /api/admin/leads/[id]",
      }),
    );
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("reserves and records the exact Gemini polish attempt before invoking the provider", async () => {
    vi.stubEnv("FEATURE_AI_DRAFTS", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        category: "ai_reply",
        id: 44,
        lead: 10,
        replyToMessage: 33,
        status: "draft",
      });

    const response = await POST(
      request({
        action: "polish_reply",
        bodyText: "Et kontrollert utkast som administrator ønsker å forbedre.",
        messageId: 44,
        subject: "Svar på spørsmålet ditt",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a polished reply response");
    expect(response.status).toBe(200);
    expect(mocks.reserveUsage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        attempt: 1,
        correlationId: expect.any(String),
        purpose: "customer-reply-polish",
        sourceMessageId: 33,
      }),
    );
    expect(mocks.reserveUsage.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.polishReply.mock.invocationCallOrder[0],
    );
    expect(mocks.polishReply).toHaveBeenCalledTimes(1);
  });

  it("refuses a stale customer reply before retrying delivery", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        approvedAt: "2026-08-28T09:00:00.000Z",
        category: "ai_reply",
        id: 44,
        lead: 10,
        status: "attention",
      });
    mocks.assertSources.mockRejectedValue(
      new TypeError("The bound source changed"),
    );

    const response = await POST(
      request({ action: "retry_send", messageId: 44 }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a stale retry response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "CUSTOMER_REPLY_SOURCE_CHANGED",
      error: "The bound source changed",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not approve an untouched manual-reply placeholder", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        aiAnalysis: {
          manualQuestionReply: true,
          manualReplyRequiresEditing: true,
        },
        bodyText: "Skriv et kontrollert svar til kunden her før utsending.",
        category: "follow_up",
        id: 44,
        lead: 10,
        status: "draft",
        subject: "Svar på spørsmålet ditt",
        updatedAt: "2026-08-28T09:00:00.000Z",
      });

    const response = await POST(
      request({
        action: "approve_send",
        bodyText: "Skriv et kontrollert svar til kunden her før utsending.",
        expectedCaseRevision: 12,
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Svar på spørsmålet ditt",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a manual approval response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Write and save a customer-specific answer before sending",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks a manual reply ready only after administrator text is saved", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        aiAnalysis: {
          manualQuestionReply: true,
          manualReplyRequiresEditing: true,
          purpose: "question",
        },
        bodyText: "Skriv et kontrollert svar til kunden her før utsending.",
        category: "follow_up",
        id: 44,
        lead: 10,
        status: "draft",
        subject: "Svar på spørsmålet ditt",
        updatedAt: "2026-08-28T09:00:00.000Z",
      });
    mocks.update.mockResolvedValue({
      docs: [{ id: 44, updatedAt: "2026-08-28T09:01:00.000Z" }],
    });

    const response = await POST(
      request({
        action: "save_draft",
        bodyText:
          "Takk for spørsmålet. Maksimalprisen følger den kontrollerte tilbudsversjonen.",
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Svar om maksimalprisen",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a manual save response");
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "messages",
        data: expect.objectContaining({
          aiAnalysis: expect.objectContaining({
            manualQuestionReply: true,
            manualReplyRequiresEditing: false,
          }),
        }),
        where: expect.objectContaining({ and: expect.any(Array) }),
      }),
    );
    expect(await response.json()).toMatchObject({
      messageUpdatedAt: "2026-08-28T09:01:00.000Z",
    });
  });

  it("atomically saves and approves only the exact draft revision", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        aiAnalysis: {
          manualQuestionReply: true,
          manualReplyRequiresEditing: true,
          purpose: "question",
        },
        bodyText: "Skriv et kontrollert svar til kunden her før utsending.",
        category: "follow_up",
        id: 44,
        lead: 10,
        status: "draft",
        subject: "Svar på spørsmålet ditt",
        updatedAt: "2026-08-28T09:00:00.000Z",
      });
    mocks.assertSources.mockResolvedValue({ context: { purpose: "question" } });
    mocks.update.mockResolvedValue({
      docs: [
        {
          id: 44,
          status: "queued",
          updatedAt: "2026-08-28T09:01:00.000Z",
        },
      ],
    });

    const response = await POST(
      request({
        action: "approve_send",
        bodyText:
          "Takk for spørsmålet. Maksimalprisen er den som står i tilbudet.",
        expectedCaseRevision: 12,
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Svar om maksimalprisen",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected an atomic approval response");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      caseRevision: 12,
      jobId: 73,
      messageId: 44,
      messageUpdatedAt: "2026-08-28T09:01:00.000Z",
      sent: true,
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "messages",
        data: expect.objectContaining({
          bodyText:
            "Takk for spørsmålet. Maksimalprisen er den som står i tilbudet.",
          status: "queued",
          subject: "Svar om maksimalprisen",
        }),
        where: {
          and: expect.arrayContaining([
            { status: { equals: "draft" } },
            {
              updatedAt: { equals: "2026-08-28T09:00:00.000Z" },
            },
          ]),
        },
      }),
    );
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      44,
      expect.any(String),
    );
  });

  it("persists the current secure quote CTA before queueing a customer-question reply", async () => {
    const approvedText = "Takk for spørsmålet. Maksimalprisen står i tilbudet.";
    const emailText = `${approvedText}\n\nÅpne tilbudet og fortsett på din sikre kundeside:\nhttps://takfornyelse-staging.vercel.app/tilbud/current-token`;
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        aiAnalysis: { purpose: "question" },
        bodyText: approvedText,
        category: "ai_reply",
        id: 44,
        lead: 10,
        replyToMessage: 33,
        status: "draft",
        subject: "Svar på spørsmålet ditt",
        updatedAt: "2026-08-28T09:00:00.000Z",
      });
    mocks.assertSources.mockResolvedValue({
      context: { purpose: "question" },
      fingerprint: "current",
      snapshot: { quote: { id: 17 } },
    });
    mocks.replyEmailText.mockResolvedValue(emailText);
    mocks.update.mockResolvedValue({
      docs: [
        {
          id: 44,
          status: "queued",
          updatedAt: "2026-08-28T09:01:00.000Z",
        },
      ],
    });

    const response = await POST(
      request({
        action: "approve_send",
        bodyText: approvedText,
        expectedCaseRevision: 12,
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Svar på spørsmålet ditt",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected an approval response");
    expect(response.status).toBe(200);
    expect(mocks.replyEmailText).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bodyText: approvedText,
        leadId: 10,
        sources: expect.objectContaining({ snapshot: { quote: { id: 17 } } }),
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "messages",
        data: expect.objectContaining({
          bodyText: emailText,
          status: "queued",
        }),
      }),
    );
  });

  it("does not queue a question reply when its current secure link cannot be resolved", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        aiAnalysis: { purpose: "question" },
        bodyText: "Et kontrollert svar med tilstrekkelig innhold.",
        category: "ai_reply",
        id: 44,
        lead: 10,
        replyToMessage: 33,
        status: "draft",
        subject: "Svar på spørsmålet ditt",
        updatedAt: "2026-08-28T09:00:00.000Z",
      });
    mocks.replyEmailText.mockRejectedValue(
      new CustomerSecureLinkUnavailableError(
        "No current secure customer link is available",
      ),
    );

    const response = await POST(
      request({
        action: "approve_send",
        bodyText: "Et kontrollert svar med tilstrekkelig innhold.",
        expectedCaseRevision: 12,
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Svar på spørsmålet ditt",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a blocked approval response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "CUSTOMER_REPLY_SECURE_LINK_MISSING",
      error: "No current secure customer link is available",
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("blocks a legacy AI draft that exposes a raw øre amount at send time", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        aiAnalysis: { purpose: "question" },
        bodyText: "Original draft with a customer-facing pricing error.",
        category: "ai_reply",
        id: 44,
        lead: 10,
        status: "draft",
        subject: "Svar om maksimalprisen",
        updatedAt: "2026-08-28T09:00:00.000Z",
      });
    mocks.assertSources.mockResolvedValue({
      context: {
        customerMessage: "Hva dekker maksimalprisen?",
        purpose: "question",
        quote: {
          reference: "T-10-V1",
          status: "sent",
          totalIncVatOre: 1_266_000,
          maximumTotalIncVatOre: 1_455_858,
        },
      },
    });

    const response = await POST(
      request({
        action: "approve_send",
        bodyText: "Maksimalprisen er 1 455 858 øre inkludert mva.",
        expectedCaseRevision: 12,
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Svar om maksimalprisen",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a blocked approval response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("raw øre"),
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("rejects approval when the conditional draft update loses a race", async () => {
    mocks.findByID
      .mockReset()
      .mockResolvedValueOnce({ caseRevision: 12, id: 10 })
      .mockResolvedValueOnce({
        aiAnalysis: {},
        bodyText: "Original body with enough content for a message.",
        category: "follow_up",
        id: 44,
        lead: 10,
        status: "draft",
        subject: "Original subject",
        updatedAt: "2026-08-28T09:00:00.000Z",
      });
    mocks.update.mockResolvedValue({ docs: [] });

    const response = await POST(
      request({
        action: "approve_send",
        bodyText: "Administrator A's edited reply with enough detail.",
        expectedCaseRevision: 12,
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Administrator A reply",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a stale-message response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "MESSAGE_REVISION_CONFLICT",
      error: expect.stringContaining("changed by another administrator"),
    });
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("rejects atomic approval when the case revision is stale", async () => {
    const response = await POST(
      request({
        action: "approve_send",
        bodyText: "A complete administrator reply with enough detail.",
        expectedCaseRevision: 11,
        expectedMessageUpdatedAt: "2026-08-28T09:00:00.000Z",
        messageId: 44,
        subject: "Administrator reply",
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    if (!response) throw new Error("Expected a stale-case response");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      actual: 12,
      code: "CASE_REVISION_CONFLICT",
      expected: 11,
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
