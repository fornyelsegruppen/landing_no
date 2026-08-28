import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSources: vi.fn(),
  assertTrackingReady: vi.fn(),
  approvePackage: vi.fn(),
  auth: vi.fn(),
  capture: vi.fn(),
  create: vi.fn(),
  deliver: vi.fn(),
  enqueue: vi.fn(),
  findByID: vi.fn(),
  find: vi.fn(),
  manualReply: vi.fn(),
  markLeadReviewed: vi.fn(),
  preparePackage: vi.fn(),
  recordAudit: vi.fn(),
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
  createCustomerReplyDraft: vi.fn(),
  createLeadAiReply: vi.fn(),
  createManualCustomerQuestionReplyDraft: mocks.manualReply,
  deliverMessage: mocks.deliver,
  enqueueMessageJob: mocks.enqueue,
  manualQuestionReplyPlaceholder:
    "Skriv et kontrollert svar til kunden her før utsending.",
}));
vi.mock("@/lib/providers/email-provider", () => ({
  createEmailProvider: () => mocks.provider,
}));
vi.mock("@/lib/messages/customer-reply-sources", () => ({
  assertCustomerReplySourcesCurrent: mocks.assertSources,
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
    mocks.preparePackage.mockReset();
    mocks.manualReply.mockReset().mockResolvedValue({
      duplicate: false,
      message: { id: 44 },
    });
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
