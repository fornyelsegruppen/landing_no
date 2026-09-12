import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  attachStock: vi.fn(),
  captureException: vi.fn(),
  evaluateEdited: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  recordAudit: vi.fn(),
  regenerate: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mocks.auth,
    find: mocks.find,
    findByID: mocks.findByID,
    update: mocks.update,
  })),
}));
vi.mock("@/lib/monitoring", () => ({
  captureException: mocks.captureException,
}));
vi.mock("@/payload/access/roles", () => ({
  userIsAdmin: (user: { role?: string }) => user.role === "admin",
}));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => ({})),
}));
vi.mock("@/lib/audit/audit-event", () => ({
  recordAuditEvent: mocks.recordAudit,
}));
vi.mock("@/lib/blog/stock-image", () => ({
  attachPexelsStockImageToPost: mocks.attachStock,
}));
vi.mock("@/lib/blog/reviewer", () => ({
  reviewerNameForUser: vi.fn(() => "Kari"),
}));
vi.mock("@/lib/blog/edited-draft-quality", () => ({
  evaluateEditedBlogDraft: mocks.evaluateEdited,
}));
vi.mock("@/lib/platform/features", () => ({
  assertFeatureReady: vi.fn(),
}));
vi.mock("@/lib/providers/gemini-ai-provider", () => ({
  GeminiAiProvider: class GeminiAiProvider {},
}));
vi.mock("@/lib/blog/payload-blog-engine", () => ({
  regeneratePayloadBlogPost: mocks.regenerate,
}));

import { POST } from "./route";
import { ArticleQualityBlockedError } from "@/lib/blog/draft-engine";
import { assertExpectedPostRevision } from "@/lib/blog/post-write-transaction";

function request(body: Record<string, unknown>) {
  return new Request("https://www.takfornyelse.as/api/admin/blog/posts/9", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "9" }) };

