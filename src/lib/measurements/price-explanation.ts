import { z } from "zod";
import type { AiProvider } from "../providers/contracts";
import type { PriceCalculation } from "./pricing";
import { verifyAiPriceExplanation } from "./pricing";

const responseSchema = z.object({ explanation: z.string().min(20).max(2_000) });

export async function generatePriceExplanation(input: {
  provider: AiProvider;
  calculation: PriceCalculation;
  correlationId: string;
  locale: "no" | "en";
}) {
  const c = input.calculation;
  const result = await input.provider.generate({
    task: "price.explanation",
    schemaName: "price-explanation-v1",
    correlationId: input.correlationId,
    system: "Forklar kun tallene som er gitt. Ikke regn, rund, endre eller legg til tall, garantier, datoer eller arbeidsomfang.",
    prompt: JSON.stringify({ locale: input.locale, areaSquareMeters: c.quantityTenths / 10, subtotalExVatNok: c.subtotalExVatOre / 100, vatNok: c.vatOre / 100, totalIncVatNok: c.totalIncVatOre / 100, tolerancePercent: c.toleranceBasisPoints / 100, maximumTotalIncVatNok: c.maximumTotalIncVatOre == null ? null : c.maximumTotalIncVatOre / 100 }),
    schema: { type: "object", additionalProperties: false, required: ["explanation"], properties: { explanation: { type: "string" } } },
  });
  const parsed = responseSchema.parse(result.data);
  if (!verifyAiPriceExplanation(parsed.explanation, c)) throw new Error("AI explanation contains numbers that do not match the locked calculation");
  return { ...parsed, provider: result.provider, model: result.model, promptVersion: result.promptVersion };
}
