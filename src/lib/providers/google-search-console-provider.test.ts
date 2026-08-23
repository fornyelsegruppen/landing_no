import { describe, expect, it } from "vitest";
import { GoogleSearchConsoleProvider } from "./google-search-console-provider";

describe("GoogleSearchConsoleProvider", () => {
  it("requires both read-only credentials and the exact property", () => {
    expect(new GoogleSearchConsoleProvider({} as NodeJS.ProcessEnv).health().status).toBe("configuration_required");
    expect(new GoogleSearchConsoleProvider({
      GOOGLE_SEARCH_CONSOLE_CREDENTIALS: JSON.stringify({ client_email: "seo@example.test", private_key: "key" }),
      GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:takfornyelse.as",
    } as unknown as NodeJS.ProcessEnv).health().status).toBe("ready");
  });
});
