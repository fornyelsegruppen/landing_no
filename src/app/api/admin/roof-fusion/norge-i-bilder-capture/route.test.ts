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
vi.mock("@/lib/audit/audit-event", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit/audit-event")>()),
  recordAuditEvent: mocks.audit,
}));
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

import { prepareAuditEvent } from "@/lib/audit/audit-event";
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
    });
    mocks.searchAddress.mockReset().mockResolvedValue([
      {
        id: "0301-149-181",
        label: "Lyngveien 28A, 1182 OSLO",
        postalCode: "1182",
        city: "OSLO",
        latitude: 59.8964,
        longitude: 10.798,
        source: "Kartverket",
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
    address: {
      id: "KVE:PostalAddress:0301:Lyngveien:28:A",
      label: "Lyngveien 28A, Oslo",
      postalCode: "1182",
      city: "OSLO",
      latitude: 59.896416,
      longitude: 10.797993,
      source: "Kartverket matrikkeladresser per Entur Geocoder v3",
    },
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
        postalCode: "1182",
        city: "OSLO",
        latitude: 59.8964,
        longitude: 10.798,
        source: "Kartverket",
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
    expect(mocks.searchAddress).toHaveBeenCalledWith(body.address.label);
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
    expect(() =>
      prepareAuditEvent(mocks.audit.mock.calls[0]![1]),
    ).not.toThrow();
  });

  it("captures the explicitly selected address instead of the test case address", async () => {
    const selectedAddress = {
      id: "KVE:PostalAddress:0301:Simensbratveien:15",
      label: "Simensbråtveien 15, Oslo",
      postalCode: "1182",
      city: "OSLO",
      latitude: 59.900148,
      longitude: 10.792366,
      source: "Kartverket matrikkeladresser per Entur Geocoder v3",
    };
    mocks.searchAddress.mockResolvedValue([
      {
        id: "0301-200-300-0-0-Simensbråtveien 15",
        label: "Simensbråtveien 15, 1182 OSLO",
        postalCode: "1182",
        city: "OSLO",
        latitude: 59.90015,
        longitude: 10.79236,
        source: "Kartverket",
      },
    ]);

    const response = await POST(request({ ...body, address: selectedAddress }));

    expect(response.status).toBe(201);
    expect(mocks.searchAddress).toHaveBeenCalledWith(selectedAddress.label);
    expect(mocks.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "lead-18",
        target: expect.objectContaining({
          addressLabel: "Simensbråtveien 15, 1182 OSLO",
          latitude: 59.90015,
          longitude: 10.79236,
        }),
      }),
    );
  });

  it("rejects a client-selected address that cannot be verified nearby", async () => {
    const response = await POST(
      request({
        ...body,
        address: {
          ...body.address,
          label: "Annen vei 1, Oslo",
          latitude: 60.1,
          longitude: 11.1,
        },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Selected address could not be verified",
    });
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("does not launch a browser for a missing concrete case", async () => {
    mocks.findByID.mockResolvedValue(null);
    const response = await POST(request(body));

    expect(response.status).toBe(404);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("fails without exposing provider details or returning a false media success", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.capture.mockRejectedValue(
      new Error("private upstream token and blob location"),
    );

    const response = await POST(request(body));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({ error: "Norge i bilder capture failed" });
    expect(JSON.stringify(payload)).not.toContain("private upstream token");
    expect(payload).not.toHaveProperty("imageUrl");
    expect(mocks.audit).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
