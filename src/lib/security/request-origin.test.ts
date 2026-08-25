import { describe, expect, it } from "vitest";
import { evaluateMutationOrigin, isBrowserMutationApi } from "./request-origin";

function request(method: string, headers: Record<string, string> = {}) {
  return new Request("https://takfornyelse-staging.vercel.app/api/admin/leads/1", {
    method,
    headers,
  });
}

describe("evaluateMutationOrigin", () => {
  it("allows safe methods", () => {
    expect(evaluateMutationOrigin(request("GET", { origin: "https://evil.example" }))).toEqual({
      allowed: true,
      reason: "safe-method",
    });
  });

  it("allows same-origin browser mutations", () => {
    expect(evaluateMutationOrigin(request("PATCH", {
      origin: "https://takfornyelse-staging.vercel.app",
      "sec-fetch-site": "same-origin",
    }))).toEqual({ allowed: true, reason: "same-origin" });
  });

  it("blocks cross-site and mismatched-origin browser mutations", () => {
    expect(evaluateMutationOrigin(request("POST", {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    })).allowed).toBe(false);
    expect(evaluateMutationOrigin(request("DELETE", {
      origin: "https://evil.example",
      "sec-fetch-site": "same-site",
    }))).toEqual({ allowed: false, reason: "origin-mismatch" });
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
