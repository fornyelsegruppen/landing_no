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
            ...(quote.termsVersion ? { termsVersion: quote.termsVersion } : {}),
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
  if (
    /\b(?:kildegrunnlag(?:et)?|faktakontekst(?:en)?|systemkontekst(?:en)?|systemprompt(?:en)?|json(?:\s+|-)?kontekst(?:en)?|database(?:n|r|ne)?|språkmodell(?:en)?|(?:ai|ki)(?:\s+|-)?modell(?:en)?|(?:det\s+)?intern(?:t|e)\s+system(?:et)?|automatisk(?:e)?\s+faktakontroll(?:en)?)\b/i.test(
      normalized,
    )
  ) {
    throw new TypeError(
      "AI reply contains internal technical wording that is not suitable for customers",
    );
  }
  for (const match of normalized.matchAll(/\bendringsavtale[a-zæøå]*\b/gi)) {
    if (!/^endringsavtale(?:n|r|ne)?$/i.test(match[0])) {
      throw new TypeError(
        "AI reply contains an invalid form of the Norwegian word endringsavtale",
      );
    }
  }
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
  const impregnationTerm = "impregnering(?:en)?";
  const asksAboutImpregnation = new RegExp(
    `\\b${impregnationTerm}\\b`,
    "i",
  ).test(context.customerMessage);
  const asksWhetherImpregnationIsIncluded =
    asksAboutImpregnation &&
    new RegExp(
      `(?:\\ber\\s+${impregnationTerm}\\b.{0,40}\\b(?:inkludert|med)\\b|\\binngår\\s+${impregnationTerm}\\b|\\b${impregnationTerm}\\b.{0,40}\\b(?:inkludert|inngår)\\b)`,
      "i",
    ).test(context.customerMessage);
  const asksAboutAddingImpregnationLater =
    asksAboutImpregnation &&
    (new RegExp(
      `(?:\\b${impregnationTerm}\\b.{0,80}\\b(?:senere|tillegg|legge\\s+til|velge)\\b|\\b(?:legge\\s+til|velge)\\b.{0,40}\\b${impregnationTerm}\\b)`,
      "i",
    ).test(context.customerMessage) ||
      /\b(?:den|det)\b.{0,50}\b(?:senere|tillegg|legges?\s+til|velge)\b/i.test(
        context.customerMessage,
      ));
  const replySaysImpregnationNotIncluded =
    /\bimpregnering(?:en)?\b\s+(?:er\s+)?ikke\s+inkludert\b/i.test(
      normalized,
    ) ||
    /\bimpregnering(?:en)?\b\s+inngår\s+ikke\b/i.test(normalized) ||
    /\b(?:tilbudet|avtalen)\b.{0,50}\b(?:inkluderer|omfatter)\s+ikke\s+impregnering(?:en)?\b/i.test(
      normalized,
    );
  const replySaysImpregnationIncluded =
    !replySaysImpregnationNotIncluded &&
    (/\bimpregnering(?:en)?\b\s+(?:er\s+)?inkludert\b/i.test(normalized) ||
      /\bimpregnering(?:en)?\b\s+inngår\b(?!\s+ikke)/i.test(normalized) ||
      /\b(?:tilbudet|avtalen)\b.{0,50}\b(?:inkluderer|omfatter)\s+impregnering(?:en)?\b/i.test(
        normalized,
      ));
  if (asksWhetherImpregnationIsIncluded) {
    if (!replySaysImpregnationIncluded && !replySaysImpregnationNotIncluded) {
      throw new TypeError(
        "AI reply must explicitly answer whether impregnation is included",
      );
    }

    const selectedService =
      context.quote?.serviceDescription?.trim() || context.service?.trim();
    const sourceInclusion = selectedService
      ? /impregner/i.test(selectedService)
        ? true
        : /takvask/i.test(selectedService)
          ? false
          : null
      : null;
    if (
      (sourceInclusion === true && !replySaysImpregnationIncluded) ||
      (sourceInclusion === false && !replySaysImpregnationNotIncluded)
    ) {
      throw new TypeError(
        "AI reply contradicts the selected quote about whether impregnation is included",
      );
    }
  }
  if (asksAboutAddingImpregnationLater) {
    const explainsLaterAddition =
      /\bimpregnering(?:en)?\b.{0,120}\b(?:senere|tillegg|legges?\s+til|avklares|avtales|bestilles|revidert|separat|nytt)\b/i.test(
        normalized,
      ) ||
      /\b(?:senere|tillegg|legges?\s+til|avklares|avtales|bestilles|revidert|separat|nytt)\b.{0,120}\bimpregnering(?:en)?\b/i.test(
        normalized,
      );
    const usesControlledPath =
      /\b(?:revidert|separat|nytt)\s+tilbud\b/i.test(normalized) ||
      /\b(?:avklares|avtales|bestilles)\s+særskilt\b/i.test(normalized) ||
      /\b(?:separat|skriftlig)\s+(?:avtale|endringsavtale)\b/i.test(normalized);
    const alreadyIncludedNeedsNoAddition =
      replySaysImpregnationIncluded &&
      /\b(?:allerede\s+inkludert|trenger\s+ikke|ikke\s+nødvendig)\b/i.test(
        normalized,
      );
    if (
      (!explainsLaterAddition || !usesControlledPath) &&
      !alreadyIncludedNeedsNoAddition
    ) {
      throw new TypeError(
        "AI reply must explicitly answer whether impregnation has a controlled later addition path through separate agreement or a revised offer",
      );
    }
  }
  const asksAboutControlMeasurementPrice =
    typeof context.quote?.maximumTotalIncVatOre === "number" &&
    /\b(?:kontrollmåling(?:en)?|større\s+(?:tak)?areal|takareal)\b/i.test(
      context.customerMessage,
    ) &&
    /\b(?:pris(?:en)?|kost(?:er|nad)?|maksimalpris(?:en)?|betale)\b/i.test(
      context.customerMessage,
    );
  if (asksAboutControlMeasurementPrice) {
    const mentionsMeasurement =
      /\b(?:kontrollmåling(?:en)?|større\s+(?:tak)?areal|takareal)\b/i.test(
        normalized,
      );
    const preservesMaximumPrice =
      /\b(?:(?:betaler?|belastes?)\s+(?:aldri|ikke)|(?:skal|kan|vil)\s+(?:aldri|ikke)\s+(?:betale|belastes?))\s+(?:mer\s+enn|over)\s+(?:den\s+)?(?:avtalte\s+)?maksimalpris(?:en)?\b/i.test(
        normalized,
      ) ||
      /\bmaksimalpris(?:en)?\b.{0,60}\b(?:kan|skal|vil)\s+ikke\s+(?:overstiges|overskrides)\b/i.test(
        normalized,
      ) ||
      /\b(?:pris(?:en)?|beløpet)\b.{0,40}\b(?:kan|skal|vil)\s+ikke\s+(?:overstige|overskride)\b.{0,40}\bmaksimalpris(?:en)?\b/i.test(
        normalized,
      );
    const requiresWrittenAgreement =
      /\b(?:ny\s+)?skriftlig\s+endringsavtale(?:n)?\b/i.test(normalized);
    const requiresCustomerAcceptance =
      /\bkunden\b.{0,80}\b(?:aksepterer|akseptert|har\s+akseptert|godkjenner|godkjent|har\s+godkjent)\b/i.test(
        normalized,
      ) || /\b(?:akseptert|godkjent)\b.{0,40}\bav\s+kunden\b/i.test(normalized);
    const stopsAffectedWork =
      /\b(?:berørt\s+)?arbeid(?:et)?\b.{0,60}\b(?:stanses|stoppes|starter\s+ikke|fortsetter\s+ikke)\b/i.test(
        normalized,
      ) ||
      /\b(?:stanses|stoppes)\b.{0,40}\b(?:berørt\s+)?arbeid(?:et)?\b/i.test(
        normalized,
      );
    if (
      !mentionsMeasurement ||
      !preservesMaximumPrice ||
      !requiresWrittenAgreement ||
      !requiresCustomerAcceptance ||
      !stopsAffectedWork
    ) {
      throw new TypeError(
        "AI reply must explain that a larger control measurement cannot exceed the maximum price without a written change agreement accepted by the customer and that affected work stops first",
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
  beforeGenerate?: (input: {
    attempt: number;
    correlationId: string;
  }) => Promise<void>;
}) {
  const context = minimizeCustomerReplyContext(input.context);
  const promptContext = customerReplyPromptContext(context);
  const baseSystem = [
    "Du lager bare et internt norsk svarutkast for Takfornyelse.",
    "Svar varmt, tydelig og profesjonelt til norske boligeiere over 30 år.",
    "Svar eksplisitt på hvert delspørsmål i kundens melding. Hvis konteksten ikke gir grunnlag for ja eller nei, si det tydelig og beskriv hvilket kontrollert neste steg som kreves.",
    "Hvis kunden både spør om impregnering er inkludert og om den kan legges til senere, svar separat på begge deler. Et mulig senere tillegg må avklares særskilt og håndteres i et revidert eller separat tilbud. Inviter kunden til å kontakte Takfornyelse dersom de ønsker et slikt tilbud.",
    "Bruk bare kontrollerte fakta i sakskonteksten. Ikke finn på pris, areal, rabatt, dato, garanti eller arbeidsløfte.",
    "Kundeteksten må aldri omtale interne tekniske mekanismer eller bruke uttrykk som kildegrunnlag, faktakontekst, systemkontekst, systemprompt, JSON-kontekst, database, språkmodell eller automatisk faktakontroll.",
    "Hvis du nevner pris eller areal, kopier nøyaktig en verdi fra godkjent quote eller measurement.",
    "Alle pengebeløp i JSON-konteksten er allerede formatert i kroner. Bruk aldri rå øreverdier eller ordet øre i et kundesvar.",
    "Når du forklarer maksimalpris: Kunden betaler aldri mer enn maksimalprisen uten en ny skriftlig endringsavtale. Hvis kontrollmålingen viser større areal eller annet omfang over toleransen eller maksimalprisen, stanses berørt arbeid til kunden har mottatt og skriftlig akseptert endringsavtalen. Beskriv aldri kontrollmålingen som et selvstendig unntak fra maksimalprisen.",
    "Skriv det norske ordet endringsavtale korrekt. Tillatte bøyninger er endringsavtale, endringsavtalen, endringsavtaler og endringsavtalene.",
    "Bruk den uforanderlige quote- og contract-versjonen i saken når kunden spør om et eksisterende tilbud eller en eksisterende avtale.",
    "Bruk aktive businessSources bare for gjeldende generell informasjon. En gjeldende listepris er ikke et bindende tilbud og skal ikke erstatte prisene i saken.",
    "Hvis aktive kilder avviker fra saksdokumentet, skal du forklare at den utstedte saksversjonen gjelder og foreslå et revidert tilbud når det er nødvendig.",
    "Et avslag skal møtes vennlig uten press. Foreslå administrativ oppfølging, men ikke lov rabatt.",
    "En kanselleringsforespørsel skal bare bekreftes mottatt for manuell vurdering. Ikke bekreft at avtalen er kansellert.",
    "Administrator må alltid kontrollere og godkjenne teksten før utsending.",
  ];
  let lastSafetyError: TypeError | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const attemptCorrelationId =
      attempt === 1
        ? input.correlationId
        : `${input.correlationId}-safety-retry`;
    await input.beforeGenerate?.({
      attempt,
      correlationId: attemptCorrelationId,
    });
    const generated = await input.provider.generate({
      task: "customer.reply.draft",
      schemaName: "customer-reply-nb-v5",
      schema: customerReplyJsonSchema as unknown as Record<string, unknown>,
      correlationId: attemptCorrelationId,
      system: [
        ...baseSystem,
        ...(attempt === 2
          ? [
              "Et tidligere forslag ble avvist av den automatiske faktakontrollen. Lag et helt nytt svar og følg alle reglene ordrett.",
            ]
          : []),
      ].join("\n"),
      prompt: `Lag et strukturert svarutkast basert på denne minimerte sakskonteksten:\n${JSON.stringify(promptContext)}`,
    });
    const result = customerReplySchema.parse(generated.data);
    try {
      assertCustomerReplyTextSafe(
        `${result.subject}\n${result.replyDraft}`,
        context,
      );
    } catch (error) {
      if (!(error instanceof TypeError) || attempt === 2) throw error;
      lastSafetyError = error;
      continue;
    }
    return {
      result,
      context,
      model: generated.model,
      promptVersion: generated.promptVersion,
    };
  }

  throw lastSafetyError || new TypeError("AI reply failed safety validation");
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
    schemaName: "customer-reply-polish-nb-v4",
    schema: polishedReplyJsonSchema as unknown as Record<string, unknown>,
    correlationId: input.correlationId,
    system: [
      "Du forbedrer et internt svarutkast for Takfornyelse på profesjonell norsk.",
      "Bevar og besvar eksplisitt hvert delspørsmål i kundens opprinnelige melding.",
      "Hvis kunden både spør om impregnering er inkludert og om den kan legges til senere, bevar et separat svar på begge deler og beskriv et mulig senere tillegg som særskilt avklaring i et revidert eller separat tilbud.",
      "Bevar meningen og alle verifiserte fakta. Ikke legg til pris, areal, rabatt, garanti, dato eller løfte.",
      "Kundeteksten må aldri omtale interne tekniske mekanismer eller bruke uttrykk som kildegrunnlag, faktakontekst, systemkontekst, systemprompt, JSON-kontekst, database, språkmodell eller automatisk faktakontroll.",
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
