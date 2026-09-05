// @vitest-environment happy-dom

import {
  act,
  createElement,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdminNextCaseWorkspacePanelSwitcher } from "./admin-next-case-workspace-navigation";

type SwitcherProps = Omit<
  ComponentProps<typeof AdminNextCaseWorkspacePanelSwitcher>,
  "children"
> & { children?: ReactNode };

const TestPanelSwitcher =
  AdminNextCaseWorkspacePanelSwitcher as ComponentType<SwitcherProps>;

describe("Admin Next Case Workspace panel navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(
      null,
      "",
      "/admin-next-preview/cases/TF-13?tab=evidence#case-evidence-title",
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/");
  });

  it("opens Evidence for the canonical RF returnTo query and nested anchor", async () => {
    await act(async () => {
      root.render(
        createElement(
          TestPanelSwitcher,
          {
            labels: {
              "case-customer-record": "Kliento dialogas",
              "case-evidence": "Įrodymai",
              "case-history": "Istorija",
            },
            navigationLabel: "Navigacija byloje",
          },
          createElement("div", null, "Customer"),
          createElement(
            "div",
            null,
            createElement("h2", { id: "case-evidence-title" }, "Evidence"),
          ),
          createElement("div", null, "History"),
        ),
      );
      await Promise.resolve();
    });

    expect(
      container
        .querySelector('[data-case-panel="case-evidence"]')
        ?.hasAttribute("hidden"),
    ).toBe(false);
    expect(
      container
        .querySelector('[data-case-panel="case-customer-record"]')
        ?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      container
        .querySelector('[data-case-context-link="case-evidence"]')
        ?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("preserves tab focus and restores the selected panel with browser Back", async () => {
    await act(async () => {
      root.render(
        createElement(
          TestPanelSwitcher,
          {
            labels: {
              "case-customer-record": "Kliento dialogas",
              "case-evidence": "Įrodymai",
              "case-history": "Istorija",
            },
            navigationLabel: "Navigacija byloje",
          },
          createElement("div", null, "Customer"),
          createElement("div", null, "Evidence"),
          createElement("div", null, "History"),
        ),
      );
      await Promise.resolve();
    });
    const historyTab = container.querySelector(
      '[data-case-context-link="case-history"]',
    ) as HTMLButtonElement;
    historyTab.focus();

    await act(async () => historyTab.click());

    expect(window.location.hash).toBe("#case-history");
    expect(historyTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(historyTab);

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(window.location.hash).toBe("#case-evidence-title");
    expect(
      container
        .querySelector('[data-case-context-link="case-evidence"]')
        ?.getAttribute("aria-selected"),
    ).toBe("true");
  });
});
