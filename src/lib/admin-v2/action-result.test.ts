import { describe, expect, it } from "vitest";
import { interpretAdminActionResult } from "./action-result";

const base = {
  fallbackError: "Failed",
  queuedMessage: "Saved and queued",
  staleMessage: "Changed. Refreshing.",
  successMessage: "Completed",
};

describe("admin action result", () => {
  it("names the document after success", () => {
    expect(interpretAdminActionResult({ ...base, ok: true, reference: "K-15-V2", result: {} })).toEqual({ kind: "success", message: "Completed K-15-V2", refresh: true });
  });

  it("distinguishes a safely queued notification from a failure", () => {
    expect(interpretAdminActionResult({ ...base, ok: true, result: { notification: "queued" } })).toMatchObject({ kind: "queued", refresh: true });
  });

  it("refreshes stale commercial context", () => {
    expect(interpretAdminActionResult({ ...base, ok: false, result: { code: "STALE_COMMERCIAL_CONTEXT", currentReference: "T-15-V3" } })).toEqual({ kind: "stale", message: "Changed. Refreshing. T-15-V3", refresh: true });
  });

  it("keeps a normal server error visible without claiming success", () => {
    expect(interpretAdminActionResult({ ...base, ok: false, result: { error: "Server rejected" } })).toEqual({ kind: "error", message: "Server rejected", refresh: false });
  });
});
