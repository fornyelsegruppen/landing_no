import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readPrivateMediaContent: vi.fn() }));

vi.mock("@/lib/private-media-content", () => ({
  readPrivateMediaContent: mocks.readPrivateMediaContent,
}));

import {
  attachApprovedRasterMeasurementEvidence,
  persistSchematicMeasurementEvidence,
  verifyMeasurementEvidence,
  verifySchematicMeasurementEvidence,
} from "./persist-evidence";
import { FakeMapEvidenceProvider } from "./schematic-evidence";

describe("persist schematic measurement evidence", () => {
  it("stores private immutable evidence and links its hash to the measurement", async () => {
    const create = vi.fn().mockResolvedValue({ id: 91, filename: "proof.svg" });
    const update = vi.fn().mockResolvedValue({ id: 12, evidenceSnapshot: 91 });
    const provider = new FakeMapEvidenceProvider({
      bytes: Buffer.from("<svg/>", "utf8"),
      filename: "proof.svg",
      hash: "a".repeat(64),
      mimeType: "image/svg+xml",
      snapshot: {
        schemaVersion: 2,
        address: "Test",
        addressPoint: { latitude: 60, longitude: 10 },
        candidates: [
          {
            id: "way/1",
            label: "House",
            polygon: [
              { latitude: 60, longitude: 10 },
              { latitude: 60.1, longitude: 10 },
              { latitude: 60, longitude: 10.1 },
            ],
          },
        ],
        selectedBuildingId: "way/1",
        source: "OSM",
        attribution: "© OSM",
        generatedAt: "2026-08-25T12:00:00.000Z",
      },
    });
    const result = await persistSchematicMeasurementEvidence({
      payload: { create, update } as never,
      provider,
      leadId: 7,
      measurementId: 12,
      address: "Test",
      addressPoint: { latitude: 60, longitude: 10 },
      candidates: [],
      selectedBuildingId: "way/1",
      source: "OSM",
      attribution: "© OSM",
      generatedAt: new Date("2026-08-25T12:00:00.000Z"),
    });
    expect(result.evidence.hash).toBe("a".repeat(64));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "private-media",
        data: expect.objectContaining({
          classification: "measurement",
          ownerId: "12",
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "roof-measurements",
        id: 12,
        data: expect.objectContaining({
          evidenceHash: "a".repeat(64),
          evidenceSnapshot: 91,
          measurementMode: "schematic",
        }),
      }),
    );
  });
});

