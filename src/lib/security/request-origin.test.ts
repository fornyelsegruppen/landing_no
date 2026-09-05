import { describe, expect, it } from "vitest";
import { evaluateMutationOrigin, isBrowserMutationApi } from "./request-origin";

function request(method: string, headers: Record<string, string> = {}) {
  return new Request(
    "https://takfornyelse-staging.vercel.app/api/admin/leads/1",
    {
      method,
      headers,
    },
  );
}

describe("evaluateMutationOrigin", () => {
  it("allows safe methods", () => {
    expect(
      evaluateMutationOrigin(
        request("GET", { origin: "https://evil.example" }),
      ),
    ).toEqual({
      allowed: true,
      reason: "safe-method",
    });
  });

  it("allows same-origin browser mutations", () => {
    expect(
      evaluateMutationOrigin(
        request("PATCH", {
          origin: "https://takfornyelse-staging.vercel.app",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toEqual({ allowed: true, reason: "same-origin" });
  });

  it("uses the browser Host when the internal request URL differs", () => {
    const proxiedRequest = new Request(
      "http://localhost:3000/api/user/interface-language",
      {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "same-origin",
        },
      },
    );

    expect(evaluateMutationOrigin(proxiedRequest)).toEqual({
      allowed: true,
      reason: "same-origin",
    });
  });

  it("still rejects an origin that does not match the forwarded host", () => {
    const proxiedRequest = new Request(
      "https://internal.example/api/user/interface-language",
      {
        method: "POST",
        headers: {
          host: "preview.example",
          origin: "https://evil.example",
          "sec-fetch-site": "same-site",
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https",
        },
      },
    );

    expect(evaluateMutationOrigin(proxiedRequest)).toEqual({
      allowed: false,
      reason: "origin-mismatch",
    });
  });

  it("rejects ambiguous multiple Host values", () => {
    const proxiedRequest = new Request(
      "http://127.0.0.1:3000/api/user/interface-language",
      {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000, evil.example",
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "same-origin",
        },
      },
    );

    expect(evaluateMutationOrigin(proxiedRequest)).toEqual({
      allowed: false,
      reason: "origin-mismatch",
    });
  });

  it("blocks cross-site and mismatched-origin browser mutations", () => {
    expect(
      evaluateMutationOrigin(
        request("POST", {
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        }),
      ).allowed,
    ).toBe(false);
    expect(
      evaluateMutationOrigin(
        request("DELETE", {
          origin: "https://evil.example",
          "sec-fetch-site": "same-site",
        }),
      ),
    ).toEqual({ allowed: false, reason: "origin-mismatch" });
  });

  it("allows headerless server-to-server mutations", () => {
    expect(evaluateMutationOrigin(request("POST"))).toEqual({
      allowed: true,
      reason: "server-to-server",
    });
  });
});

describe("isBrowserMutationApi", () => {
  it("covers browser APIs without covering providers and scheduled jobs", () => {
    expect(isBrowserMutationApi("/api/admin/quotes/2")).toBe(true);
    expect(isBrowserMutationApi("/api/customer/quote/token")).toBe(true);
    expect(isBrowserMutationApi("/api/worker/work-orders/2")).toBe(true);
    expect(isBrowserMutationApi("/api/webhooks/resend")).toBe(false);
    expect(isBrowserMutationApi("/api/cron/operational-jobs")).toBe(false);
    expect(isBrowserMutationApi("/api/payload/users")).toBe(false);
  });
});
