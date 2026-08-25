import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { protectCaseStateWrites } from "./Leads";

const originalFeatureFlag = process.env.FEATURE_CASE_STATE_ENGINE_V2;

beforeEach(() => {
  process.env.FEATURE_CASE_STATE_ENGINE_V2 = "true";
});

afterEach(() => {
  if (originalFeatureFlag === undefined) delete process.env.FEATURE_CASE_STATE_ENGINE_V2;
  else process.env.FEATURE_CASE_STATE_ENGINE_V2 = originalFeatureFlag;
});

function hook(input: {
  context?: Record<string, unknown>;
  data: Record<string, unknown>;
  payloadAPI: "local" | "REST";
  revision: number;
}) {
  return protectCaseStateWrites({
    context: input.context || {},
    data: input.data,
    operation: "update",
    originalDoc: { caseRevision: input.revision },
    req: { payloadAPI: input.payloadAPI },
  } as never);
}

describe("lead case state write protection", () => {
  it("allows legacy state updates while the revision engine is disabled", () => {
    process.env.FEATURE_CASE_STATE_ENGINE_V2 = "false";
    expect(hook({
      data: { status: "measuring", caseRevision: 4 },
      payloadAPI: "local",
      revision: 4,
    })).toMatchObject({ status: "measuring", caseRevision: 4 });
  });

  it("allows an internal monotonic revision write when serverless context is unavailable", () => {
    expect(hook({
      data: { status: "measuring", caseRevision: 5 },
      payloadAPI: "local",
      revision: 4,
    })).toMatchObject({ status: "measuring", caseRevision: 5 });
  });

  it("rejects the same revision write through REST", () => {
    expect(() => hook({
      data: { status: "measuring", caseRevision: 5 },
      payloadAPI: "REST",
      revision: 4,
    })).toThrow("Case revision is managed by the central case command layer");
  });

  it("rejects a skipped local revision", () => {
    expect(() => hook({
      data: { status: "measuring", caseRevision: 7 },
      payloadAPI: "local",
      revision: 4,
    })).toThrow("Case revision is managed by the central case command layer");
  });

  it("keeps the explicit expected-revision conflict guard", () => {
    expect(() => hook({
      context: { trustedCaseCommand: true, expectedCaseRevision: 3 },
      data: { status: "measuring", caseRevision: 5 },
      payloadAPI: "local",
      revision: 4,
    })).toThrow("CASE_REVISION_CONFLICT:3:4");
  });
});
