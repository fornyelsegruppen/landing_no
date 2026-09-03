import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachStock: vi.fn(),
  captureException: vi.fn(),
  evaluateEdited: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  recordAudit: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: vi.fn(async () => ({ user: { id: 4, role: "admin", name: "Kari" } })),
    find: mocks.find,
    findByID: mocks.findByID,
    update: mocks.update,
  })),
}));
vi.mock("@/lib/monitoring", () => ({
  captureException: mocks.captureException,
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));
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
vi.mock("@/lib/providers/gemini-ai-provider", () => ({
  GeminiAiProvider: class GeminiAiProvider {},
}));
vi.mock("@/lib/blog/payload-blog-engine", () => ({
  regeneratePayloadBlogPost: vi.fn(),
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("https://www.takfornyelse.as/api/admin/blog/posts/9", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "9" }) };

describe("admin blog post actions", () => {
  beforeEach(() => {
    mocks.captureException.mockReset();
    mocks.evaluateEdited.mockReset().mockReturnValue({
      passed: false,
      score: 40,
      issues: [{ code: "unsafe_roof_advice", severity: "blocker" }],
      checkedAt: "2026-08-30T13:00:00.000Z",
    });
    mocks.find.mockReset().mockResolvedValue({ docs: [] });
    mocks.findByID.mockReset().mockResolvedValue({
      id: 9,
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
      qualityChecks: { passed: true },
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
        context: { trustedBlogQualityRevalidation: true },
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

  it("preserves explicit manual administrator publication", async () => {
    mocks.findByID.mockResolvedValue({
      id: 9,
      editorialStatus: "approved",
      qualityScore: 92,
      qualityChecks: { passed: true },
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
      qualityChecks: { passed: true },
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
      qualityChecks: { passed: true },
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
      error: "Minst én presis kilde må være lagt inn før publisering",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks publish when no persisted approval record exists yet", async () => {
    mocks.findByID.mockResolvedValue({
      id: 9,
      editorialStatus: "approved",
      qualityScore: 92,
      qualityChecks: { passed: true },
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
