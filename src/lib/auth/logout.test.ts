import { describe, expect, it, vi } from "vitest";
import { performLogout } from "./logout";

describe("worker logout", () => {
  it("invalidates the Payload session and always returns to login", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    const navigate = vi.fn();

    await performLogout(fetcher, navigate);

    expect(fetcher).toHaveBeenCalledWith("/api/users/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    expect(navigate).toHaveBeenCalledWith("/user/login");
  });

  it("still leaves the protected screen when the network response fails", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });
    const navigate = vi.fn();

    await expect(performLogout(fetcher, navigate)).rejects.toThrow("offline");
    expect(navigate).toHaveBeenCalledWith("/user/login");
  });
});
