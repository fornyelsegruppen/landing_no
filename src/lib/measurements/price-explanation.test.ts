import { describe, expect, it } from "vitest";
import { DeterministicAiProvider } from "../providers/safe-providers";
import { calculatePrice } from "./pricing";
import { generatePriceExplanation } from "./price-explanation";

const calculation = calculatePrice(1000, { id: 1, version: 1, serviceKey: "takvask", unitPriceExVatOre: 10000, vatBasisPoints: 2500, minimumExVatOre: 0, toleranceBasisPoints: 1000, status: "approved" });

describe("AI price explanation", () => {
  it("accepts matching locked numbers", async () => {
    const result = await generatePriceExplanation({ provider: new DeterministicAiProvider({ explanation: "Arealet er 100 m². Totalen er 12500 kr inkludert 25 % mva." }), calculation, correlationId: "test", locale: "no" });
    expect(result.explanation).toContain("12500");
  });
  it("rejects invented numbers", async () => {
    await expect(generatePriceExplanation({ provider: new DeterministicAiProvider({ explanation: "Vi kan gjøre dette for totalt 9999 kr inkludert mva." }), calculation, correlationId: "test", locale: "no" })).rejects.toThrow(/do not match/);
  });
});