describe("schematic measurement evidence verification", () => {
  beforeEach(() => {
    mocks.readPrivateMediaContent.mockReset();
  });

  it("returns false for a hash mismatch without repeating the media read", async () => {
    const stored = Buffer.from("stored-evidence");
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        filename: "roof-evidence.svg",
        mimeType: "image/svg+xml",
      }),
    };
    mocks.readPrivateMediaContent.mockResolvedValue({
      contentType: "image/svg+xml",
      data: Buffer.from("different-evidence"),
      filename: "roof-evidence.svg",
    });

    await expect(
      verifySchematicMeasurementEvidence(payload as never, {
        evidenceHash: createHash("sha256").update(stored).digest("hex"),
        evidenceSnapshot: 53,
      }),
    ).resolves.toBe(false);
    expect(mocks.readPrivateMediaContent).toHaveBeenCalledTimes(1);
  });

  it("attaches approved Norge i bilder raster evidence without duplicating media", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=",
      "base64",
    );
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 71,
        classification: "measurement",
        ownerType: "norge-i-bilder-capture",
        ownerId: "lead-7",
        mimeType: "image/png",
        filename: "norge-i-bilder-screenshot-click-1.png",
        alt: "Norge i bilder screenshot — ©norgeibilder.no",
        createdAt: "2026-09-02T10:00:00.000Z",
      }),
      update: vi.fn().mockResolvedValue({ id: 12, evidenceSnapshot: 71 }),
    };
    mocks.readPrivateMediaContent.mockResolvedValue({
      contentType: "image/png",
      data: png,
      filename: "norge.png",
    });

    const result = await attachApprovedRasterMeasurementEvidence({
      payload: payload as never,
      measurementId: 12,
      expectedCaseId: "lead-7",
      mapImageId: 71,
      source: "norge-i-bilder-screenshot",
      trainingProhibited: true,
    });

    expect(result.evidenceHash).toBe(
      createHash("sha256").update(png).digest("hex"),
    );
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "roof-measurements",
        id: 12,
        data: expect.objectContaining({
          evidenceSnapshot: 71,
          evidenceSource: "norge-i-bilder-screenshot",
          evidenceAttribution: "©norgeibilder.no",
          imageryCapturedAt: "2026-09-02T10:00:00.000Z",
          measurementMode: "schematic_with_context",
        }),
      }),
    );
  });

  it("rejects attaching a screenshot stored for another case", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=",
      "base64",
    );
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 72,
        classification: "measurement",
        ownerType: "norge-i-bilder-capture",
        ownerId: "lead-999",
        mimeType: "image/png",
        filename: "norge-i-bilder-screenshot-click-2.png",
        alt: "Norge i bilder screenshot — ©norgeibilder.no",
        createdAt: "2026-09-02T10:00:00.000Z",
      }),
    };
    mocks.readPrivateMediaContent.mockResolvedValue({
      contentType: "image/png",
      data: png,
      filename: "other-case.png",
    });

    await expect(
      attachApprovedRasterMeasurementEvidence({
        payload: payload as never,
        measurementId: 12,
        expectedCaseId: "lead-7",
        mapImageId: 72,
        source: "norge-i-bilder-screenshot",
        trainingProhibited: true,
      }),
    ).rejects.toThrow(/case-bound/i);
  });

  it("rejects measurement media that was not created by the capture lane", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 73,
        classification: "measurement",
        ownerType: "case",
        ownerId: "lead-7",
        mimeType: "image/png",
        filename: "norge-i-bilder-screenshot-click-3.png",
        alt: "Norge i bilder screenshot — ©norgeibilder.no",
        createdAt: "2026-09-02T10:00:00.000Z",
      }),
    };

    await expect(
      attachApprovedRasterMeasurementEvidence({
        payload: payload as never,
        measurementId: 12,
        expectedCaseId: "lead-7",
        mapImageId: 73,
        source: "norge-i-bilder-screenshot",
        trainingProhibited: true,
      }),
    ).rejects.toThrow(/case-bound/i);
  });

  it("fails closed when a capture file lacks a valid creation timestamp", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 74,
        classification: "measurement",
        ownerType: "norge-i-bilder-capture",
        ownerId: "lead-7",
        mimeType: "image/png",
        filename: "norge-i-bilder-screenshot-click-4.png",
        alt: "Norge i bilder screenshot — ©norgeibilder.no",
      }),
    };

    await expect(
      attachApprovedRasterMeasurementEvidence({
        payload: payload as never,
        measurementId: 12,
        expectedCaseId: "lead-7",
        mapImageId: 74,
        source: "norge-i-bilder-screenshot",
        trainingProhibited: true,
      }),
    ).rejects.toThrow(/createdAt timestamp/i);
    expect(mocks.readPrivateMediaContent).not.toHaveBeenCalled();
  });

  it("fails closed when approved screenshot attribution is missing or wrong", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=",
      "base64",
    );
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 91,
        filename: "norge.png",
        mimeType: "image/png",
        classification: "measurement",
      }),
    };
    mocks.readPrivateMediaContent.mockResolvedValue({
      contentType: "image/png",
      data: png,
      filename: "norge.png",
    });

    await expect(
      verifyMeasurementEvidence(payload as never, {
        evidenceHash: createHash("sha256").update(png).digest("hex"),
        evidenceSnapshot: 91,
        evidenceSource: "norge-i-bilder-screenshot",
        evidenceAttribution: "© Kartverket",
        imageryCapturedAt: "2026-09-02T10:00:00.000Z",
      }),
    ).resolves.toBe(false);
    expect(mocks.readPrivateMediaContent).not.toHaveBeenCalled();
  });

  it("does not verify a screenshot hash when media ownership belongs to another lead", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=",
      "base64",
    );
    const payload = {
      findByID: vi.fn().mockResolvedValue({
        id: 92,
        classification: "measurement",
        ownerType: "norge-i-bilder-capture",
        ownerId: "lead-8",
        mimeType: "image/png",
        filename: "norge-i-bilder-screenshot-click-8.png",
        alt: "Norge i bilder screenshot — ©norgeibilder.no",
        createdAt: "2026-09-03T10:00:00.000Z",
      }),
    };

    await expect(
      verifyMeasurementEvidence(payload as never, {
        lead: 7,
        evidenceHash: createHash("sha256").update(png).digest("hex"),
        evidenceSnapshot: 92,
        evidenceSource: "norge-i-bilder-screenshot",
        evidenceAttribution: "©norgeibilder.no",
        imageryCapturedAt: "2026-09-03T10:00:00.000Z",
      }),
    ).resolves.toBe(false);
    expect(mocks.readPrivateMediaContent).not.toHaveBeenCalled();
  });
});
