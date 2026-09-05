// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddressCorrectionReviewAndCommit,
  type AddressCorrectionCommitInput,
  type AddressCorrectionCommitResult,
} from "./review-and-commit";
import type { PanelLocale } from "@/lib/panel-i18n";

const invalidations = [
  {
    id: "rf-source:17",
    kind: "rf_source" as const,
    label: "Norge i bilder capture r7",
    reason: "Capture coordinates are bound to the previous address.",
  },
  {
    id: "draft:22",
    kind: "draft" as const,
    label: "Roof outline draft r3",
    reason: "The draft was derived from RF source 17.",
  },
];

describe("Address correction ReviewAndCommit", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderReview({
    afterAddress = "Nygata 8, 0184 Oslo",
    beforeAddress = "Gammelgata 4, 0182 Oslo",
    locale = "lt",
    onCommit = vi.fn(async () => ({
      address: afterAddress,
      caseRevision: 13,
      kind: "success" as const,
    })),
    onResult,
    reason = "Klientas patvirtino namo numerio klaidą.",
  }: {
    afterAddress?: string;
    beforeAddress?: string;
    locale?: PanelLocale;
    onCommit?: (
      input: AddressCorrectionCommitInput,
    ) => Promise<AddressCorrectionCommitResult>;
    onResult?: (result: AddressCorrectionCommitResult) => void;
    reason?: string;
  } = {}) {
    return act(async () => {
      root.render(
        createElement(AddressCorrectionReviewAndCommit, {
          afterAddress,
          beforeAddress,
          caseId: "case:1042",
          caseReference: "TF-1042",
          confirmationPhrase: "TF-1042",
          expectedRevision: 12,
          idempotencyKey: "address-case-1042-r12",
          invalidations,
          locale,
          onCommit,
          onOpenChange: vi.fn(),
          onResult,
          open: true,
          reason,
        }),
      );
    });
  }

  function inputConfirmation(value: string) {
    const input = document.body.querySelector<HTMLInputElement>(
      "[data-review-typed-confirmation] input",
    );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    return act(async () => {
      setter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function commitButton() {
    return [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) =>
      ["Koreguoti adresą", "Korriger adresse", "Correct address"].includes(
        button.textContent?.trim() || "",
      ),
    );
  }

  it.each([
    ["nb", "Før", "Etter", "Begrunnelse", "Dette blir ugyldiggjort"],
    ["lt", "Prieš", "Po", "Priežastis", "Kas bus invaliduota"],
    ["en", "Before", "After", "Reason", "What will be invalidated"],
  ] as const)(
    "shows before/after, reason and invalidation impact in %s",
    async (locale, before, after, reason, impact) => {
      await renderReview({ locale });

      expect(document.body.textContent).toContain(before);
      expect(document.body.textContent).toContain(after);
      expect(document.body.textContent).toContain(reason);
      expect(document.body.textContent).toContain(impact);
      expect(document.body.textContent).toContain("Gammelgata 4, 0182 Oslo");
      expect(document.body.textContent).toContain("Nygata 8, 0184 Oslo");
      expect(
        document.body.querySelectorAll(
          "[data-address-correction-invalidation]",
        ),
      ).toHaveLength(2);
      expect(
        document.body.querySelector("[data-address-correction-before]"),
      ).not.toBeNull();
      expect(
        document.body.querySelector("[data-address-correction-after]"),
      ).not.toBeNull();
    },
  );

  it("requires the exact typed phrase and sends a typed command without window.confirm", async () => {
    let resolveCommit!: (result: AddressCorrectionCommitResult) => void;
    const onCommit = vi.fn(
      () =>
        new Promise<AddressCorrectionCommitResult>((resolve) => {
          resolveCommit = resolve;
        }),
    );
    const onResult = vi.fn();
    const confirm = vi.fn();
    vi.stubGlobal("confirm", confirm);
    await renderReview({ onCommit, onResult });

    expect(commitButton()?.disabled).toBe(true);
    await inputConfirmation("tf-1042");
    expect(commitButton()?.disabled).toBe(true);
    await inputConfirmation("TF-1042");
    expect(commitButton()?.disabled).toBe(false);

    await act(async () => commitButton()?.click());
    expect(commitButton()?.disabled).toBe(true);
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 160));
    });
    expect(
      document.body.querySelector('[role="status"]')?.textContent,
    ).toContain("Koreguoti adresą");
    expect(onCommit).toHaveBeenCalledWith({
      afterAddress: "Nygata 8, 0184 Oslo",
      beforeAddress: "Gammelgata 4, 0182 Oslo",
      caseId: "case:1042",
      caseReference: "TF-1042",
      confirmation: "TF-1042",
      expectedRevision: 12,
      idempotencyKey: "address-case-1042-r12",
      invalidations,
      reason: "Klientas patvirtino namo numerio klaidą.",
    });
    expect(confirm).not.toHaveBeenCalled();

    await act(async () => {
      resolveCommit({
        address: "Nygata 8, 0184 Oslo",
        caseRevision: 13,
        kind: "success",
      });
      await Promise.resolve();
    });
    expect(
      document.body.querySelector('[role="status"]')?.textContent,
    ).toContain("Adreso koregavimas išsaugotas");
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "success", caseRevision: 13 }),
    );
  });

  it("renders a safe retry for a typed retryable error", async () => {
    const onCommit = vi
      .fn<
        (
          input: AddressCorrectionCommitInput,
        ) => Promise<AddressCorrectionCommitResult>
      >()
      .mockResolvedValueOnce({
        correlationId: "corr-address-17",
        kind: "error",
        message: "Laikina saugojimo klaida.",
        retryable: true,
      })
      .mockResolvedValueOnce({
        address: "Nygata 8, 0184 Oslo",
        caseRevision: 13,
        kind: "success",
      });
    await renderReview({ onCommit });
    await inputConfirmation("TF-1042");
    await act(async () => {
      commitButton()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const error = document.body.querySelector('[role="alert"]');
    expect(error?.textContent).toContain("Laikina saugojimo klaida");
    expect(error?.textContent).toContain("corr-address-17");
    const retry = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "Bandyti dar kartą");
    expect(retry).toBeDefined();
    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(
      document.body.querySelector('[role="status"]')?.textContent,
    ).toContain("Adreso koregavimas išsaugotas");
  });

  it("renders a distinct fail-closed revision conflict without retry", async () => {
    const conflictCommit = vi.fn(async () => ({
      currentAddress: "Serverio g. 9, 0185 Oslo",
      currentRevision: 14,
      kind: "conflict" as const,
      message: "Byla pasikeitė po peržiūros.",
    }));
    await renderReview({ onCommit: conflictCommit });
    await inputConfirmation("TF-1042");
    await act(async () => {
      commitButton()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      document.body
        .querySelector("[data-address-correction-state]")
        ?.getAttribute("data-address-correction-state"),
    ).toBe("conflict");
    expect(
      document.body.querySelector('[role="alert"]')?.textContent,
    ).toContain("Serverio g. 9, 0185 Oslo");
    expect(
      document.body.querySelector('[role="alert"]')?.textContent,
    ).toContain("revizija 14");
    expect(document.body.textContent).not.toContain("Bandyti dar kartą");
  });

  it("keeps commit blocked when the address is unchanged or the reason is empty", async () => {
    await renderReview({
      afterAddress: "Gammelgata 4, 0182 Oslo",
      reason: " ",
    });
    await inputConfirmation("TF-1042");

    expect(commitButton()?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Naujas adresas turi skirtis nuo dabartinio",
    );
    expect(document.body.textContent).toContain("Priežastis yra privaloma");
  });
});
