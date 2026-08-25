import { afterEach, describe, expect, it, vi } from "vitest";
import { turnstileEnabled, verifyTurnstile } from "./turnstile";

const originalSecret = process.env.TURNSTILE_SECRET_KEY;
const originalSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalSecret;
  if (originalSite === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSite;
});

describe("Turnstile", () => {
  it("is explicitly skipped only when local configuration is absent", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    await expect(verifyTurnstile(null)).resolves.toEqual({ ok: true, skipped: true });
    expect(turnstileEnabled()).toBe(false);
  });

  it("accepts a provider-verified token and sends the minimized IP", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile("valid-test-token", "192.0.2.10"))
      .resolves.toEqual({ ok: true, skipped: false });
    expect(turnstileEnabled()).toBe(true);
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("response")).toBe("valid-test-token");
    expect(body.get("remoteip")).toBe("192.0.2.10");
  });

  it("fails closed for invalid tokens and provider errors", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    await expect(verifyTurnstile("short")).resolves.toEqual({ ok: false, skipped: false });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(verifyTurnstile("valid-test-token")).resolves.toEqual({ ok: false, skipped: false });
  });
});
