import { z } from "zod";
import type { AiProvider } from "@/lib/providers/contracts";

export const leadAiSchema = z.object({
  summary: z.string().trim().min(20).max(700),
  serviceCategory: z.enum(["takvask", "takvask_impregnering", "impregnering", "takmaling", "nytt_tak", "usikker"]),
  missingInformation: z.array(z.string().trim().min(3).max(180)).max(8),
  riskFlags: z.array(z.string().trim().min(3).max(180)).max(8),
  recommendedNextAction: z.enum(["request_information", "start_measurement", "manual_review"]),
  subject: z.string().trim().min(5).max(140),
  replyDraft: z.string().trim().min(80).max(3_000),
});

export type LeadAiResult = z.infer<typeof leadAiSchema>;

export const leadAiJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    serviceCategory: { type: "string", enum: ["takvask", "takvask_impregnering", "impregnering", "takmaling", "nytt_tak", "usikker"] },
    missingInformation: { type: "array", items: { type: "string" } },
    riskFlags: { type: "array", items: { type: "string" } },
    recommendedNextAction: { type: "string", enum: ["request_information", "start_measurement", "manual_review"] },
    subject: { type: "string" },
    replyDraft: { type: "string" },
  },
  required: ["summary", "serviceCategory", "missingInformation", "riskFlags", "recommendedNextAction", "subject", "replyDraft"],
} as const;

export type LeadForAi = {
  inquiryType: string;
  postal?: string | null;
  city?: string | null;
  approxSqm?: number | null;
  message?: string | null;
  hasAddress: boolean;
  photoCount: number;
};

export function sanitizeLeadMessage(value: string | null | undefined) {
  return (value || "")
    .replace(/\b(?:jeg heter|mitt navn er)\s+[A-Za-zÆØÅæøå-]+(?:\s+[A-Za-zÆØÅæøå-]+)?/gi, "[navn fjernet]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-post fjernet]")
    .replace(/(?:\+?47)?[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}/g, " [telefon fjernet]")
    .replace(/\b\d{1,4}\s+[A-Za-zÆØÅæøå][A-Za-zÆØÅæøå-]+(?:veien|gata|gate|vei)\b/gi, "[adresse fjernet]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_500);
}

export function minimizedLeadContext(lead: LeadForAi) {
  return {
    service: lead.inquiryType,
    postalRegion: lead.postal?.slice(0, 2) || null,
    city: lead.city?.slice(0, 80) || null,
    approximateRoofArea: lead.approxSqm || null,
    customerQuestion: sanitizeLeadMessage(lead.message),
    hasExactAddress: lead.hasAddress,
    photoCount: lead.photoCount,
  };
}

function assertSafeDraft(result: LeadAiResult) {
  const text = `${result.subject}\n${result.replyDraft}`;
  if (/\b\d[\d ]*(?:kr|nok)|kr\s*\/\s*m[²2]/i.test(text)) throw new TypeError("AI reply may not contain a price");
  if (/\bgaranterer\b|\b\d+\s*års?\s+garanti\b/i.test(text)) throw new TypeError("AI reply may not contain a guarantee");
  if (/\bvi (?:kommer|starter) (?:mandag|tirsdag|onsdag|torsdag|fredag|i morgen|den )/i.test(text)) throw new TypeError("AI reply may not promise a start date");
}

export async function generateLeadReplyDraft(input: {
  provider: AiProvider;
  lead: LeadForAi;
  correlationId: string;
}) {
  const context = minimizedLeadContext(input.lead);
  const generated = await input.provider.generate({
    task: "lead.reply.draft",
    schemaName: "lead-reply-nb-v1",
    schema: leadAiJsonSchema as unknown as Record<string, unknown>,
    correlationId: input.correlationId,
    system: [
      "Du lager bare et internt norsk svarutkast for Takfornyelse.",
      "Vær profesjonell, varm og konkret for norske boligeiere over 30 år.",
      "Ikke oppgi pris, garanti, bindende vurdering, oppstartsdato eller lovnader.",
      "Ikke anta fakta som ikke finnes i den minimerte konteksten.",
      "Når hasExactAddress er true, er approximateRoofArea valgfritt og skal ikke registreres som manglende; anbefal start_measurement dersom det ikke finnes et reelt risikoflagg.",
      "Et tomt customerQuestion-felt er ikke manglende informasjon.",
      "Be bare om informasjon som faktisk mangler. Administrator må godkjenne før utsending.",
    ].join("\n"),
    prompt: `Analyser denne anonymiserte henvendelsen og lag strukturert svarutkast:\n${JSON.stringify(context)}`,
  });
  const parsed = leadAiSchema.parse(generated.data);
  const result = input.lead.hasAddress && input.lead.inquiryType !== "usikker" && parsed.riskFlags.length === 0
    ? {
        ...parsed,
        missingInformation: parsed.missingInformation.filter((item) =>
          !/(?:approximate.?roof.?area|takareal|roof.?size|customer.?question)/i.test(item)),
        recommendedNextAction: "start_measurement" as const,
      }
    : parsed;
  if (input.lead.inquiryType !== "usikker" && result.serviceCategory !== input.lead.inquiryType) {
    throw new TypeError("AI reply changed the customer-selected service");
  }
  assertSafeDraft(result);
  return { result, model: generated.model, promptVersion: generated.promptVersion, context };
}
