import { describe, expect, it } from "vitest";
import {
  interpretAdminActionNetworkFailure,
  interpretAdminActionResult,
} from "./action-result";

const base = {
  fallbackError: "Failed",
  queuedMessage: "Saved and queued",
  staleMessage: "Changed. Refreshing.",
  successMessage: "Completed",
};

describe("admin action result", () => {
  it("names the document after success", () => {
    expect(
      interpretAdminActionResult({
        ...base,
        ok: true,
        reference: "K-15-V2",
        result: {},
      }),
    ).toEqual({ kind: "success", message: "Completed K-15-V2", refresh: true });
  });

  it("distinguishes a safely queued notification from a failure", () => {
    expect(
      interpretAdminActionResult({
        ...base,
        ok: true,
        result: { notification: "queued" },
      }),
    ).toMatchObject({ kind: "queued", refresh: true });
  });

  it("refreshes stale commercial context", () => {
    expect(
      interpretAdminActionResult({
        ...base,
        ok: false,
        result: {
          code: "STALE_COMMERCIAL_CONTEXT",
          currentReference: "T-15-V3",
        },
      }),
    ).toEqual({
      kind: "stale",
      message: "Changed. Refreshing. T-15-V3",
      refresh: true,
    });
  });

  it("keeps a normal server error visible without claiming success", () => {
    expect(
      interpretAdminActionResult({
        ...base,
        ok: false,
        result: { error: "Server rejected" },
      }),
    ).toEqual({ kind: "error", message: "Server rejected", refresh: false });
  });

  it("turns temporary measurement evidence failure into actionable localized feedback", () => {
    expect(
      interpretAdminActionResult({
        ...base,
        measurementEvidenceUnavailableMessage:
          "Measurement evidence is temporarily unavailable. Check the evidence and retry.",
        ok: false,
        result: {
          code: "MEASUREMENT_EVIDENCE_TEMPORARILY_UNAVAILABLE",
          error: "Failed to read blob",
        },
      }),
    ).toEqual({
      kind: "error",
      message:
        "Measurement evidence is temporarily unavailable. Check the evidence and retry.",
      refresh: false,
    });
  });

  it("never exposes a browser Failed to fetch message", () => {
    expect(
      interpretAdminActionNetworkFailure(new TypeError("Failed to fetch"), {
        networkMessage:
          "Could not reach the server. Check the case before retrying.",
        timeoutMessage: "The request took too long.",
      }),
    ).toEqual({
      kind: "error",
      message: "Could not reach the server. Check the case before retrying.",
      refresh: false,
    });
  });
});
