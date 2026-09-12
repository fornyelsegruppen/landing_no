import { describe, expect, it } from "vitest";
import { GoogleSearchConsoleProvider, searchConsoleRefreshWindows } from "./google-search-console-provider";

describe("GoogleSearchConsoleProvider", () => {
  it("requires both read-only credentials and the exact property", () => {
    expect(new GoogleSearchConsoleProvider({} as NodeJS.ProcessEnv).health().status).toBe("configuration_required");
    expect(new GoogleSearchConsoleProvider({
      GOOGLE_SEARCH_CONSOLE_CREDENTIALS: JSON.stringify({ client_email: "seo@example.test", private_key: "key" }),
      GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:takfornyelse.as",
    } as unknown as NodeJS.ProcessEnv).health()).toMatchObject({
      status: "ready",
      detail: expect.stringContaining("Configured"),
    });
  });

  it("defines two equal completed windows for refresh and baseline comparison", () => {
    expect(searchConsoleRefreshWindows(new Date("2026-09-12T12:00:00Z"))).toEqual({
      current: { periodStart: "2026-08-13", periodEnd: "2026-09-09" },
      baseline: { periodStart: "2026-07-16", periodEnd: "2026-08-12" },
    });
  });

  it("represents missing rows as no-data rather than synthetic zero popularity", async () => {
    const provider = new GoogleSearchConsoleProvider({} as NodeJS.ProcessEnv);
    await expect(provider.listSignalRefresh(new Date("2026-09-12T12:00:00Z"))).resolves.toEqual({
      current: {
        periodStart: "2026-08-13",
        periodEnd: "2026-09-09",
        status: "no-data",
        signals: [],
      },
      baseline: {
        periodStart: "2026-07-16",
        periodEnd: "2026-08-12",
        status: "no-data",
        signals: [],
      },
      geography: "unknown",
    });
  });
});
