// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { BlogEditor } from "./blog-editor";

const props = {
  id: 3,
  locale: "lt" as const,
  titleNo: "Slik sjekker du taket etter vinteren",
  excerptNo: "Trumpa santrauka",
  contentNo: "Pakankamai ilgas straipsnio tekstas.",
  seoTitleNo: "SEO pavadinimas",
  seoDescriptionNo: "SEO aprašymas",
  primaryKeyword: "tak etter vinter",
  reviewerName: "Kari",
  status: "human_review",
  qualityPassed: false,
  qualityScore: null,
  publishEligible: false,
  scheduledAt: "2026-09-12T08:30:00.000Z",
  schedulerEnabled: false,
  updatedAt: "2026-09-12T10:00:00.000Z",
};

describe("blog editor", () => {
  it("offers rescheduling only after the saved future time changes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ok: true, action: "schedule" }));
    vi.stubGlobal("fetch", fetcher);
    await renderedEditor(
      async (container) => {
        const button = Array.from(container.querySelectorAll("button")).find(
          (item) => item.textContent === "Pakeisti laiką",
        )!;
        expect(button.disabled).toBe(true);
        expect(container.textContent).not.toContain(
          "Planavimas bus galimas po specialisto patvirtinimo.",
        );
        expect(container.textContent).toContain("2099-09-14");
        const input = container.querySelector<HTMLInputElement>(
          'input[type="datetime-local"]',
        )!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )!.set!.call(input, "2099-09-15T09:00");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(button.disabled).toBe(false);
        await act(async () => button.click());
        expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
          action: "schedule",
          scheduledAt: "2099-09-15T07:00:00.000Z",
          expectedUpdatedAt: props.updatedAt,
        });
      },
      {
        status: "scheduled",
        scheduledAt: "2099-09-14T07:00:00.000Z",
        qualityPassed: true,
        qualityScore: 100,
      },
    );
  });
  it("requires confirmation for explicit unpublish and submits only the revision guard", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ok: true, outcome: "unpublished" }));
    vi.stubGlobal("fetch", fetcher);
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    try {
      await renderedEditor(
        async (container) => {
          const button = Array.from(container.querySelectorAll("button")).find(
            (item) => item.textContent === "Išjungti publikaciją",
          )!;
          expect(button.disabled).toBe(false);
          await act(async () => button.click());
          expect(fetcher).not.toHaveBeenCalled();
          confirm.mockReturnValue(true);
          await act(async () => button.click());
          expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
            action: "unpublish",
            expectedUpdatedAt: props.updatedAt,
          });
          expect(container.textContent).toContain("Publikacija išjungta");
        },
        { hasPublicVersion: true },
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("does not offer unpublish for a draft-only post", () => {
    const html = renderToStaticMarkup(createElement(BlogEditor, props));
    expect(html).not.toContain("Išjungti publikaciją");
  });
  afterEach(() => vi.unstubAllGlobals());
  async function renderedEditor(
    run: (container: HTMLDivElement) => Promise<void>,
    overrides: Partial<Parameters<typeof BlogEditor>[0]> = {},
  ) {
    const testEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(createElement(BlogEditor, { ...props, ...overrides })),
      );
      await run(container);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      testEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    }
  }
  it.each([
    ["lt", "Užpildykite šį laukelį."],
    ["nb", "Fyll ut dette feltet."],
    ["en", "Complete this field."],
  ] as const)(
    "focuses the invalid field and shows localized inline validation (%s)",
    async (locale, message) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await renderedEditor(
        async (container) => {
          await act(async () =>
            container
              .querySelector<HTMLButtonElement>("section button")!
              .click(),
          );
          const text = container.querySelector<HTMLTextAreaElement>(
            '[data-blog-field="contentNo"]',
          )!;
          expect(text.getAttribute("aria-invalid")).toBe("true");
          expect(text.getAttribute("aria-describedby")).toBe(
            "blog-field-error-3-contentNo",
          );
          expect(
            container.querySelector("#blog-field-error-3-contentNo")
              ?.textContent,
          ).toBe(message);
          expect(document.activeElement).toBe(text);
          expect(fetcher).not.toHaveBeenCalled();
        },
        { locale, contentNo: " " },
      );
    },
  );
  it("allows short nonempty draft text to reach the save endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        action: "save",
        outcome: "saved",
        qualityPassed: false,
        qualityScore: 0,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await renderedEditor(async (container) => {
      await act(async () =>
        container.querySelector<HTMLButtonElement>("section button")!.click(),
      );
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
        action: "save",
        contentNo: props.contentNo,
      });
      expect(container.textContent).toContain(
        "Kokybės patikra atlikta iš naujo",
      );
      const publish = [
        ...container.querySelectorAll<HTMLButtonElement>("button"),
      ].find((button) => button.textContent === "Publikuoti");
      expect(publish?.disabled).toBe(true);
    });
  });
  it("maps server validation to a field without leaking the raw error or losing typed text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            error: "Invalid action",
            fieldIssues: [{ field: "contentNo", code: "too_long" }],
          },
          { status: 400 },
        ),
      ),
    );
    await renderedEditor(async (container) => {
      await act(async () =>
        container.querySelector<HTMLButtonElement>("section button")!.click(),
      );
      expect(
        container.querySelector("#blog-field-error-3-contentNo")?.textContent,
      ).toContain("30000");
      expect(
        container.querySelector<HTMLTextAreaElement>(
          '[data-blog-field="contentNo"]',
        )?.value,
      ).toBe(props.contentNo);
      expect(container.textContent).not.toContain("Invalid action");
    });
  });
  it("shows localized blocked-approval feedback instead of the English backend message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            code: "QUALITY_NOT_READY",
            error: "The deterministic quality gate has not passed",
          },
          { status: 409 },
        ),
      ),
    );
    await renderedEditor(async (container) => {
      const approve = [
        ...container.querySelectorAll<HTMLButtonElement>("button"),
      ].find((button) => button.textContent === "Patvirtinti")!;
      await act(async () => approve.click());
      expect(container.textContent).toContain(
        "Straipsnis dar neišlaikė kokybės patikros.",
      );
      expect(container.textContent).not.toContain(
        "The deterministic quality gate has not passed",
      );
    });
  });
  it("renders the recheck action, visibly locked publish action, and narrow-safe action wrap", () => {
    const html = renderToStaticMarkup(createElement(BlogEditor, props));

    expect(html).toContain("Atlikti kokybės patikrą iš naujo");
    expect(html).toContain("Publikavimas užrakintas");
    expect(html).toContain("flex flex-wrap gap-3");
    expect(html).toContain("disabled:cursor-not-allowed");
    expect(html).toContain("Ką reikia pagerinti?");
    expect(html).toContain(
      "Išsaugotas planas: 2026-09-12T10:30 (Europe/Oslo).",
    );
    expect(html).toContain("Planavimas sustabdytas funkcijos nustatymu.");
    expect(html).toContain("Laikas visada interpretuojamas kaip Europe/Oslo.");
  });

  it("keeps the Oslo time-zone label when no saved plan exists", () => {
    const html = renderToStaticMarkup(
      createElement(BlogEditor, { ...props, scheduledAt: undefined }),
    );

    expect(html).toContain("Laikas visada interpretuojamas kaip Europe/Oslo.");
    expect(html).not.toContain("Išsaugotas planas:");
  });

  it.each([
    [
      "2026-03-29T02:30",
      "Pasirinktas Oslo laikas neegzistuoja dėl vasaros laiko. Pasirinkite kitą laiką.",
    ],
    [
      "2026-10-25T02:30",
      "Pasirinktas Oslo laikas pereinant į žiemos laiką pasikartoja du kartus. Pasirinkite kitą, vienareikšmį laiką.",
    ],
    ["2026-10-25T02:30:20", "Prieš planuodami įveskite tinkamą Oslo laiką."],
  ])(
    "shows the schedule validation target for a human-review article without a button click (%s)",
    async (scheduledAt, message) => {
      const reactTestEnvironment = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      };
      reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      try {
        await act(async () => {
          root.render(
            createElement(BlogEditor, { ...props, scheduledAt: undefined }),
          );
        });
        const scheduleInput = container.querySelector<HTMLInputElement>(
          'input[type="datetime-local"]',
        );
        expect(scheduleInput).not.toBeNull();
        const inputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        expect(inputValueSetter).toBeDefined();

        await act(async () => {
          inputValueSetter?.call(scheduleInput, scheduledAt);
          scheduleInput?.dispatchEvent(new Event("input", { bubbles: true }));
        });

        expect(scheduleInput?.getAttribute("aria-describedby")).toBe(
          "blog-schedule-zone blog-schedule-validation",
        );
        expect(scheduleInput?.getAttribute("aria-invalid")).toBe("true");
        expect(
          container.querySelector("#blog-schedule-validation")?.textContent,
        ).toBe(message);
        expect(container.textContent).toContain(
          "Planavimas bus galimas po specialisto patvirtinimo.",
        );
      } finally {
        await act(async () => root.unmount());
        container.remove();
        reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
      }
    },
  );
});