describe("admin blog post actions", () => {
  it.each(["approve", "schedule", "publish"])(
    "requires recheck of legacy QA100 before %s",
    async (action) => {
      mocks.findByID.mockResolvedValue({
        ...(await mocks.findByID()),
        qualityScore: 100,
        qualityChecks: { passed: true },
        editorialStatus: action === "approve" ? "human_review" : "approved",
      });
      const response = await POST(
        request({ action, scheduledAt: "2099-09-14T07:00:00.000Z" }),
        context,
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: "QUALITY_RECHECK_REQUIRED",
      });
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("reschedules unchanged reviewed content with revision guards and no new approval", async () => {
    const post = {
      ...(await mocks.findByID()),
      editorialStatus: "scheduled",
      scheduledAt: "2099-09-14T07:00:00.000Z",
    };
    mocks.findByID.mockResolvedValue(post);
    const response = await POST(
      request({
        action: "schedule",
        scheduledAt: "2099-09-15T07:00:00.000Z",
        expectedUpdatedAt: post.updatedAt,
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: true,
        data: {
          editorialStatus: "scheduled",
          scheduledAt: "2099-09-15T07:00:00.000Z",
        },
        context: {
          expectedBlogUpdatedAt: post.updatedAt,
          expectedBlogRevision: expect.any(String),
        },
      }),
    );
  });
  it("a repeated schedule request is a no-op without another version or audit event", async () => {
    const scheduledAt = "2099-09-14T07:00:00.000Z";
    mocks.findByID.mockResolvedValue({
      ...(await mocks.findByID()),
      editorialStatus: "scheduled",
      scheduledAt,
    });
    const response = await POST(
      request({ action: "schedule", scheduledAt }),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "unchanged" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
  it("a damaged scheduled review cannot be rescheduled even to the same date", async () => {
    const scheduledAt = "2099-09-14T07:00:00.000Z";
    mocks.findByID.mockResolvedValue({
      ...(await mocks.findByID()),
      editorialStatus: "scheduled",
      scheduledAt,
      reviewedAt: null,
    });
    expect(
      (await POST(request({ action: "schedule", scheduledAt }), context))
        .status,
    ).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("unpublishes the base document with review reset and both revision guards", async () => {
    const post = await mocks.findByID();
    const response = await POST(
      request({ action: "unpublish", expectedUpdatedAt: post.updatedAt }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        context: {
          expectedBlogUpdatedAt: post.updatedAt,
          expectedBlogRevision: expect.any(String),
        },
        data: {
          _status: "draft",
          editorialStatus: "human_review",
          scheduledAt: null,
          reviewedAt: null,
          reviewerName: null,
          qualityScore: null,
          qualityChecks: null,
        },
      }),
    );
  });
  it("unpublish requires an explicit revision timestamp and rejects stale timestamps", async () => {
    expect((await POST(request({ action: "unpublish" }), context)).status).toBe(
      400,
    );
    expect(
      (
        await POST(
          request({
            action: "unpublish",
            expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
          }),
          context,
        )
      ).status,
    ).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("anonymous callers cannot unpublish", async () => {
    mocks.auth.mockResolvedValueOnce({ user: null });
    expect((await POST(request({ action: "unpublish" }), context)).status).toBe(
      401,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("non-admin callers cannot unpublish", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: 6, role: "worker" } });
    expect((await POST(request({ action: "unpublish" }), context)).status).toBe(
      403,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("saves a short draft with failed real QA and still blocks approval and publishing", async () => {
    const actual = await vi.importActual<
      typeof import("@/lib/blog/edited-draft-quality")
    >("@/lib/blog/edited-draft-quality");
    mocks.evaluateEdited.mockImplementation(actual.evaluateEditedBlogDraft);
    const before = await mocks.findByID();
    const contentNo =
      "Dette er et kort, uferdig utkast som må bearbeides før det kan godkjennes. Det skal kunne lagres uten publisering.";
    const saved = await POST(
      request({ action: "save", titleNo: "Utkast", contentNo }),
      context,
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      qualityPassed: false,
      outcome: "saved",
      qualityScore: 0,
    });
    const update = mocks.update.mock.calls[0][0];
    expect(update.data).toMatchObject({
      contentNo,
      editorialStatus: "human_review",
      reviewerName: null,
      reviewedAt: null,
      scheduledAt: null,
      _status: "draft",
      qualityChecks: { passed: false },
    });
    expect(update.context.expectedBlogRevision).toEqual(expect.any(String));
    mocks.findByID.mockResolvedValue({ ...before, ...update.data });
    mocks.update.mockClear();
    for (const [action, code] of [
      ["approve", "QUALITY_NOT_READY"],
      ["publish", "INVALID_TRANSITION"],
    ]) {
      const blocked = await POST(request({ action }), context);
      expect(blocked.status).toBe(409);
      expect(await blocked.json()).toMatchObject({ ok: false, code });
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ contentNo: " " }, "contentNo", "required"],
    [{ contentNo: "x".repeat(30001) }, "contentNo", "too_long"],
    [{ contentNo: 42 }, "contentNo", "invalid"],
    [{ titleNo: "" }, "titleNo", "required"],
    [{ titleNo: "x".repeat(161) }, "titleNo", "too_long"],
    [{ excerptNo: "x".repeat(501) }, "excerptNo", "too_long"],
  ])(
    "rejects invalid draft input with a safe field error (%s)",
    async (invalid, field, code) => {
      const response = await POST(
        request({
          action: "save",
          titleNo: "Valid title",
          contentNo: "Valid short draft",
          ...invalid,
        }),
        context,
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        ok: false,
        code: "VALIDATION_ERROR",
        fieldIssues: [{ field, code }],
      });
      expect(mocks.findByID).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("handles malformed JSON and missing required fields as validation errors", async () => {
    const malformed = await POST(
      new Request("https://example.invalid/api/admin/blog/posts/9", {
        method: "POST",
        body: "{invalid",
      }),
      context,
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldIssues: [{ field: "request", code: "invalid" }],
    });
    const missing = await POST(request({ action: "save" }), context);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({
      fieldIssues: [
        { field: "titleNo", code: "required" },
        { field: "contentNo", code: "required" },
      ],
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["approve", "reject", "schedule", "publish"])(
    "%s rejects a different revision even with the same timestamp",
    async (action) => {
      const base = await mocks.findByID();
      const captured = {
        ...base,
        editorialStatus: action === "approve" ? "human_review" : "approved",
        updatedAt: "2026-09-12T00:00:00.000Z",
      };
      mocks.findByID.mockResolvedValue(captured);
      mocks.update.mockImplementation(async ({ context: writeContext }) => {
        assertExpectedPostRevision(writeContext, {
          ...captured,
          contentNo: "Concurrent native change",
          reviewerName: null,
        });
        throw new Error("Snapshot guard must reject first");
      });
      const response = await POST(
        request({ action, scheduledAt: "2099-09-14T07:00:00.000Z" }),
        context,
      );
      expect(response.status).toBe(409);
      expect(mocks.update).toHaveBeenCalledOnce();
      expect(mocks.recordAudit).not.toHaveBeenCalled();
    },
  );
  beforeEach(() => {
    mocks.auth
      .mockReset()
      .mockResolvedValue({ user: { id: 4, role: "admin", name: "Kari" } });
    mocks.captureException.mockReset();
    mocks.evaluateEdited.mockReset().mockReturnValue({
      policyVersion: "2026-09-12-repetition-v1",
      passed: false,
      score: 40,
      issues: [{ code: "unsafe_roof_advice", severity: "blocker" }],
      checkedAt: "2026-08-30T13:00:00.000Z",
    });
    mocks.find.mockReset().mockResolvedValue({ docs: [] });
    mocks.findByID.mockReset().mockResolvedValue({
      id: 9,
      updatedAt: "2026-09-12T10:00:00.000Z",
      slug: "takvask-pris",
      titleNo: "Tidligere kontrollert tittel",
      contentNo: "Tidligere kontrollert innhold",
      editorialStatus: "approved",
      sources: [
        {
          label: "Arbeidstilsynet",
          url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
          publisher: "Arbeidstilsynet",
        },
      ],
      qualityScore: 92,
      qualityChecks: {
        policyVersion: "2026-09-12-repetition-v1",
        passed: true,
      },
      reviewerName: "Tidligere kontrollør",
      reviewedAt: "2026-08-29T10:00:00.000Z",
      scheduledAt: "2026-09-01T08:00:00.000Z",
      aiAssisted: true,
      _status: "draft",
    });
    mocks.update
      .mockReset()
      .mockImplementation(async ({ data }) => ({ id: 9, ...data }));
    mocks.recordAudit.mockReset().mockResolvedValue(undefined);
    mocks.regenerate.mockReset();
  });

  it("replaces stale QA and review evidence after text or SEO edits", async () => {
    const response = await POST(
      request({
        action: "save",
        titleNo: "Oppdatert kontrollert artikkeltittel",
        contentNo: "Oppdatert artikkeltekst ".repeat(20),
        excerptNo: "Oppdatert ingress som skal kontrolleres på nytt.",
        seoTitleNo: "Oppdatert SEO-tittel",
        seoDescriptionNo: "Oppdatert SEO-beskrivelse som skal kontrolleres.",
        primaryKeyword: "oppdatert takvask",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      action: "save",
      qualityPassed: false,
      qualityScore: 40,
    });
    expect(mocks.evaluateEdited).toHaveBeenCalledWith(
      expect.objectContaining({
        edits: expect.objectContaining({
          contentNo: expect.stringContaining("Oppdatert artikkeltekst"),
        }),
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          trustedBlogQualityRevalidation: true,
        }),
        draft: true,
        data: expect.objectContaining({
          qualityScore: 40,
          qualityChecks: expect.objectContaining({ passed: false }),
          editorialStatus: "human_review",
          scheduledAt: null,
          reviewerName: null,
          reviewedAt: null,
          _status: "draft",
        }),
      }),
    );
  });

  it("does not reuse the old keyword when the administrator clears it", async () => {
    const response = await POST(
      request({
        action: "save",
        titleNo: "Oppdatert kontrollert artikkeltittel",
        contentNo: "Oppdatert artikkeltekst ".repeat(20),
        excerptNo: "Oppdatert ingress som skal kontrolleres på nytt.",
        seoTitleNo: "Oppdatert SEO-tittel",
        seoDescriptionNo: "Oppdatert SEO-beskrivelse som skal kontrolleres.",
        primaryKeyword: "",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.evaluateEdited).toHaveBeenCalledWith(
      expect.objectContaining({
        edits: expect.objectContaining({ primaryKeyword: "" }),
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ primaryKeyword: null }),
      }),
    );
  });

  it("returns a safe no-alternative result instead of claiming a stock replacement", async () => {
    mocks.attachStock.mockResolvedValue({
      outcome: "no_alternative",
      query: "mossy roof",
      existingAssetId: "17490212",
    });

    const response = await POST(request({ action: "stock-image" }), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      action: "stock-image",
      code: "NO_ALTERNATIVE",
      outcome: "no_alternative",
    });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("returns sanitized quality feedback and retains the draft when regeneration is blocked", async () => {
    const blocked = new ArticleQualityBlockedError(
      {
        passed: false,
        score: 63,
        checkedAt: "2026-09-12T05:45:11.417Z",
        issues: [
          {
            code: "content_too_short",
            severity: "warning",
            message: "Artikkelen har bare 547 ord.",
            gate: "seo",
          },
        ],
      },
      {
        provider: "gemini",
        model: "test-model",
        promptVersion: "test-prompt",
        knowledgeVersion: "test-knowledge",
      },
    );
    blocked.runId = 5;
    mocks.regenerate.mockRejectedValue(blocked);

    const response = await POST(
      request({
        action: "regenerate",
        regenerationInstructions: "Retain the edited introduction.",
      }),
      context,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      action: "regenerate",
      code: "QUALITY_BLOCKED",
      runId: 5,
      outcome: "retained_draft",
      qualityIssues: [
        {
          code: "content_too_short",
          severity: "warning",
          message: "Artikkelen har bare 547 ord.",
        },
      ],
    });
    expect(mocks.regenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        regenerationInstructions: "Retain the edited introduction.",
      }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("preserves explicit manual administrator publication", async () => {
    mocks.findByID.mockResolvedValue({
      id: 9,
      editorialStatus: "approved",
      qualityScore: 92,
      qualityChecks: {
        policyVersion: "2026-09-12-repetition-v1",
        passed: true,
      },
      authorName: "Takfornyelse",
      sources: [
        {
          label: "Arbeidstilsynet",
          url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
          publisher: "Arbeidstilsynet",
        },
      ],
      reviewerName: "Tidligere kontrollør",
      reviewedAt: "2026-08-29T10:00:00.000Z",
      _status: "draft",
    });

    const response = await POST(request({ action: "publish" }), context);

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        data: expect.objectContaining({
          _status: "published",
          editorialStatus: "approved",
          reviewerName: "Tidligere kontrollør",
          reviewedAt: "2026-08-29T10:00:00.000Z",
        }),
      }),
    );
  });

  it("blocks publish until a separate approve step has happened", async () => {
    mocks.findByID.mockResolvedValue({
      id: 9,
      editorialStatus: "human_review",
      qualityScore: 92,
      qualityChecks: {
        policyVersion: "2026-09-12-repetition-v1",
        passed: true,
      },
      authorName: "Takfornyelse",
      sources: [
        {
          label: "Arbeidstilsynet",
          url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
          publisher: "Arbeidstilsynet",
        },
      ],
      reviewerName: "Kari",
      reviewedAt: "2026-08-29T10:00:00.000Z",
      _status: "draft",
    });

    const response = await POST(request({ action: "publish" }), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Only approved articles can be published",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks publish when the article has only homepage sources", async () => {
    mocks.findByID.mockResolvedValue({
      id: 9,
      editorialStatus: "approved",
      qualityScore: 92,
      qualityChecks: {
        policyVersion: "2026-09-12-repetition-v1",
        passed: true,
      },
      authorName: "Takfornyelse",
      sources: [
        {
          label: "SINTEF",
          url: "https://www.sintef.no/",
          publisher: "SINTEF",
        },
      ],
      reviewerName: "Kari",
      reviewedAt: "2026-08-29T10:00:00.000Z",
      _status: "draft",
    });

    const response = await POST(request({ action: "publish" }), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "PUBLICATION_NOT_READY",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks publish when no persisted approval record exists yet", async () => {
    mocks.findByID.mockResolvedValue({
      id: 9,
      editorialStatus: "approved",
      qualityScore: 92,
      qualityChecks: {
        policyVersion: "2026-09-12-repetition-v1",
        passed: true,
      },
      authorName: "Takfornyelse",
      sources: [
        {
          label: "Arbeidstilsynet",
          url: "https://www.arbeidstilsynet.no/arbeidsmiljo/arbeid-i-hoyden/",
          publisher: "Arbeidstilsynet",
        },
      ],
      reviewerName: null,
      reviewedAt: null,
      _status: "draft",
    });

    const response = await POST(request({ action: "publish" }), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Reviewer name is required",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
