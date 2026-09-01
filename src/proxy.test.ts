import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { config } from "./proxy";

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
});
