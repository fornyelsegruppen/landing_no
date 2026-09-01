import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNextShell } from "./admin-next-shell";
import { AdminNextToday } from "./admin-next-today";

describe("Admin Next Today preview", () => {
  it("renders one clear next action for every synthetic case", () => {
    const html = renderToStaticMarkup(
      <AdminNextToday locale="lt" view="all" />,
    );

    expect(html).toContain("Mano darbo eilė");
    expect(html.match(/Atidaryti bylą/g)).toHaveLength(4);
    expect(html.match(/Demo · /g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Patikrinti R4 matavimą");
    expect(html).toContain("Dabartinis Admin V2 veikia kaip atsarginis kelias");
  });

  it("keeps the mobile shell free from wide fixed content", () => {
    const html = renderToStaticMarkup(
      <AdminNextShell displayName="Demo Admin" locale="lt">
        <AdminNextToday locale="lt" view="mine" />
      </AdminNextShell>,
    );

    expect(html).toContain("min-w-0");
    expect(html).toContain("grid-cols-4");
    expect(html).toContain("Apsaugota Preview");
    expect(html).toContain("Mano");
  });
});
