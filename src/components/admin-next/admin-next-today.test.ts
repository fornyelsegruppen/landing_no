import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNextShell } from "./admin-next-shell";
import { AdminNextToday } from "./admin-next-today";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin-next-preview/today",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

describe("Admin Next Today preview", () => {
  it("renders one clear next action for every synthetic case", () => {
    const html = renderToStaticMarkup(
      createElement(AdminNextToday, { locale: "lt", view: "all" }),
    );

    expect(html).toContain("Mano darbo eilė");
    expect(html.match(/>Atidaryti bylą</g)).toHaveLength(4);
    expect(html.match(/Demo · /g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Patikrinti R4 matavimą");
    expect(html).toContain("Kritinė");
    expect(html).toContain("Suplanuota");
    expect(html).toContain('aria-label="Atidaryti bylą TF-1042: Patikrinti R4 matavimą, Demo · Kari Nilsen"');
    expect(html).toContain("Dabartinis Admin V2 veikia kaip atsarginis kelias");
  });

  it("keeps the mobile shell free from wide fixed content", () => {
    const shellProps = {
      locale: "lt",
      displayName: "Demo Admin",
    } as ComponentProps<typeof AdminNextShell>;
    const html = renderToStaticMarkup(
      createElement(
        AdminNextShell,
        shellProps,
        createElement(AdminNextToday, { locale: "lt", view: "mine" }),
      ),
    );

    expect(html).toContain("min-w-0");
    expect(html).toContain("grid-cols-5");
    expect(html).toContain("Apsaugota Preview");
    expect(html).toContain("Mano");
    expect(html).toContain('href="/admin-v2/cases"');
  });
});
