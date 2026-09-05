import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { panelLanguagePreferenceCookie } from "@/lib/panel-language-preference";

const mocks = vi.hoisted(() => ({ locale: "nb" }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === panelLanguagePreferenceCookie
        ? { value: mocks.locale }
        : undefined,
  })),
}));

import AdminNextCaseWorkspaceLoading from "./loading";

describe("Admin Next Case route loading state", () => {
  beforeEach(() => {
    mocks.locale = "nb";
  });

  it.each([
    ["nb", "Laster canonical sak"],
    ["lt", "Įkeliama canonical byla"],
    ["en", "Loading canonical case"],
  ])("renders localized pending feedback in %s", async (locale, label) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(await AdminNextCaseWorkspaceLoading());

    expect(html).toContain('data-case-workspace-load-state="pending"');
    expect(html).toContain('role="status"');
    expect(html).toContain(label);
  });
});
