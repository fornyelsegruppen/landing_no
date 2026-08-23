import { describe, expect, it } from "vitest";
import { DeterministicAiProvider } from "../providers/safe-providers";
import { generateRoofProposal } from "./ai-proposal";

describe("AI roof proposal adapter", () => {
  it("returns only validated proposal fields", async () => {
    const provider = new DeterministicAiProvider({
      buildingIdentifier: "building-a", confidence: "low",
      confidenceReasoning: "The ridge is visible but two roof edges are obscured.",
      roofPlanes: [{ id: "a", polygon: [{ latitude: 60, longitude: 10 }, { latitude: 60, longitude: 10.001 }, { latitude: 60.001, longitude: 10 }], angleMinDegrees: 22, angleMaxDegrees: 32 }],
      price: 999999,
    });
    const result = await generateRoofProposal({ provider, image: { mimeType: "image/jpeg", dataBase64: "ZmFrZQ==" }, latitude: 60, longitude: 10, correlationId: "test" });
    expect(result.proposal.confidence).toBe("low");
    expect(result.proposal).not.toHaveProperty("price");
  });
});
