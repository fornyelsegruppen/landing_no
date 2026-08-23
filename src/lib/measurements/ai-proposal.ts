import type { AiProvider } from "../providers/contracts";
import { roofProposalJsonSchema, roofProposalSchema } from "./proposal";

export async function generateRoofProposal(input: {
  provider: AiProvider;
  image: { mimeType: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string };
  latitude: number;
  longitude: number;
  correlationId: string;
}) {
  const generated = await input.provider.generate({
    task: "roof.measurement.proposal",
    schemaName: "roof-proposal-v1",
    correlationId: input.correlationId,
    system: "Du er et visuelt kontrollverktøy for takmåling. Foreslå bare bygg, polygonpunkter og et konservativt vinkelintervall. Ikke beregn areal, pris, mva eller løfter. Bruk low confidence hvis takkant, bygg eller vinkel ikke kan vurderes sikkert.",
    prompt: `Vurder det lisensierte ortofotoutsnittet nær koordinat ${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}. Koordinatene er kun et geografisk anker; ingen kundenavn eller full adresse er sendt. Returner strukturert forslag.`,
    schema: roofProposalJsonSchema as unknown as Record<string, unknown>,
    attachments: [input.image],
  });
  return {
    proposal: roofProposalSchema.parse(generated.data),
    provider: generated.provider,
    model: generated.model,
    promptVersion: generated.promptVersion,
  };
}
