import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  captureException: vi.fn(),
  getPayload: vi.fn(),
  paused: vi.fn(),
  processJobs: vi.fn(),
  recordProbe: vi.fn(),
  scanInvariants: vi.fn(),
}));

vi.mock("@/lib/security/cron-auth", () => ({
  cronRequestAuthorized: mocks.authorized,
}));
vi.mock("@/lib/monitoring", () => ({
  captureException: mocks.captureException,
}));
vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/platform/operating-mode", () => ({
  automaticCommunicationIsPaused: mocks.paused,
}));
vi.mock("@/lib/jobs/operational-job-processor", () => ({
  processOperationalJobs: mocks.processJobs,
}));
vi.mock("@/lib/cases/payload-invariant-scanner", () => ({
  scanCaseInvariants: mocks.scanInvariants,
}));
vi.mock("@/lib/jobs/preview-prod8-4-uat", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/jobs/preview-prod8-4-uat")>();
  return { ...actual, recordProd84NoSendProbe: mocks.recordProbe };
});

import { GET } from "./route";

const validProbe = "prod84_20260829_A1b2C3";

function request(query = "", probe?: string) {
  return new Request(
    `https://preview.example.test/api/cron/operational-jobs${query}`,
    probe ? { headers: { "x-preview-uat-probe": probe } } : undefined,
  );
}

describe("operational jobs cron route", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.authorized.mockReset().mockReturnValue(true);
    mocks.captureException.mockReset();
    mocks.getPayload.mockReset().mockResolvedValue({ marker: "payload" });
    mocks.paused.mockReset().mockReturnValue(true);
    mocks.processJobs.mockReset().mockResolvedValue({
      completed: [],
      attention: [],
      retried: [],
      cancelled: [],
      paused: [],
      rescued: [],
    });
    mocks.recordProbe.mockReset().mockResolvedValue({
      duplicate: false,
      probeId: 41,
    });
    mocks.scanInvariants.mockReset().mockResolvedValue({
      cases: 2,
      created: 0,
      issues: 0,
      resolved: 0,
      byCode: {},
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated requests before any UAT or database work", async () => {
    mocks.authorized.mockReturnValue(false);

    const response = await GET(request("?uat=prod8-4-no-send", validProbe));

    expect(response.status).toBe(401);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.processJobs).not.toHaveBeenCalled();
    expect(mocks.scanInvariants).not.toHaveBeenCalled();
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });

  it("returns 404 for the UAT mode outside Preview before loading Payload", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const response = await GET(request("?uat=prod8-4-no-send", validProbe));

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.processJobs).not.toHaveBeenCalled();
    expect(mocks.scanInvariants).not.toHaveBeenCalled();
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });

  it("requires the Preview automation pause before UAT database work", async () => {
    mocks.paused.mockReturnValue(false);

    const response = await GET(request("?uat=prod8-4-no-send", validProbe));

    expect(response.status).toBe(409);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.processJobs).not.toHaveBeenCalled();
    expect(mocks.scanInvariants).not.toHaveBeenCalled();
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });

  it("rejects unknown or malformed UAT modes without falling through to cron", async () => {
    const unknown = await GET(request("?uat=unknown-mode"));
    const empty = await GET(request("?uat="));
    const invalidProbe = await GET(request("?uat=prod8-4-no-send", "short"));

    expect(unknown.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(invalidProbe.status).toBe(400);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.processJobs).not.toHaveBeenCalled();
    expect(mocks.scanInvariants).not.toHaveBeenCalled();
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });

  it("hides every UAT mode behind 404 outside Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const unknown = await GET(request("?uat=unknown-mode", validProbe));
    const empty = await GET(request("?uat=", validProbe));

    expect(unknown.status).toBe(404);
    expect(empty.status).toBe(404);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.processJobs).not.toHaveBeenCalled();
    expect(mocks.scanInvariants).not.toHaveBeenCalled();
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });

  it("does not accept a probe in the query string where access logs can retain it", async () => {
    const response = await GET(
      request(`?uat=prod8-4-no-send&probe=${validProbe}`),
    );

    expect(response.status).toBe(400);
    expect(mocks.getPayload).not.toHaveBeenCalled();
    expect(mocks.processJobs).not.toHaveBeenCalled();
    expect(mocks.scanInvariants).not.toHaveBeenCalled();
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });

  it("runs only the read-only invariant scan and no-send marker in Preview UAT", async () => {
    mocks.processJobs.mockImplementation(() => {
      throw new Error("processor must not be reachable from no-send UAT");
    });

    const response = await GET(request("?uat=prod8-4-no-send", validProbe));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      ok: true,
      duplicate: false,
      probeId: 41,
      invariants: {
        cases: 2,
        created: 0,
        issues: 0,
        resolved: 0,
        byCode: {},
      },
    });
    expect(mocks.getPayload).toHaveBeenCalledTimes(1);
    expect(mocks.scanInvariants).toHaveBeenCalledWith(
      { marker: "payload" },
      { persist: false },
    );
    expect(mocks.recordProbe).toHaveBeenCalledWith(
      { marker: "payload" },
      validProbe,
    );
    expect(mocks.processJobs).not.toHaveBeenCalled();
  });

  it("keeps the normal cron path unchanged when no UAT parameter is present", async () => {
    const response = await GET(request("?limit=3"));

    expect(response.status).toBe(200);
    expect(mocks.processJobs).toHaveBeenCalledWith(
      { marker: "payload" },
      { rescueStale: true, limit: 3 },
    );
    expect(mocks.scanInvariants).toHaveBeenCalledWith(
      { marker: "payload" },
      { persist: true },
    );
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });
});
