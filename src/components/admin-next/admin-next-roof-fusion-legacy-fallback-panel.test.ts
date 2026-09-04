// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNextRoofFusionLegacyFallbackPanel } from "./admin-next-roof-fusion-legacy-fallback-panel";

describe("Admin Next Roof Fusion legacy fallback panel", () => {
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
  });

  it("shows the old 32 degree calculation and selects it only for review", async () => {
    const onSelectionChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(AdminNextRoofFusionLegacyFallbackPanel, {
          horizontalAreaSquareMeters: 100,
          onSelectionChange,
          selection: null,
        }),
      );
    });

    expect(container.textContent).toContain("117,9 m²");
    expect(container.textContent).toContain(
      "kainodarai automatiškai neperduodamas",
    );
    expect(container.textContent).toContain(
      "Pasirinkimas neišsaugomas ir dingsta perkrovus puslapį",
    );
    const selectButton = container.querySelector<HTMLButtonElement>(
      "[data-roof-fusion-select-legacy-fallback]",
    );
    expect(selectButton?.disabled).toBe(false);
    await act(async () => selectButton!.click());

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        horizontalAreaM2: 100,
        pitchDegrees: 32,
        surfaceAreaM2: 117.918,
        higherAccuracyOverrideConfirmed: false,
      }),
    );
  });

  it("requires explicit confirmation and a reason before overriding an RF result", async () => {
    const onSelectionChange = vi.fn();
    await act(async () => {
      root.render(
        createElement(AdminNextRoofFusionLegacyFallbackPanel, {
          horizontalAreaSquareMeters: 100,
          onSelectionChange,
          protectedResultId: "rf-result-17",
          selection: null,
        }),
      );
    });

    const selectButton = container.querySelector<HTMLButtonElement>(
      "[data-roof-fusion-select-legacy-fallback]",
    );
    expect(selectButton?.disabled).toBe(true);
    const checkbox = container.querySelector<HTMLInputElement>(
      "input[type='checkbox']",
    );
    await act(async () => checkbox!.click());
    expect(selectButton?.disabled).toBe(true);

    const reason = container.querySelector<HTMLTextAreaElement>("textarea");
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(reason, "Aukščio duomenis užstoja medžiai");
      reason!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(selectButton?.disabled).toBe(false);
    await act(async () => selectButton!.click());

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        higherAccuracyOverrideConfirmed: true,
        overrideJustification: "Aukščio duomenis užstoja medžiai",
      }),
    );
  });
});
