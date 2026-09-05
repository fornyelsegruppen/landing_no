import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 }),
}));
vi.mock("./i18n/routing", () => ({ routing: {} }));

describe("proxy route matching", () => {
  afterEach(() => {
    delete process.env.PUBLIC_HOST_REDIRECTS_ENABLED;
  });

  it("leaves the secure manual-contact page outside locale middleware", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "https://takfornyelse-staging.vercel.app/kontakt/secure-token",
      }),
    ).toBe(false);
  });

  it("continues to localize public marketing pages", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "https://takfornyelse-staging.vercel.app/no/blogg",
      }),
    ).toBe(true);
  });

  it("continues to apply mutation-origin checks to API routes", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "https://takfornyelse-staging.vercel.app/api/customer/contact/secure-token",
      }),
    ).toBe(true);
  });

  it("redirects an old public host to the new canonical apex when enabled", () => {
    process.env.PUBLIC_HOST_REDIRECTS_ENABLED = "true";
    const response = proxy(
      new NextRequest("https://www.takfornyelse.as/no/takvask?utm_source=test"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://takfornyelsenorge.no/no/takvask?utm_source=test",
    );
  });

  it("redirects the new www host to the canonical apex before legacy redirects are enabled", () => {
    const response = proxy(
      new NextRequest("https://www.takfornyelsenorge.no/no?ref=www"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://takfornyelsenorge.no/no?ref=www",
    );
  });

  it("does not redirect old API requests when public redirects are enabled", () => {
    process.env.PUBLIC_HOST_REDIRECTS_ENABLED = "true";
    const response = proxy(
      new NextRequest("https://www.takfornyelse.as/api/webhooks/resend"),
    );

    expect(response.status).not.toBe(308);
    expect(response.headers.get("location")).toBeNull();
  });
});
