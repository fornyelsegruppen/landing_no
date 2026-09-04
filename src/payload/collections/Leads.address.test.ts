import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { protectPreviewCaseAddressWrites } from "./Leads";

describe("Preview case address write protection", () => {
  beforeEach(() => vi.stubEnv("VERCEL_ENV", "preview"));
  afterEach(() => vi.unstubAllEnvs());

  function hook(input: {
    context?: Record<string, unknown>;
    data: Record<string, unknown>;
    caseRevision?: number;
    addressRevision?: number;
  }) {
    return protectPreviewCaseAddressWrites({
      context: input.context || {},
      data: input.data,
      operation: "update",
      originalDoc: {
        caseRevision: input.caseRevision || 7,
        addressRevision: input.addressRevision || 1,
      },
    } as never);
  }

  it("rejects direct Preview address writes", () => {
    expect(() => hook({ data: { address: "Other gate" } })).toThrow(
      /canonical case address command/u,
    );
  });

  it("rejects direct address revision writes in every environment", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => hook({ data: { addressRevision: 2 } })).toThrow(
      /Address revision is managed/u,
    );
  });

  it("requires exact expected and consecutive case/address revisions", () => {
    const context = {
      trustedCaseAddressCommand: true,
      expectedCaseRevision: 7,
      expectedAddressRevision: 1,
    };
    expect(
      hook({
        context,
        data: {
          address: "Other gate",
          caseRevision: 8,
          addressRevision: 2,
        },
      }),
    ).toMatchObject({ caseRevision: 8, addressRevision: 2 });
    expect(() =>
      hook({
        context: { ...context, expectedAddressRevision: 2 },
        data: {
          address: "Other gate",
          caseRevision: 8,
          addressRevision: 2,
        },
      }),
    ).toThrow("ADDRESS_REVISION_CONFLICT:2:1");
    expect(() =>
      hook({
        context,
        data: {
          address: "Other gate",
          caseRevision: 9,
          addressRevision: 2,
        },
      }),
    ).toThrow(/advance exactly once/u);
  });

  it("does not alter existing Production address behavior", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(hook({ data: { address: "Other gate" } })).toEqual({
      address: "Other gate",
    });
  });
});
