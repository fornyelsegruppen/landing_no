// @vitest-environment happy-dom

import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNextShell } from "./admin-next-shell";
import { UnifiedAdminNavigation } from "./unified-admin-navigation";

const navigationMock = vi.hoisted(() => ({
  pathname: "/admin-next-preview/cases/TF-1042",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

describe("unified admin shell", () => {
  it("keeps search in its own row until xl and reserves a safe mobile nav offset", () => {
    const html = renderToStaticMarkup(
      AdminNextShell({
        children: createElement("p", null, "Turinys"),
        displayName: "Demo administratorius",
        locale: "lt",
      }),
    );

    expect(html).toContain("data-admin-shell-header");
    expect(html).toContain("data-admin-shell-search-row");
    expect(html).toContain("xl:hidden");
    expect(html).toContain("xl:block");
    expect(html).toContain("--an-mobile-nav-offset");
    expect(html).toContain("data-admin-mobile-navigation");
    expect(html).toContain("pb-[calc(var(--an-mobile-nav-offset)+1rem)]");
  });

  it("keeps the customer-copy language policy in the canonical shell", () => {
    const html = renderToStaticMarkup(
      AdminNextShell({
        children: createElement("p", null, "Content"),
        locale: "en",
        mode: "canonical",
      }),
    );

    expect(html).toContain("data-admin-customer-content-notice");
    expect(html).toContain(
      "The panel language does not change customer copy, quotes or contracts. They remain in Norwegian.",
    );
  });

  it("marks a preview case as Cases while keeping the working fallback href", () => {
    const html = renderToStaticMarkup(
      createElement(UnifiedAdminNavigation, {
        locale: "lt",
        mode: "preview",
      }),
    );

    expect(html).toContain(
      'aria-current="page" class="flex min-h-11 items-center gap-3',
    );
    expect(html).toContain('href="/admin-v2/cases"');
    expect(html).toContain(">Bylos</span>");
  });

  it("uses four direct mobile destinations and a fifth More disclosure", () => {
    const html = renderToStaticMarkup(
      createElement(UnifiedAdminNavigation, {
        locale: "lt",
        mobile: true,
        mode: "preview",
      }),
    );

    expect(html).toContain("grid-cols-5");
    expect(html).toContain("Daugiau");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain(">SEO studija</span>");
  });

  it("exposes the customer-copy policy inside the canonical mobile More dialog", async () => {
    const customerContentNotice =
      "The panel language does not change customer copy, quotes or contracts. They remain in Norwegian.";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(UnifiedAdminNavigation, {
          customerContentNotice,
          locale: "en",
          mobile: true,
          mode: "canonical",
        }),
      );
    });
    const trigger = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "More",
    );
    expect(trigger).toBeDefined();
    await act(async () => trigger?.click());

    expect(
      document.querySelector("[data-admin-mobile-more]")?.textContent,
    ).toContain(customerContentNotice);

    await act(async () => root.unmount());
    container.remove();
  });
});
