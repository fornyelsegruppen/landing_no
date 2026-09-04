// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminNextRoofFusionAddressAutocomplete,
  resetRoofFusionAddressAutocompleteCacheForTests,
} from "./admin-next-roof-fusion-address-autocomplete";
import { AdminNextRoofFusionUatControl } from "./admin-next-roof-fusion-uat-control";

const addressSuggestion = {
  id: "KVE:PostalAddress:123",
  kind: "address" as const,
  label: "Lyngveien 28A, Oslo",
  address: {
    id: "KVE:PostalAddress:123",
    label: "Lyngveien 28A, Oslo",
    postalCode: "1182",
    city: "Oslo",
    latitude: 59.91138,
    longitude: 10.7494,
    source: "Kartverket matrikkeladresser per Entur Geocoder v3",
  },
};

describe("RF address autocomplete", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    resetRoofFusionAddressAutocompleteCacheForTests();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const render = (onMeasurementBlockedChange = vi.fn()) => {
    root.render(
      createElement(AdminNextRoofFusionAddressAutocomplete, {
        inputClassName: "input",
        label: "Adresas",
        onMeasurementBlockedChange,
        placeholder: "Storgata 1, Oslo",
      }),
    );
    return onMeasurementBlockedChange;
  };

  const type = async (value: string) => {
    const input = container.querySelector<HTMLInputElement>(
      "input[role='combobox']",
    )!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    return input;
  };

  it("debounces requests and ignores an aborted stale response", async () => {
    let resolveFirst: (value: Response) => void = () => {};
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suggestions: [addressSuggestion] })),
      );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => render());

    await type("Lyn");
    await act(async () => vi.advanceTimersByTime(299));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      container
        .querySelector("input[role='combobox']")
        ?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(container.textContent).toContain("Ieškoma oficialių adresų");

    await type("Lyngveien 28");
    await act(async () => vi.advanceTimersByTime(300));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveFirst(
        new Response(
          JSON.stringify({
            suggestions: [{ ...addressSuggestion, label: "Pasenęs adresas" }],
          }),
        ),
      );
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain("Pasenęs adresas");
    await act(async () => Promise.resolve());
    expect(container.textContent).toContain("Lyngveien 28A, Oslo");
    expect(
      container
        .querySelector("input[role='combobox']")
        ?.getAttribute("aria-busy"),
    ).toBe("false");
  });

  it("supports ARIA keyboard selection and submits canonical coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              suggestions: [addressSuggestion],
            }),
          ),
      ),
    );
    await act(async () => render());
    const input = await type("Lyngveien 28");
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("[role='listbox']")).not.toBeNull();
    expect(container.querySelector("[role='option']")).not.toBeNull();
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[role='listbox']")).toBeNull();
    await type("Lyngveien 28A");
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      );
    });
    expect(input.getAttribute("aria-activedescendant")).toContain("option-0");
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    expect(input.value).toBe("Lyngveien 28A, Oslo");
    expect(
      container.querySelector<HTMLInputElement>("[name='selectedAddressId']")
        ?.value,
    ).toBe("KVE:PostalAddress:123");
    expect(
      container.querySelector<HTMLInputElement>(
        "[name='selectedAddressLatitude']",
      )?.value,
    ).toBe("59.91138");
    expect(
      container.querySelector<HTMLInputElement>(
        "[name='selectedAddressLongitude']",
      )?.value,
    ).toBe("10.7494");
  });

  it("keeps manual search available on provider error", async () => {
    const streetChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await act(async () => render(streetChange));
    await type("Storgata");
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Rankinė paieška veikia");
    expect(streetChange).toHaveBeenLastCalledWith(false);
  });

  it("marks a street-only suggestion as non-actionable until a house number is selected", async () => {
    const streetChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              suggestions: [
                {
                  id: "KVE:TopographicPlace:0301-LYNGVEIEN",
                  kind: "street",
                  label: "Lyngveien, Oslo",
                },
              ],
            }),
          ),
      ),
    );
    await act(async () => render(streetChange));
    await type("Lyngveien");
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    await act(async () =>
      container.querySelector<HTMLButtonElement>("[role='option']")!.click(),
    );
    expect(streetChange).toHaveBeenLastCalledWith(true);
    expect(container.textContent).toContain(
      "Įrašykite namo numerį ir pasirinkite konkretų oficialų adresą",
    );
    expect(container.querySelector("[name='selectedAddressId']")).toBeNull();
  });

  it("never starts address lookup or Norge capture while the operator is only typing", async () => {
    const addressLookupAction = vi.fn(async () => ({ kind: "idle" as const }));
    const captureApi = vi.fn(async () => ({ imageUrl: "/unused" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              suggestions: [
                {
                  id: "KVE:TopographicPlace:0301-LYNGVEIEN",
                  kind: "street",
                  label: "Lyngveien, Oslo",
                },
              ],
            }),
          ),
      ),
    );
    await act(async () => {
      root.render(
        createElement(AdminNextRoofFusionUatControl, {
          action: async () => ({ kind: "idle" as const }),
          actorId: "7",
          addressLookupAction,
          captureApi,
          defaultCaseReference: "TF-13",
          heightAnalysisAction: async () => ({ kind: "idle" as const }),
          locale: "lt",
        }),
      );
    });
    await type("Lyngveien 28");
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    const submit = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[type='submit']"),
    ).find((button) => button.textContent?.includes("Rasti adresą"));
    expect(submit?.disabled).toBe(true);
    await act(async () =>
      container.querySelector<HTMLButtonElement>("[role='option']")!.click(),
    );
    expect(submit?.disabled).toBe(true);
    expect(addressLookupAction).not.toHaveBeenCalled();
    expect(captureApi).not.toHaveBeenCalled();
  });
});
