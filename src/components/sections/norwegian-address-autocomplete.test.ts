// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NorwegianAddressAutocomplete,
  type NorwegianAddressSelection,
} from "./norwegian-address-autocomplete";

const candidate = (
  houseNumber: number,
  postalCode = "1182",
): NorwegianAddressSelection => ({
  provider: "kartverket-address-rest-v1",
  providerAddressId: `0301-1-2-0-0-Testveien ${houseNumber}`,
  canonicalLabel: `Testveien ${houseNumber}, ${postalCode} OSLO`,
  streetAddress: `Testveien ${houseNumber}`,
  postalCode,
  city: "OSLO",
  latitude: 59.89 + houseNumber / 10_000,
  longitude: 10.79 + houseNumber / 10_000,
});

function jsonResponse(items: NorwegianAddressSelection[]) {
  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function ControlledAutocomplete({ initialPostal = "1182" }) {
  const [value, setValue] = useState("");
  const [postal, setPostal] = useState(initialPostal);
  const [selection, setSelection] = useState<NorwegianAddressSelection | null>(
    null,
  );
  const [manual, setManual] = useState(false);

  return createElement(
    "div",
    null,
    createElement(NorwegianAddressAutocomplete, {
      id: "address",
      locale: "no",
      value,
      postalCode: postal,
      selection,
      manualMode: manual,
      onValueChange: setValue,
      onPostalCodeChange: setPostal,
      onSelectionChange: setSelection,
      onManualModeChange: setManual,
    }),
    createElement(
      "output",
      { "data-selection": true },
      selection ? JSON.stringify(selection) : "none",
    ),
    createElement("output", { "data-postal": true }, postal),
  );
}

describe("NorwegianAddressAutocomplete", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(ControlledAutocomplete));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function typeAddress(value: string) {
    const input = container.querySelector<HTMLInputElement>("#address");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return input!;
  }

  async function finishDebounce() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("does not search a short query and offers an explicit manual fallback for no results", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await typeAddress("abc");
    await finishDebounce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Skriv minst 4 tegn");

    await typeAddress("Testveien");
    await finishDebounce();
    expect(container.textContent).toContain("Ingen adresser funnet");

    const manualButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Skriv adressen manuelt",
    );
    await act(async () => manualButton?.click());
    expect(
      container.querySelector("#address")?.getAttribute("role"),
    ).toBeNull();
    expect(container.textContent).toContain(
      "har ikke koordinater fra Kartverket",
    );
  });

  it("shows a localized sanitized provider error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: "internal provider secret" }), {
          status: 502,
        }),
      ),
    );

    await typeAddress("Testveien");
    await finishDebounce();

    expect(container.textContent).toContain("midlertidig utilgjengelig");
    expect(container.textContent).not.toContain("internal provider secret");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("supports touch-sized option selection and immediately clears coordinates when edited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([candidate(1)])),
    );

    await typeAddress("Testveien");
    await finishDebounce();
    const option = container.querySelector<HTMLButtonElement>(
      '[role="option"][data-address-option]',
    );
    expect(option?.className).toContain("min-h-11");
    expect(option?.className).toContain("touch-manipulation");

    await act(async () => option?.click());
    expect(container.querySelector("[data-selection]")?.textContent).toContain(
      '"latitude":59.8901',
    );
    expect(container.querySelector<HTMLInputElement>("#address")?.value).toBe(
      "Testveien 1, 1182 OSLO",
    );

    await typeAddress("Testveien 1B");
    expect(container.querySelector("[data-selection]")?.textContent).toBe(
      "none",
    );
  });

  it("ignores a stale response even when the transport resolves after a newer search", async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    let resolveSecond: ((response: Response) => void) | undefined;
    const first = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementationOnce(() => first)
        .mockImplementationOnce(() => second),
    );

    await typeAddress("Testveien 1");
    await finishDebounce();
    await typeAddress("Testveien 2");
    await finishDebounce();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(
      (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal
        ?.aborted,
    ).toBe(true);
    await act(async () => resolveSecond?.(jsonResponse([candidate(2)])));
    expect(container.textContent).toContain("Testveien 2, 1182 OSLO");

    await act(async () => resolveFirst?.(jsonResponse([candidate(1)])));
    expect(container.textContent).not.toContain("Testveien 1, 1182 OSLO");
    expect(container.textContent).toContain("Testveien 2, 1182 OSLO");
  });

  it("selects by keyboard and requires explicit correction for a postal conflict", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(ControlledAutocomplete, { initialPostal: "9999" }),
      );
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse([candidate(1), candidate(2)])),
    );

    const input = await typeAddress("Testveien");
    await finishDebounce();
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    });
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(container.querySelector("[data-selection]")?.textContent).toContain(
      "Testveien 1",
    );
    expect(container.textContent).toContain("du skrev 9999");
    expect(container.textContent).toContain("Behold mine opplysninger manuelt");
    const correction = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Bruk postnummeret fra valgt adresse",
    );
    await act(async () => correction?.click());
    expect(container.querySelector("[data-postal]")?.textContent).toBe("1182");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps only the street part when a selected address is changed to manual", async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(ControlledAutocomplete, { initialPostal: "9999" }),
      );
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([candidate(1)])),
    );

    await typeAddress("Testveien");
    await finishDebounce();
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>("[data-address-option]")
        ?.click(),
    );
    const keepManual = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Behold mine opplysninger manuelt",
    );
    await act(async () => keepManual?.click());

    expect(container.querySelector("[data-selection]")?.textContent).toBe(
      "none",
    );
    expect(container.querySelector<HTMLInputElement>("#address")?.value).toBe(
      "Testveien 1",
    );
    expect(
      container.querySelector("#address")?.getAttribute("role"),
    ).toBeNull();
  });
});
