// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNextReplyWorkbench } from "./admin-next-reply-workbench";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigation.refresh }),
}));

const aiDisabled = {
  ai: {
    blockers: ["FEATURE_AI_DRAFTS=false" as const],
    state: "feature_disabled" as const,
  },
  manual: { state: "ready" as const },
};

describe("Admin Next reply workbench", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    navigation.refresh.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders a usable manual action and exact non-secret AI blocker", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextReplyWorkbench, {
        caseRevision: 7,
        canApproveSend: true,
        canPrepare: true,
        leadId: 13,
        locale: "lt",
        originalBody: "Noriu stogo plovimo pasiūlymo.",
        readiness: aiDisabled,
      }),
    );

    expect(html).toContain('data-reply-draft-action="manual"');
    expect(html).toContain("Sukurti rankinį juodraštį");
    expect(html).toContain('data-reply-draft-action="ai"');
    expect(html).toContain('disabled=""');
    expect(html).toContain(
      "DI juodraščiai šioje Preview aplinkoje yra išjungti.",
    );
    expect(html).toContain("Techninė informacija");
    expect(html).toContain("data-ai-technical-blockers");
    expect(html).toContain("FEATURE_AI_DRAFTS=false");
    expect(html).not.toContain("must-not-cross-the-server-boundary");
  });

  it("creates only a manual draft and does not request sending", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 44 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      root.render(
        createElement(AdminNextReplyWorkbench, {
          caseRevision: 7,
          canApproveSend: true,
          canPrepare: true,
          leadId: 13,
          locale: "lt",
          readiness: aiDisabled,
        }),
      );
    });

    const button = container.querySelector<HTMLButtonElement>(
      '[data-reply-draft-action="manual"]',
    );
    await act(async () => button?.click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      action: "prepare_manual_reply",
      expectedRevision: 7,
    });
    expect(String(request.body)).not.toContain("send");
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("binds a manual draft to the exact active customer question", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 45 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      root.render(
        createElement(AdminNextReplyWorkbench, {
          activeQuestionId: "message-33",
          caseRevision: 8,
          canApproveSend: true,
          canPrepare: true,
          leadId: 13,
          locale: "en",
          readiness: aiDisabled,
        }),
      );
    });

    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[data-reply-draft-action="manual"]')
        ?.click(),
    );

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      action: "prepare_manual_question_reply",
      expectedRevision: 8,
      sourceMessageId: 33,
    });
  });

  it("renders an existing draft editor while keeping AI actions unavailable", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextReplyWorkbench, {
        activeDraft: {
          id: 91,
          aiAssisted: false,
          bodyText: "Skriv et kontrollert svar til kunden her før utsending.",
          manualReplyRequiresEditing: true,
          subject: "Svar på din takhenvendelse",
          updatedAt: "2026-09-05T09:00:00.000Z",
        },
        caseRevision: 9,
        canApproveSend: true,
        canPrepare: true,
        leadId: 13,
        locale: "lt",
        originalBody: "Originalus kliento tekstas.",
        readiness: aiDisabled,
      }),
    );

    expect(html).toContain('data-active-reply-draft="91"');
    expect(html).toContain('data-message-draft-ai-state="unavailable"');
    expect(html).toContain("Patvirtinti ir išsiųsti");
    expect(html).toContain("Pradinė kliento užklausa");
  });

  it("keeps draft editing separate from the protected approve-and-send capability", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextReplyWorkbench, {
        activeDraft: {
          id: 92,
          aiAssisted: false,
          bodyText: "A customer-specific reply that has already been reviewed.",
          manualReplyRequiresEditing: false,
          subject: "Reply to your roof enquiry",
          updatedAt: "2026-09-05T09:10:00.000Z",
        },
        caseRevision: 10,
        canApproveSend: false,
        canPrepare: true,
        leadId: 13,
        locale: "en",
        originalBody: "Please assess my roof.",
        readiness: aiDisabled,
      }),
    );

    expect(html).toContain("Save draft");
    expect(html).not.toContain("Approve and send");
    expect(html).toContain(
      "This account can save a draft, but cannot approve and send messages.",
    );
  });
});
