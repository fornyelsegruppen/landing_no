import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attach: vi.fn(),
  audit: vi.fn(),
  auth: vi.fn(),
  caseUpdate: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  getPayload: vi.fn(),
  searchAddress: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/payload", () => ({ getPayload: mocks.getPayload }));
vi.mock("@/lib/audit/audit-event", () => ({ recordAuditEvent: mocks.audit }));
vi.mock("@/lib/audit/payload-audit-writer", () => ({
  createPayloadAuditWriter: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/cases/case-command", () => ({
  updateCaseState: mocks.caseUpdate,
}));
vi.mock("@/lib/measurements/persist-evidence", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/measurements/persist-evidence")
    >();
  return { ...actual, attachApprovedRasterMeasurementEvidence: mocks.attach };
});
vi.mock("@/lib/measurements/workflow-mode", () => ({
  measurementWorkflowMode: () => ({
    commercialPackageEnabled: false,
    requireApprovedPriceRule: false,
  }),
}));
vi.mock("@/lib/providers/kartverket-address-provider", () => ({
  KartverketAddressProvider: class KartverketAddressProvider {
    searchAddress = mocks.searchAddress;
  },
  norgeIBilderAccess: vi.fn(),
}));
vi.mock("@/payload/access/roles", () => ({ userIsAdmin: vi.fn(() => true) }));

import { POST } from "./route";

const lead = {
  id: 7,
  inquiryType: "takvask",
  caseRevision: 1,
  address: "Lyngveien",
  houseNumber: "28A",
  postal: "1182",
  city: "OSLO",
};
const trustedAddress = {
  id: "kartverket-7",
  label: "Lyngveien 28A, 1182 OSLO",
  postalCode: "1182",
  city: "OSLO",
  latitude: 59.8964,
  longitude: 10.798,
  source: "Kartverket",
};
const capturedAt = "2026-09-03T10:00:00.000Z";
const captureMedia = {
  id: 91,
  classification: "measurement",
  ownerType: "norge-i-bilder-capture",
  ownerId: "lead-7",
  mimeType: "image/png",
  filename: "norge-i-bilder-screenshot-click-6d5f.png",
  alt: "Norge i bilder screenshot — ©norgeibilder.no",
  createdAt: capturedAt,
};

const body = {
  action: "create",
  leadId: 7,
  address: {
    id: "kartverket-7",
    label: "Lyngveien 28A, 1182 OSLO",
    postalCode: "1182",
    city: "OSLO",
    latitude: 59.8964,
    longitude: 10.798,
    source: "Kartverket",
  },
  proposal: {
    buildingIdentifier: "building-7",
    confidence: "high",
    confidenceReasoning: "A validated roof outline is available for this case.",
    roofPlanes: [
      {
        id: "plane-1",
        polygon: [
          { latitude: 59.8964, longitude: 10.798 },
          { latitude: 59.8964, longitude: 10.7982 },
          { latitude: 59.89655, longitude: 10.7982 },
        ],
        angleMinDegrees: 25,
        angleMaxDegrees: 30,
      },
    ],
  },
  // Deliberately untrusted values: server media metadata must replace them.
  imageryLicensed: false,
  imagerySource: "norge-i-bilder-screenshot",
  imagerySourceUrl: "https://norgeibilder.no/",
  license: "Kartverket written screenshot approval",
  credits: "client-supplied value must not persist",
  mapImageId: 91,
  imageryCapturedAt: "2001-01-01T00:00:00.000Z",
  trainingProhibited: false,
};

describe("POST /api/admin/measurements Norge i bilder capture integration", () => {
  beforeEach(() => {
    mocks.audit.mockReset().mockResolvedValue(undefined);
    mocks.auth.mockReset().mockResolvedValue({
      user: { id: 3, role: "admin", active: true },
    });
    mocks.caseUpdate.mockReset().mockResolvedValue(undefined);
    mocks.create.mockReset().mockResolvedValue({ id: 44 });
    mocks.find
      .mockReset()
      .mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === "price-rules") return { docs: [], totalDocs: 0 };
        if (collection === "roof-measurements") return { docs: [] };
        return { docs: [] };
      });
    mocks.findByID
      .mockReset()
      .mockImplementation(
        async ({ collection, id }: { collection: string; id: number }) => {
          if (collection === "leads" && id === 7) return lead;
          if (collection === "private-media" && id === 91) return captureMedia;
          return null;
        },
      );
    mocks.update.mockReset().mockResolvedValue({ id: 44 });
    mocks.searchAddress.mockReset().mockResolvedValue([trustedAddress]);
    mocks.attach.mockReset().mockResolvedValue({
      measurement: {
        id: 44,
        evidenceSource: "norge-i-bilder-screenshot",
        evidenceAttribution: "©norgeibilder.no",
        imageryCapturedAt: capturedAt,
      },
    });
    mocks.getPayload.mockReset().mockResolvedValue({
      auth: mocks.auth,
      create: mocks.create,
      delete: vi.fn().mockResolvedValue(undefined),
      find: mocks.find,
      findByID: mocks.findByID,
      update: mocks.update,
    });
  });

  it("attaches only the same-case capture and replaces all client provenance", async () => {
    const response = await POST(
      new Request("https://preview.example/api/admin/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(response).toBeDefined();
    expect(response?.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "roof-measurements",
        data: expect.objectContaining({
          mapImage: 91,
          source: "norge-i-bilder-screenshot",
          credits: "©norgeibilder.no",
          imageryLicensed: true,
          imageryCapturedAt: capturedAt,
          normalizedAddress: trustedAddress.label,
          addressSourceId: trustedAddress.id,
          latitude: trustedAddress.latitude,
          longitude: trustedAddress.longitude,
        }),
      }),
    );
    expect(mocks.attach).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedCaseId: "lead-7",
        mapImageId: 91,
        source: "norge-i-bilder-screenshot",
        trainingProhibited: true,
      }),
    );
  });

  it("overrides a malicious client address with the Lead's current Kartverket address", async () => {
    const response = await POST(
      new Request("https://preview.example/api/admin/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...body,
          address: {
            ...body.address,
            id: "other-case-address",
            label: "Storgata 1, 5003 BERGEN",
            postalCode: "5003",
            city: "BERGEN",
            latitude: 60.39299,
            longitude: 5.32415,
          },
        }),
      }),
    );

    expect(response?.status).toBe(201);
    expect(mocks.searchAddress).toHaveBeenCalledWith("Lyngveien 28A 1182 OSLO");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedAddress: trustedAddress.label,
          addressSourceId: trustedAddress.id,
          latitude: trustedAddress.latitude,
          longitude: trustedAddress.longitude,
        }),
      }),
    );
  });

  it("rejects a low-confidence AI proposal before persisting a review version", async () => {
    const response = await POST(
      new Request("https://preview.example/api/admin/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...body,
          proposal: { ...body.proposal, confidence: "low" },
        }),
      }),
    );
    const problem = await response?.json();

    expect(response?.status).toBe(409);
    expect(problem).toMatchObject({
      code: "MEASUREMENT_PROPOSAL_LOW_CONFIDENCE",
      reasons: ["confidence_low"],
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.attach).not.toHaveBeenCalled();
  });
});
