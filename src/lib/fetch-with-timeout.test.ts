import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, RequestTimeoutError } from "./fetch-with-timeout";

describe("fetchWithTimeout", () => {
  it("returns a response and forwards the request", async () => {
    const response = new Response(JSON.stringify({ ok: true }));
    const fetchImplementation = vi.fn().mockResolvedValue(response);

    await expect(
      fetchWithTimeout(
        "/api/test",
        { method: "POST" },
        100,
        fetchImplementation,
      ),
    ).resolves.toBe(response);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("aborts a stalled request and reports a timeout", async () => {
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchWithTimeout("/api/test", {}, 5, fetchImplementation),
    ).rejects.toEqual(new RequestTimeoutError(5));
  });
});
