import { z } from "zod";
import { sanitizeLeadMessage } from "@/lib/leads/lead-ai";
import type { AiProvider } from "@/lib/providers/contracts";

export const customerReplyPurposes = [
  "question",
  "decline",
  "cancellation",
] as const;
export type CustomerReplyPurpose = (typeof customerReplyPurposes)[number];

export const customerReplySchema = z.object({
  subject: z.string().trim().min(5).max(160),
  replyDraft: z.string().trim().min(60).max(3_000),
  summary: z.string().trim().min(10).max(500),
  intent: z.enum(["question", "decline", "cancellation", "other"]),
  factWarnings: z.array(z.string().trim().min(3).max(180)).max(8),
  recommendedAdminAction: z.enum([
    "review_and_reply",
    "prepare_revised_quote",
    "call_customer",
    "legal_review",
  ]),
});

export type CustomerReplyResult = z.infer<typeof customerReplySchema>;

export const customerReplyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    replyDraft: { type: "string" },
    summary: { type: "string" },
    intent: {
      type: "string",
      enum: ["question", "decline", "cancellation", "other"],
    },
    factWarnings: { type: "array", items: { type: "string" } },
    recommendedAdminAction: {
      type: "string",
      enum: [
        "review_and_reply",
        "prepare_revised_quote",
        "call_customer",
        "legal_review",
      ],
    },
  },
  required: [
    "subject",
    "replyDraft",
    "summary",
    "intent",
    "factWarnings",
    "recommendedAdminAction",
  ],
} as const;

export const customerReplyContextSchema = z.object({
  purpose: z.enum(customerReplyPurposes),
  customerMessage: z.string().max(2_000),
  service: z.string().optional(),
  measurement: z
    .object({
      reference: z.string(),
      areaMinTenths: z.number().int().positive(),
      areaMaxTenths: z.number().int().positive(),
    })
    .optional(),
  quote: z
    .object({
      reference: z.string(),
      status: z.string(),
      totalIncVatOre: z.number().int().nonnegative(),
      maximumTotalIncVatOre: z.number().int().nonnegative().optional(),
      validUntil: z.string().optional(),
      version: z.number().int().positive().optional(),
      serviceDescription: z.string().optional(),
      termsVersion: z.string().optional(),
    })
    .optional(),
  contract: z
    .object({
      reference: z.string(),
      status: z.string(),
      companySigned: z.boolean(),
      version: z.number().int().positive().optional(),
      termsVersion: z.string().optional(),
    })
    .optional(),
  workOrder: z
    .object({
      reference: z.string(),
      status: z.string(),
      scheduledAt: z.string().optional(),
      arrivalWindow: z.string().optional(),
    })
    .optional(),
  businessSources: z
    .object({
      retrievedAt: z.string(),
      caseTerms: z
        .object({
          version: z.string(),
          text: z.string(),
          withdrawalInstructions: z.string(),
        })
        .optional(),
      activeTerms: z
        .object({
          version: z.string(),
          title: z.string(),
          text: z.string(),
          withdrawalInstructions: z.string(),
        })
        .optional(),
      services: z.array(
        z.object({
          id: z.number().int().positive(),
          key: z.string(),
          title: z.string(),
          description: z.string(),
          updatedAt: z.string().optional(),
        }),
      ),
      priceRules: z.array(
        z.object({
          id: z.number().int().positive(),
          reference: z.string(),
          serviceKey: z.string(),
          termsVersion: z.string(),
          unitPriceExVatOre: z.number().int().nonnegative(),
          validFrom: z.string(),
          validTo: z.string().optional(),
          version: z.number().int().positive(),
        }),
      ),
    })
    .optional(),
});

export type CustomerReplyContext = z.infer<typeof customerReplyContextSchema>;

export function customerReplyContextFromAnalysis(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const parsed = customerReplyContextSchema.safeParse(
    (value as Record<string, unknown>).replyFactContext,
  );
  return parsed.success ? parsed.data : null;
}

function norwegianNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact.split(".").length > 2 || /\.\d{3}$/.test(compact)
      ? compact.replace(/\./g, "")
      : compact;
  return Number(normalized);
}

function allowedMoney(context: CustomerReplyContext) {
  return [
    context.quote?.totalIncVatOre,
    context.quote?.maximumTotalIncVatOre,
  ].filter((value): value is number => typeof value === "number");
}

function allowedAreas(context: CustomerReplyContext) {
  return [
    context.measurement?.areaMinTenths,
    context.measurement?.areaMaxTenths,
  ].filter((value): value is number => typeof value === "number");
}

function formatNokFromOre(ore: number) {
  return `${new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(ore / 100)} kr`;
}

function formatSquareMetersFromTenths(tenths: number) {
  return `${new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(tenths / 10)} m²`;
}

