import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 }),
}));
vi.mock("./i18n/routing", () => ({ routing: {} }));

describe("proxy route matching", () => {
  it("leaves the secure manual-contact page outside locale middleware", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "https://takfornyelse-staging.vercel.app/kontakt/secure-token",
      }),
    ).toBe(false);
  });

  it("leaves the protected Admin Next worker preview outside locale middleware", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "https://takfornyelse-staging.vercel.app/worker-next-preview/visits/A-K-8-V1",
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

  it("allows a same-origin API mutation behind a host-normalizing proxy", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/api/user/interface-language", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "same-origin",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("blocks a mismatched browser origin behind a proxy", async () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/api/user/interface-language", {
        method: "POST",
        headers: {
          host: "preview.example",
          origin: "https://evil.example",
          "sec-fetch-site": "same-site",
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Cross-site request blocked",
    });
  });
});
