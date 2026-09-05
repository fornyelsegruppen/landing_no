import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  auth: vi.fn(),
  capture: vi.fn(),
  findByID: vi.fn(),
  getPayload: vi.fn(),
  searchAddress: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.audit }));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/providers/norge-i-bilder-capture-provider", () => ({
  NorgeIBilderCaptureError: class NorgeIBilderCaptureError extends Error {},
  NorgeIBilderCaptureProvider: class NorgeIBilderCaptureProvider {
    capture = mocks.capture;
  },
}));
vi.mock("@/lib/providers/norge-i-bilder-interactive-url", () => ({
  NorgeIBilderInteractiveUrlBuilder: class NorgeIBilderInteractiveUrlBuilder {},
}));
vi.mock("@/lib/providers/norge-i-bilder-vercel-browser", () => ({
  NorgeIBilderVercelBrowserRuntime: class NorgeIBilderVercelBrowserRuntime {},
}));
vi.mock("@/lib/providers/norge-i-bilder-payload-adapter", () => ({
  PayloadNorgeIBilderFinalImageStore: class PayloadNorgeIBilderFinalImageStore {},
  UpstashNorgeIBilderCaptureLedger: class UpstashNorgeIBilderCaptureLedger {},
}));
vi.mock("@/lib/providers/kartverket-address-provider", () => ({
  KartverketAddressProvider: class KartverketAddressProvider {
    searchAddress = mocks.searchAddress;
  },
}));

import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(
    "https://preview.example/api/admin/roof-fusion/norge-i-bilder-capture",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/admin/roof-fusion/norge-i-bilder-capture", () => {
  beforeEach(() => {
    mocks.audit.mockReset().mockResolvedValue(undefined);
    mocks.auth.mockReset().mockResolvedValue({
      user: { id: 7, role: "admin", active: true },
    });
    mocks.capture.mockReset().mockResolvedValue({
      mediaId: "91",
      capturedAt: "2026-09-02T12:00:00.000Z",
      attribution: "©norgeibilder.no",
      source: "norge-i-bilder-screenshot",
      rawContentHash: "a".repeat(64),
      attempts: 1,
      geoReference: {
        crs: "EPSG:25833",
        extentTrust: "actual-visible-extent",
        bounds: {
          minEastingM: 264951.272,
          minNorthingM: 6647307.668,
          maxEastingM: 265057.054,
          maxNorthingM: 6647359.815,
        },
        imageWidth: 1920,
        imageHeight: 1080,
      },
    });
    mocks.findByID.mockReset().mockResolvedValue({
      id: 18,
      address: "Lyngveien",
      houseNumber: "28A",
      postal: "1182",
      city: "OSLO",
      addressVerificationStatus: "verified",
      addressVerificationProvider: "kartverket-address-rest-v1",
      addressVerificationProviderId: "0301-149-181",
      addressLatitude: 59.8964,
      addressLongitude: 10.798,
      addressVerifiedAt: "2026-09-05T08:00:00.000Z",
    });
    mocks.searchAddress.mockReset().mockResolvedValue([
      {
        id: "0301-149-181",
        label: "Lyngveien 28A, 1182 OSLO",
        streetAddress: "Lyngveien 28A",
        postalCode: "1182",
        latitude: 59.8964,
        longitude: 10.798,
        source:
          "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
      },
    ]);
    mocks.getPayload.mockReset().mockResolvedValue({
      auth: mocks.auth,
      findByID: mocks.findByID,
    });
  });

  const body = {
    leadId: 18,
    clickId: "88b9b81d-3a8d-48de-8e99-e29c9e781807",
  };

  it("requires same-origin browser intent before reading a case or opening Chromium", async () => {
    const response = await POST(
      request(body, {
        origin: "https://other.example",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("authorizes a real lead case and returns only the protected media endpoint", async () => {
    const response = await POST(request(body));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      mediaId: "91",
      evidenceId: "91",
      imageUrl: "/api/admin/media/91",
      source: "norge-i-bilder-screenshot",
      sourceId: "norge-i-bilder:91",
      rawContentHash: "a".repeat(64),
      capturedAt: "2026-09-02T12:00:00.000Z",
      address: {
        id: "0301-149-181",
        label: "Lyngveien 28A, 1182 OSLO",
        streetAddress: "Lyngveien 28A",
        postalCode: "1182",
        city: "OSLO",
        latitude: 59.8964,
        longitude: 10.798,
        source:
          "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
      },
      addressLabel: "Lyngveien 28A, 1182 OSLO",
      attribution: "©norgeibilder.no",
      attempts: 1,
      geoReference: {
        crs: "EPSG:25833",
        extentTrust: "actual-visible-extent",
        bounds: {
          minEastingM: 264951.272,
          minNorthingM: 6647307.668,
          maxEastingM: 265057.054,
          maxNorthingM: 6647359.815,
        },
        imageWidth: 1920,
        imageHeight: 1080,
      },
    });
    expect(mocks.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "leads", id: 18 }),
    );
    expect(mocks.searchAddress).not.toHaveBeenCalled();
    expect(mocks.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "lead-18",
        employeeId: "7",
        clickId: body.clickId,
        viewport: { width: 1920, height: 1080 },
        target: expect.objectContaining({
          latitude: 59.8964,
          longitude: 10.798,
        }),
      }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        entityId: "lead-18",
        action: "norge-i-bilder.captured",
        metadata: expect.objectContaining({
          geoReferenceTrust: "actual-visible-extent",
        }),
      }),
    );
  });

  it("does not launch a browser for a missing concrete case", async () => {
    mocks.findByID.mockResolvedValue(null);
    const response = await POST(request(body));

    expect(response.status).toBe(404);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