/**
 * The stored fact context uses integer øre and tenths for exact validation.
 * Never expose those storage units to the language model: a model can otherwise
 * repeat a raw integer as a customer-facing amount (for example "1 455 858 øre").
 */
export function customerReplyPromptContext(context: CustomerReplyContext) {
  const { measurement, quote, businessSources, ...base } = context;

  return {
    ...base,
    ...(measurement
      ? {
          measurement: {
            reference: measurement.reference,
            areaMin: formatSquareMetersFromTenths(measurement.areaMinTenths),
            areaMax: formatSquareMetersFromTenths(measurement.areaMaxTenths),
          },
        }
      : {}),
    ...(quote
      ? {
          quote: {
            reference: quote.reference,
            status: quote.status,
            totalIncVat: formatNokFromOre(quote.totalIncVatOre),
            ...(typeof quote.maximumTotalIncVatOre === "number"
              ? {
                  maximumTotalIncVat: formatNokFromOre(
                    quote.maximumTotalIncVatOre,
                  ),
                }
              : {}),
            ...(quote.validUntil ? { validUntil: quote.validUntil } : {}),
            ...(quote.version ? { version: quote.version } : {}),
            ...(quote.serviceDescription
              ? { serviceDescription: quote.serviceDescription }
              : {}),
            ...(quote.termsVersion
              ? { termsVersion: quote.termsVersion }
              : {}),
          },
        }
      : {}),
    ...(businessSources
      ? {
          businessSources: {
            ...businessSources,
            priceRules: businessSources.priceRules.map((rule) => {
              const { unitPriceExVatOre, ...safeRule } = rule;
              return {
                ...safeRule,
                unitPriceExVat: `${formatNokFromOre(unitPriceExVatOre)}/m² eks. mva.`,
              };
            }),
          },
        }
      : {}),
  };
}

export function assertCustomerReplyTextSafe(
  text: string,
  context: CustomerReplyContext,
) {
  const normalized = text.normalize("NFKC");
  if (/\d[\d\s.,]*\s*øre\b/i.test(normalized)) {
    throw new TypeError(
      "AI reply may not expose raw øre amounts to the customer",
    );
  }
  for (const sentence of normalized.split(/[.!?](?:\s|$)/)) {
    if (!/maksimalpris/i.test(sentence) || !/\bmed mindre\b/i.test(sentence))
      continue;
    const exception = sentence.split(/\bmed mindre\b/i)[1] || "";
    if (!/skriftlig\s+(?:og\s+signert\s+)?endringsavtale/i.test(exception)) {
      throw new TypeError(
        "AI reply may not describe an exception to the maximum price without a written change agreement",
      );
    }
  }
  for (const match of normalized.matchAll(
    /(\d[\d\s.]*(?:,\d{1,2})?)\s*(?:kr|nok)\b/gi,
  )) {
    const parsed = norwegianNumber(match[1]);
    const ore = Math.round(parsed * 100);
    if (
      !Number.isFinite(ore) ||
      !allowedMoney(context).some((allowed) => Math.abs(allowed - ore) <= 1)
    ) {
      throw new TypeError(
        "AI reply contains a price that is not in the approved quote snapshot",
      );
    }
  }
  for (const match of normalized.matchAll(
    /(\d[\d\s.]*(?:,\d)?)\s*m(?:²|2)\b/gi,
  )) {
    const parsed = norwegianNumber(match[1]);
    const tenths = Math.round(parsed * 10);
    if (
      !Number.isFinite(tenths) ||
      !allowedAreas(context).some((allowed) => allowed === tenths)
    ) {
      throw new TypeError(
        "AI reply contains a roof area that is not in the approved measurement snapshot",
      );
    }
  }
  if (/\bgaranterer\b|\b\d+\s*års?\s+garanti\b/i.test(normalized)) {
    throw new TypeError("AI reply may not add an unverified guarantee");
  }
  if (
    /\bvi\s+(?:kommer|starter)\s+(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|i morgen|den\s+\d)/i.test(
      normalized,
    )
  ) {
    throw new TypeError(
      "AI reply may not promise an unapproved visit or start date",
    );
  }
  if (
    context.purpose === "cancellation" &&
    /\b(?:avtalen|kontrakten|bestillingen)\s+er\s+(?:kansellert|avsluttet|annullert)\b/i.test(
      normalized,
    )
  ) {
    throw new TypeError("AI reply may not confirm a contractual cancellation");
  }
  return true;
}

export function minimizeCustomerReplyContext(
  context: CustomerReplyContext,
): CustomerReplyContext {
  return {
    ...context,
    customerMessage: sanitizeLeadMessage(context.customerMessage).slice(
      0,
      2_000,
    ),
  };
}

