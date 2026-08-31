import { describe, expect, it, vi } from "vitest";
import {
  clearUploadTicket,
  createUploadTicketState,
  getOrCreateUploadTicket,
} from "./upload-ticket-coordinator";

describe("upload ticket coordinator", () => {
  it("shares one Turnstile-backed ticket request across concurrent uploads", async () => {
    const state = createUploadTicketState();
    const issue = vi.fn(async () => "ticket-1");
    const afterProofConsumed = vi.fn();

    const [first, second] = await Promise.all([
      getOrCreateUploadTicket(state, issue, afterProofConsumed),
      getOrCreateUploadTicket(state, issue, afterProofConsumed),
    ]);

    expect(first).toBe("ticket-1");
    expect(second).toBe("ticket-1");
    expect(issue).toHaveBeenCalledTimes(1);
    expect(afterProofConsumed).toHaveBeenCalledTimes(1);
  });

  it("reuses the signed ticket without consuming another Turnstile proof", async () => {
    const state = createUploadTicketState();
    const issue = vi.fn(async () => "ticket-1");
    const afterProofConsumed = vi.fn();

    await getOrCreateUploadTicket(state, issue, afterProofConsumed);
    await getOrCreateUploadTicket(state, issue, afterProofConsumed);

    expect(issue).toHaveBeenCalledTimes(1);
    expect(afterProofConsumed).toHaveBeenCalledTimes(1);
  });

  it("refreshes the proof after a failed ticket request and allows a retry", async () => {
    const state = createUploadTicketState();
    const issue = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce("ticket-2");
    const afterProofConsumed = vi.fn();

    await expect(
      getOrCreateUploadTicket(state, issue, afterProofConsumed),
    ).rejects.toThrow("network failure");
    await expect(
      getOrCreateUploadTicket(state, issue, afterProofConsumed),
    ).resolves.toBe("ticket-2");

    expect(issue).toHaveBeenCalledTimes(2);
    expect(afterProofConsumed).toHaveBeenCalledTimes(2);
  });

  it("requests a new ticket after the cached ticket is cleared", async () => {
    const state = createUploadTicketState();
    const issue = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("ticket-1")
      .mockResolvedValueOnce("ticket-2");

    await getOrCreateUploadTicket(state, issue, vi.fn());
    clearUploadTicket(state);

    await expect(getOrCreateUploadTicket(state, issue, vi.fn())).resolves.toBe(
      "ticket-2",
    );
  });
});
