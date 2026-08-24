import { describe, expect, it } from "vitest";
import { DeterministicAiProvider } from "@/lib/providers/safe-providers";
import { generateLeadReplyDraft, minimizedLeadContext, sanitizeLeadMessage } from "./lead-ai";

const valid = {
  summary: "Kunden ønsker vurdering av takvask og har oppgitt et omtrentlig areal.",
  serviceCategory: "takvask" as const,
  missingInformation: ["Bilder av takets tilstand"],
  riskFlags: [],
  recommendedNextAction: "request_information" as const,
  subject: "Takk for henvendelsen om takvask",
  replyDraft: "Takk for henvendelsen. For å vurdere riktig neste steg ønsker vi noen bilder av takets tilstand. Vi går gjennom opplysningene og kommer tilbake etter faglig kontroll.",
};

describe("lead AI privacy and quality", () => {
  it("removes direct identifiers before AI context is built", () => {
    expect(sanitizeLeadMessage("Kontakt ola@example.no 99 88 77 66 i 12 Takveien")).not.toMatch(/example|99 88|12 Takveien/);
    expect(minimizedLeadContext({ inquiryType: "takvask", postal: "1182", city: "Oslo", approxSqm: 160, message: "Ring 99 88 77 66", hasAddress: true, photoCount: 2 })).toEqual({
      service: "takvask", postalRegion: "11", city: "Oslo", approximateRoofArea: 160, customerQuestion: "Ring [telefon fjernet]", hasExactAddress: true, photoCount: 2,
    });
  });

  it("accepts safe structured draft and blocks price invention", async () => {
    await expect(generateLeadReplyDraft({ provider: new DeterministicAiProvider(valid), lead: { inquiryType: "takvask", hasAddress: false, photoCount: 0 }, correlationId: "lead-test" })).resolves.toMatchObject({ result: valid });
    await expect(generateLeadReplyDraft({ provider: new DeterministicAiProvider({ ...valid, replyDraft: "Takk for henvendelsen. Vi har sett på opplysningene, og prisen blir 20 000 kr for arbeidet dersom alt går som planlagt." }), lead: { inquiryType: "takvask", hasAddress: false, photoCount: 0 }, correlationId: "lead-test-price" })).rejects.toThrow(/price/);
    await expect(generateLeadReplyDraft({ provider: new DeterministicAiProvider({ ...valid, serviceCategory: "nytt_tak" }), lead: { inquiryType: "takvask", hasAddress: false, photoCount: 0 }, correlationId: "lead-test-service" })).rejects.toThrow(/selected service/);
  });

  it("does not treat roof area or an empty question as required when an exact address is available", async () => {
    const generated = await generateLeadReplyDraft({
      provider: new DeterministicAiProvider({
        ...valid,
        missingInformation: ["approximateRoofArea", "customerQuestion"],
        recommendedNextAction: "request_information",
      }),
      lead: { inquiryType: "takvask", hasAddress: true, photoCount: 0 },
      correlationId: "lead-address-ready",
    });
    expect(generated.result.missingInformation).toEqual([]);
    expect(generated.result.recommendedNextAction).toBe("start_measurement");
  });
});