export async function generateCustomerReplyDraft(input: {
  provider: AiProvider;
  context: CustomerReplyContext;
  correlationId: string;
}) {
  const context = minimizeCustomerReplyContext(input.context);
  const promptContext = customerReplyPromptContext(context);
  const generated = await input.provider.generate({
    task: "customer.reply.draft",
    schemaName: "customer-reply-nb-v2",
    schema: customerReplyJsonSchema as unknown as Record<string, unknown>,
    correlationId: input.correlationId,
    system: [
      "Du lager bare et internt norsk svarutkast for Takfornyelse.",
      "Svar varmt, tydelig og profesjonelt til norske boligeiere over 30 år.",
      "Bruk bare fakta som finnes i JSON-konteksten. Ikke finn på pris, areal, rabatt, dato, garanti eller arbeidsløfte.",
      "Hvis du nevner pris eller areal, kopier nøyaktig en verdi fra godkjent quote eller measurement.",
      "Alle pengebeløp i JSON-konteksten er allerede formatert i kroner. Bruk aldri rå øreverdier eller ordet øre i et kundesvar.",
      "Når du forklarer maksimalpris: Kunden betaler aldri mer enn maksimalprisen uten en ny skriftlig endringsavtale. Hvis kontrollmålingen viser større areal eller annet omfang over toleransen eller maksimalprisen, stanses berørt arbeid til kunden har mottatt og skriftlig akseptert endringsavtalen. Beskriv aldri kontrollmålingen som et selvstendig unntak fra maksimalprisen.",
      "Bruk den uforanderlige quote- og contract-versjonen i saken når kunden spør om et eksisterende tilbud eller en eksisterende avtale.",
      "Bruk aktive businessSources bare for gjeldende generell informasjon. En gjeldende listepris er ikke et bindende tilbud og skal ikke erstatte prisene i saken.",
      "Hvis aktive kilder avviker fra saksdokumentet, skal du forklare at den utstedte saksversjonen gjelder og foreslå et revidert tilbud når det er nødvendig.",
      "Et avslag skal møtes vennlig uten press. Foreslå administrativ oppfølging, men ikke lov rabatt.",
      "En kanselleringsforespørsel skal bare bekreftes mottatt for manuell vurdering. Ikke bekreft at avtalen er kansellert.",
      "Administrator må alltid kontrollere og godkjenne teksten før utsending.",
    ].join("\n"),
    prompt: `Lag et strukturert svarutkast basert på denne minimerte sakskonteksten:\n${JSON.stringify(promptContext)}`,
  });
  const result = customerReplySchema.parse(generated.data);
  assertCustomerReplyTextSafe(
    `${result.subject}\n${result.replyDraft}`,
    context,
  );
  return {
    result,
    context,
    model: generated.model,
    promptVersion: generated.promptVersion,
  };
}

const polishedReplySchema = z.object({
  subject: z.string().trim().min(5).max(160),
  replyDraft: z.string().trim().min(20).max(3_000),
});

const polishedReplyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    replyDraft: { type: "string" },
  },
  required: ["subject", "replyDraft"],
} as const;

export async function polishCustomerReplyDraft(input: {
  bodyText: string;
  context: CustomerReplyContext;
  correlationId: string;
  provider: AiProvider;
  subject: string;
}) {
  const context = minimizeCustomerReplyContext(input.context);
  const promptContext = customerReplyPromptContext(context);
  const generated = await input.provider.generate({
    task: "customer.reply.polish",
    schemaName: "customer-reply-polish-nb-v2",
    schema: polishedReplyJsonSchema as unknown as Record<string, unknown>,
    correlationId: input.correlationId,
    system: [
      "Du forbedrer et internt svarutkast for Takfornyelse på profesjonell norsk.",
      "Bevar meningen og alle verifiserte fakta. Ikke legg til pris, areal, rabatt, garanti, dato eller løfte.",
      "Alle pengebeløp i sakskonteksten er formatert i kroner. Bruk aldri rå øreverdier eller ordet øre i et kundesvar.",
      "Når teksten omtaler maksimalpris, må den slå fast at avvik over rammen stanser berørt arbeid og krever en ny skriftlig endringsavtale som kunden aksepterer før arbeidet fortsetter. Kontrollmålingen er aldri alene et unntak fra maksimalprisen.",
      "Bruk saksdokumentet for eksisterende tilbud eller avtale. Gjeldende listepriser må aldri fremstilles som kundens bindende pris.",
      "Returner bare et forslag. Administratoren må kontrollere og godkjenne før utsending.",
    ].join("\n"),
    prompt: `Forbedre administratorens utkast uten å endre fakta.\n\nSakskontekst:\n${JSON.stringify(promptContext)}\n\nEmne:\n${input.subject}\n\nSvarutkast:\n${input.bodyText}`,
  });
  const result = polishedReplySchema.parse(generated.data);
  assertCustomerReplyTextSafe(
    `${result.subject}\n${result.replyDraft}`,
    context,
  );
  return {
    result,
    model: generated.model,
    promptVersion: generated.promptVersion,
  };
}
