import { describe, expect, it } from "vitest";
import { assertMessageCanDeliver, assertMessageCanQueue } from "./message-policy";

describe("message approval policy", () => {
  it("blocks price text in an AI reply", () => {
    expect(() => assertMessageCanQueue({ category: "ai_reply", aiAssisted: true, subject: "Svar", bodyText: "Dette koster 20 000 kr.", status: "draft" })).toThrow(/price/);
  });

  it("requires explicit approval evidence before delivery", () => {
    expect(() => assertMessageCanDeliver({ category: "ai_reply", subject: "Svar", bodyText: "Trygt utkast", status: "queued" })).toThrow(/approval/);
    expect(assertMessageCanDeliver({ category: "ai_reply", subject: "Svar", bodyText: "Trygt utkast", status: "queued", approvedAt: "2026-08-23T10:00:00.000Z" })).toBe(true);
  });
});
