import { describe, expect, it } from "vitest";
import type { RoofProposal } from "@/lib/measurements/proposal";
import type { AddressCandidate } from "@/lib/providers/contracts";
import {
  buildCreateRequest,
  buildProposalRequest,
} from "./norge-measurement-actions";

const address: AddressCandidate = {
  id: "0301-1-2-0-0-Lyngveien 28A",
  label: "Lyngveien 28A, 1182 OSLO",
  postalCode: "1182",
  city: "OSLO",
  latitude: 59.91137749505985,
  longitude: 10.749403964838672,
  source: "Kartverket Matrikkelen Adresse REST API v1 (© Kartverket)",
};

const proposal: RoofProposal = {
  buildingIdentifier: "way/123",
  confidence: "medium",
  confidenceReasoning: "The roof outline is visible but requires review.",
  roofPlanes: [
    {
      id: "plane-1",
      angleMinDegrees: 22,
      angleMaxDegrees: 27,
      polygon: [
        { latitude: 59.9113, longitude: 10.7493 },
        { latitude: 59.9114, longitude: 10.7493 },
        { latitude: 59.9114, longitude: 10.7495 },
      ],
    },
  ],
};

describe("Norge i bilder measurement request builders", () => {
  it("builds the fixed licensed, inference-only proposal contract", () => {
    expect(buildProposalRequest(13, 91)).toEqual({
      leadId: 13,
      mapImageId: 91,
      source: "norge-i-bilder-screenshot",
      licenseAccepted: true,
      trainingProhibited: true,
      credits: "©norgeibilder.no",
    });
  });

  it("binds create to the trusted capture address and exact attribution", () => {
    expect(buildCreateRequest(13, address, proposal, 91)).toMatchObject({
      action: "create",
      leadId: 13,
      address,
      proposal,
      imageryLicensed: true,
      imagerySource: "norge-i-bilder-screenshot",
      imagerySourceUrl: "https://norgeibilder.no/",
      credits: "©norgeibilder.no",
      mapImageId: 91,
    });
  });
});
