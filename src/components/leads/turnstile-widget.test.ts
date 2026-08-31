// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe("TurnstileWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete window.turnstile;
    delete window.onTurnstileLoad;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    vi.resetModules();
  });

  it("resets a consumed token and reports the replacement token", async () => {
    vi.resetModules();
    const callbacks: Array<(token: string) => void> = [];
    const reset = vi.fn();
    window.turnstile = {
      render: vi.fn((_element, options) => {
        if (options.callback) callbacks.push(options.callback);
        return "widget-1";
      }),
      reset,
      remove: vi.fn(),
    };
    const onToken = vi.fn();
    const { TurnstileWidget } = await import("./turnstile-widget");

    await act(async () => {
      root.render(createElement(TurnstileWidget, { onToken, resetKey: 0 }));
    });
    await act(async () => callbacks[0]?.("token-1"));

    await act(async () => {
      root.render(createElement(TurnstileWidget, { onToken, resetKey: 1 }));
    });

    expect(onToken).toHaveBeenCalledWith(null);
    expect(reset).toHaveBeenCalledWith("widget-1");

    await act(async () => callbacks[0]?.("token-2"));
    expect(onToken).toHaveBeenLastCalledWith("token-2");
  });
});
