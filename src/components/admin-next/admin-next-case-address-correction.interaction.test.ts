// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNextCaseAddressCorrection } from "./admin-next-case-address-correction";

describe("Admin Next case address correction", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000013",
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderCorrection() {
    await act(async () => {
      root.render(
        createElement(AdminNextCaseAddressCorrection, {
          caseReference: "TF-13",
          config: {
            caseId: 13,
            currentAddress: {
              city: "Oslo",
              houseNumber: "4",
              postalCode: "0182",
              street: "Gammelgata",
            },
            expectedAddressRevision: 7,
            expectedCaseRevision: 12,
          },
          locale: "lt",
        }),
      );
    });
  }

  async function clickByText(text: string) {
    const button = [
      ...document.body.querySelectorAll<HTMLButtonElement>("button"),
    ].find((item) => item.textContent?.trim() === text);
    expect(button).toBeDefined();
    await act(async () => button?.click());
  }

  async function setControl(name: string, value: string) {
    const control = document.body.querySelector<
      HTMLInputElement | HTMLSelectElement
    >(`[name="${name}"]`);
    expect(control).not.toBeNull();
    const prototype =
      control instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    await act(async () => {
      setter?.call(control, value);
      control?.dispatchEvent(new Event("change", { bubbles: true }));
      control?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function openReview() {
    await clickByText("Taisyti bylos adresą");
    await setControl("street", "Nygata");
    await setControl("houseNumber", "8");
    await setControl("postalCode", "0184");
    await setControl("reasonCode", "customer_confirmation");
    const form = document.body.querySelector<HTMLFormElement>(
      "[data-address-correction-form]",
    );
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(document.body.textContent).toContain(
      "Patvirtinti adreso koregavimą",
    );
  }

  async function confirmReview() {
    const input = document.body.querySelector<HTMLInputElement>(
      "[data-review-typed-confirmation] input",
    );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(input, "CORRECT TF-13");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await clickByText("Koreguoti adresą");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("collects the correction and PATCHes the exact revision-bound command after typed review", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "applied",
          case: { caseRevision: 13, addressRevision: 8 },
          address: {
            city: "Oslo",
            houseNumber: "8",
            postalCode: "0184",
            street: "Nygata",
          },
        }),
        { headers: { "content-type": "application/json" }, status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.fn();
    vi.stubGlobal("confirm", confirm);
    await renderCorrection();
    await openReview();

    expect(document.body.textContent).toContain("Gammelgata 4, 0182 Oslo");
    expect(document.body.textContent).toContain("Nygata 8, 0184 Oslo");
    expect(document.body.textContent).toContain("Klientas patvirtino adresą");
    expect(
      document.body.querySelectorAll("[data-address-correction-invalidation]"),
    ).toHaveLength(2);

    await confirmReview();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/admin/cases/13/address");
    expect(init).toMatchObject({
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      address: {
        city: "Oslo",
        houseNumber: "8",
        postalCode: "0184",
        street: "Nygata",
      },
      expectedAddressRevision: 7,
      expectedCaseRevision: 12,
      idempotencyKey: "address:13:r7:00000000000040008000000000000013",
      reasonCode: "customer_confirmation",
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Adreso koregavimas išsaugotas",
    );
  });

  it("maps a server revision conflict to a fail-closed non-retryable review state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              actualRevision: 14,
              code: "CASE_REVISION_CONFLICT",
              error: "Case address correction was not applied",
              expectedRevision: 12,
            }),
            { headers: { "content-type": "application/json" }, status: 409 },
          ),
      ),
    );
    await renderCorrection();
    await openReview();
    await confirmReview();

    expect(
      document.body
        .querySelector("[data-address-correction-state]")
        ?.getAttribute("data-address-correction-state"),
    ).toBe("conflict");
    expect(document.body.textContent).toContain("Dabartinė revizija yra 14");
    expect(document.body.textContent).not.toContain("Bandyti dar kartą");
  });
});
