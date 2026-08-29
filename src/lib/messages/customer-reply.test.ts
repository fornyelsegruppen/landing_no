import { describe, expect, it, vi } from "vitest";
import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiProvider,
  ProviderHealth,
} from "@/lib/providers/contracts";
import { DeterministicAiProvider } from "@/lib/providers/safe-providers";
import {
  assertCustomerReplyTextSafe,
  customerReplyPromptContext,
  generateCustomerReplyDraft,
  minimizeCustomerReplyContext,
  polishCustomerReplyDraft,
  type CustomerReplyContext,
} from "./customer-reply";

const context: CustomerReplyContext = {
  purpose: "question",
  customerMessage: "Kan dere forklare prisen? Ring 99 88 77 66.",
  service: "takvask",
  measurement: {
    reference: "TM-8-V1",
    areaMinTenths: 935,
    areaMaxTenths: 1023,
  },
  quote: {
    reference: "T-8-V1",
    status: "sent",
    totalIncVatOre: 1_764_675,
    maximumTotalIncVatOre: 2_029_376,
  },
};

const valid = {
  subject: "Svar på spørsmålet ditt om tilbud T-8-V1",
  replyDraft:
    "Takk for spørsmålet. Tilbudet viser 17 646,75 kr inkludert mva. Vi går gjerne gjennom innholdet med deg før du bestemmer deg.",
  summary: "Kunden ber om en forklaring av prisen i tilbudet.",
  intent: "question" as const,
  factWarnings: [],
  recommendedAdminAction: "review_and_reply" as const,
};

class SequentialAiProvider implements AiProvider {
  calls = 0;
  requests: AiGenerateRequest[] = [];

  constructor(private readonly responses: unknown[]) {}

  health(): ProviderHealth {
    return { status: "ready", provider: "sequential-ai" };
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    this.requests.push(request);
    const response =
      this.responses[Math.min(this.calls, this.responses.length - 1)];
    this.calls += 1;
    return {
      data: structuredClone(response),
      provider: "sequential-ai",
      model: "fixture",
      promptVersion: request.schemaName,
    };
  }
}

describe("customer reply safety", () => {
  it("removes direct contact details before AI generation", () => {
    expect(minimizeCustomerReplyContext(context).customerMessage).not.toContain(
      "99 88 77 66",
    );
  });

  it("allows only exact approved price and area facts", () => {
    expect(
      assertCustomerReplyTextSafe(
        "Pris 17 646,75 kr og areal 93,5 m².",
        context,
      ),
    ).toBe(true);
    expect(() =>
      assertCustomerReplyTextSafe("Pris 12 000 kr.", context),
    ).toThrow(/approved quote/);
    expect(() => assertCustomerReplyTextSafe("Areal 99 m².", context)).toThrow(
      /approved measurement/,
    );
    expect(() =>
      assertCustomerReplyTextSafe("Maksimalprisen er 2 029 376 øre.", context),
    ).toThrow(/raw øre/);
  });

  it("gives the AI only customer-facing kroner and square-metre values", () => {
    const promptContext = customerReplyPromptContext({
      ...context,
      businessSources: {
        retrievedAt: "2026-08-28T12:00:00.000Z",
        services: [],
        priceRules: [
          {
            id: 1,
            reference: "PR-TAKVASK-V1",
            serviceKey: "takvask",
            termsVersion: "V1",
            unitPriceExVatOre: 9_900,
            validFrom: "2026-01-01T00:00:00.000Z",
            version: 1,
          },
        ],
      },
    });
    const serialized = JSON.stringify(promptContext).replace(/\u00a0/g, " ");

    expect(serialized).not.toContain("totalIncVatOre");
    expect(serialized).not.toContain("maximumTotalIncVatOre");
    expect(serialized).not.toContain("unitPriceExVatOre");
    expect(serialized).not.toContain("areaMinTenths");
    expect(serialized).toContain("17 646,75 kr");
    expect(serialized).toContain("20 293,76 kr");
    expect(serialized).toContain("99,00 kr/m² eks. mva.");
    expect(serialized).toContain("93,5 m²");
  });

  it("blocks promises and automatic cancellation confirmation", () => {
    expect(() =>
      assertCustomerReplyTextSafe("Vi kommer mandag.", context),
    ).toThrow(/start date/);
    expect(() =>
      assertCustomerReplyTextSafe("Kontrakten er kansellert.", {
        ...context,
        purpose: "cancellation",
      }),
    ).toThrow(/cancellation/);
  });

  it("blocks an ambiguous control-measurement exception to the maximum price", () => {
    expect(() =>
      assertCustomerReplyTextSafe(
        "Kunden betaler aldri mer enn maksimalprisen uten en ny skriftlig endringsavtale, med mindre kontrollmålingen viser avvik.",
        context,
      ),
    ).toThrow(/exception to the maximum price/);
    expect(
      assertCustomerReplyTextSafe(
        "Kunden betaler aldri mer enn maksimalprisen med mindre kunden aksepterer en ny skriftlig endringsavtale.",
        context,
      ),
    ).toBe(true);
  });

  it("rejects misspelled forms of endringsavtale", () => {
    expect(() =>
      assertCustomerReplyTextSafe(
        "Arbeidet stanses til kunden har akseptert en skriftlig endringsavtalel.",
        context,
      ),
    ).toThrow(/invalid form/);
    expect(
      assertCustomerReplyTextSafe(
        "Arbeidet stanses til kunden har akseptert den skriftlige endringsavtalen.",
        context,
      ),
    ).toBe(true);
  });

  it("rejects a definite endringsavtale form after an indefinite article", () => {
    expect(() =>
      assertCustomerReplyTextSafe(
        "Kunden betaler aldri mer enn maksimalprisen uten en ny skriftlig endringsavtalen.",
        context,
      ),
    ).toThrow(/grammatically inconsistent form/);
    expect(
      assertCustomerReplyTextSafe(
        "Kunden betaler aldri mer enn maksimalprisen uten en ny skriftlig endringsavtale.",
        context,
      ),
    ).toBe(true);
  });

  it("rejects internal AI and implementation language in customer-facing text", () => {
    const internalPhrases = [
      "Vi kan ikke love dette uten kildegrunnlag.",
      "Svaret er kontrollert mot faktakonteksten.",
      "Denne regelen er hentet fra systemprompten.",
      "Opplysningen ligger i JSON-konteksten.",
      "Prisen ble funnet i databasen.",
      "Opplysningen er hentet fra det interne systemet.",
      "Opplysningen ligger i JSON konteksten.",
      "Dette er kontrollert av KI-modellen.",
    ];

    for (const phrase of internalPhrases) {
      expect(() => assertCustomerReplyTextSafe(phrase, context)).toThrow(
        /internal technical wording/,
      );
    }

    expect(
      assertCustomerReplyTextSafe(
        "Et mulig tillegg må avklares særskilt gjennom et revidert eller separat tilbud. Ta gjerne kontakt dersom du ønsker et slikt tilbud.",
        context,
      ),
    ).toBe(true);
    expect(
      assertCustomerReplyTextSafe(
        "Vi har registrert spørsmålet i systemet vårt.",
        context,
      ),
    ).toBe(true);
  });

  it("requires an explicit answer when the customer asks about adding impregnation", () => {
    const multiPartContext: CustomerReplyContext = {
      ...context,
      customerMessage:
        "Hva dekker maksimalprisen, og kan jeg velge impregnering senere?",
    };

    expect(() =>
      assertCustomerReplyTextSafe(
        "Maksimalprisen følger tilbudet. Takfornyelse utfører bare tjenestene som er beskrevet i det valgte tilbudet.",
        multiPartContext,
      ),
    ).toThrow(/explicitly answer whether impregnation/);
    expect(
      assertCustomerReplyTextSafe(
        "Maksimalprisen følger tilbudet. Impregnering er ikke inkludert, men kan avtales senere som et tillegg gjennom et revidert tilbud.",
        multiPartContext,
      ),
    ).toBe(true);
  });

  it("requires separate inclusion and later-addition answers for impregnation", () => {
    const impregnationContext: CustomerReplyContext = {
      ...context,
      customerMessage:
        "Er impregnering inkludert i dette tilbudet, og kan jeg legge det til senere?",
      quote: {
        ...context.quote!,
        serviceDescription: "Takvask",
      },
    };

    expect(() =>
      assertCustomerReplyTextSafe(
        "Impregnering er ikke inkludert i dette tilbudet.",
        impregnationContext,
      ),
    ).toThrow(/later addition/);
    expect(() =>
      assertCustomerReplyTextSafe(
        "Impregnering kan avklares senere gjennom et revidert tilbud.",
        impregnationContext,
      ),
    ).toThrow(/whether impregnation is included/);
    expect(() =>
      assertCustomerReplyTextSafe(
        "Impregnering er inkludert i dette tilbudet. Et eventuelt senere tillegg må avklares gjennom et revidert tilbud.",
        impregnationContext,
      ),
    ).toThrow(/contradicts the selected quote/);
    expect(() =>
      assertCustomerReplyTextSafe(
        "Impregnering er ikke inkludert i dette tilbudet, men kan legges til senere.",
        impregnationContext,
      ),
    ).toThrow(/controlled later addition/);
    expect(
      assertCustomerReplyTextSafe(
        "Impregnering er ikke inkludert i dette tilbudet. Et eventuelt senere tillegg må avklares særskilt gjennom et revidert tilbud.",
        impregnationContext,
      ),
    ).toBe(true);
  });

  it("uses the selected quote as the source of truth for included impregnation", () => {
    const includedContext: CustomerReplyContext = {
      ...context,
      customerMessage: "Er impregneringen inkludert i dette tilbudet?",
      quote: {
        ...context.quote!,
        serviceDescription: "Takvask og impregnering",
      },
    };

    expect(() =>
      assertCustomerReplyTextSafe(
        "Impregneringen er ikke inkludert i dette tilbudet.",
        includedContext,
      ),
    ).toThrow(/contradicts the selected quote/);
    expect(
      assertCustomerReplyTextSafe(
        "Impregneringen er inkludert i dette tilbudet.",
        includedContext,
      ),
    ).toBe(true);
  });

  it("recognizes definite-form impregnation questions with a follow-up pronoun", () => {
    const definiteFormContext: CustomerReplyContext = {
      ...context,
      customerMessage:
        "Er impregneringen inkludert, og kan den legges til senere?",
      quote: {
        ...context.quote!,
        serviceDescription: "Takvask",
      },
    };

    expect(() =>
      assertCustomerReplyTextSafe(
        "Tilbudet gjelder tjenestene som er beskrevet.",
        definiteFormContext,
      ),
    ).toThrow(/whether impregnation is included/);
    expect(
      assertCustomerReplyTextSafe(
        "Impregneringen er ikke inkludert. Et eventuelt senere tillegg må avtales særskilt gjennom et revidert tilbud.",
        definiteFormContext,
      ),
    ).toBe(true);
  });

  it("requires a safe complete answer to the live control-measurement price question", () => {
    const liveUatContext: CustomerReplyContext = {
      ...context,
      customerMessage:
        "Er impregnering inkludert i dette tilbudet, og hva skjer med prisen dersom kontrollmålingen viser et større takareal?",
    };

    expect(() =>
      assertCustomerReplyTextSafe(
        "Impregnering er ikke inkludert i dette tilbudet.",
        liveUatContext,
      ),
    ).toThrow(/larger control measurement/);
    expect(() =>
      assertCustomerReplyTextSafe(
        "Impregnering er ikke inkludert. Kontrollmålingen viser større takareal, derfor økes prisen over maksimalprisen.",
        liveUatContext,
      ),
    ).toThrow(/larger control measurement/);
    expect(
      assertCustomerReplyTextSafe(
        "Impregnering er ikke inkludert i dette tilbudet. Dersom kontrollmålingen viser et større takareal over toleransen eller maksimalprisen, stanses berørt arbeid. Kunden betaler aldri mer enn maksimalprisen uten en ny skriftlig endringsavtale som kunden har akseptert før arbeidet fortsetter.",
        liveUatContext,
      ),
    ).toBe(true);
  });

  it("generates a controlled draft without changing approved facts", async () => {
    await expect(
      generateCustomerReplyDraft({
        provider: new DeterministicAiProvider(valid),
        context,
        correlationId: "reply-test",
      }),
    ).resolves.toMatchObject({ result: valid });
    await expect(
      generateCustomerReplyDraft({
        provider: new DeterministicAiProvider({
          ...valid,
          replyDraft:
            "Takk. Ny pris er 12 000 kr etter rabatt, og vi følger opp snart.",
        }),
        context,
        correlationId: "reply-price",
      }),
    ).rejects.toThrow(/approved quote/);
  });

  it("automatically retries once when the first AI draft fails safety validation", async () => {
    const provider = new SequentialAiProvider([
      {
        ...valid,
        replyDraft:
          "Arbeidet stanses til kunden har akseptert en skriftlig endringsavtalel.",
      },
      valid,
    ]);
    const beforeGenerate = vi.fn(async () => undefined);

    await expect(
      generateCustomerReplyDraft({
        provider,
        context,
        correlationId: "reply-safety-retry",
        beforeGenerate,
      }),
    ).resolves.toMatchObject({ result: valid });
    expect(provider.calls).toBe(2);
    expect(beforeGenerate).toHaveBeenNthCalledWith(1, {
      attempt: 1,
      correlationId: "reply-safety-retry",
    });
    expect(beforeGenerate).toHaveBeenNthCalledWith(2, {
      attempt: 2,
      correlationId: "reply-safety-retry-safety-retry",
    });
  });

  it("retries when the first AI draft exposes internal technical wording", async () => {
    const provider = new SequentialAiProvider([
      {
        ...valid,
        replyDraft:
          "Et senere tillegg kan ikke loves uten kildegrunnlag. Kontakt oss for et revidert tilbud.",
      },
      valid,
    ]);

    await expect(
      generateCustomerReplyDraft({
        provider,
        context,
        correlationId: "reply-internal-language-retry",
      }),
    ).resolves.toMatchObject({ result: valid });
    expect(provider.calls).toBe(2);
  });

  it("does not prime the provider with forbidden internal vocabulary", async () => {
    const provider = new SequentialAiProvider([valid]);

    await generateCustomerReplyDraft({
      provider,
      context,
      correlationId: "reply-customer-language-only",
    });

    expect(provider.requests[0]?.schemaName).toBe("customer-reply-nb-v6");
    expect(provider.requests[0]?.system).not.toMatch(
      /kildegrunnlag|faktakontekst|systemprompt|JSON-kontekst|automatisk faktakontroll/i,
    );
  });

  it("uses a validated deterministic fallback for the live compound question after two unsafe AI drafts", async () => {
    const liveUatContext: CustomerReplyContext = {
      ...context,
      customerMessage:
        "Er impregnering inkludert i dette tilbudet, og hva skjer med prisen dersom kontrollmålingen viser et større takareal?",
      quote: {
        ...context.quote!,
        reference: "T-17-V1",
        maximumTotalIncVatOre: 1_455_858,
        serviceDescription: "Takvask",
      },
    };
    const provider = new SequentialAiProvider([
      {
        ...valid,
        replyDraft:
          "Opplysningen kan ikke bekreftes uten kildegrunnlag. Kontakt oss senere.",
      },
      {
        ...valid,
        replyDraft:
          "Impregnering er ikke inkludert. Prisen kan endres etter kontrollmålingen.",
      },
    ]);

    const generated = await generateCustomerReplyDraft({
      provider,
      context: liveUatContext,
      correlationId: "reply-live-safety-fallback",
    });

    expect(provider.calls).toBe(2);
    expect(generated).toMatchObject({
      safetyFallback: true,
      result: {
        subject: "Svar på spørsmål om tilbud T-17-V1",
        intent: "question",
        recommendedAdminAction: "review_and_reply",
      },
    });
    expect(generated.result.replyDraft).toContain("14 558,58 kr");
    expect(generated.result.replyDraft).toContain(
      "Impregnering er ikke inkludert",
    );
    expect(generated.result.replyDraft).toContain("stanses berørt arbeid");
    expect(() =>
      assertCustomerReplyTextSafe(
        `${generated.result.subject}\n${generated.result.replyDraft}`,
        liveUatContext,
      ),
    ).not.toThrow();
  });

  it("keeps rejecting two unsafe drafts when a deterministic fallback cannot cover the question", async () => {
    const provider = new SequentialAiProvider([
      {
        ...valid,
        replyDraft:
          "Dette svaret bygger på faktakonteksten i systemet og skal derfor ikke brukes som kundetekst.",
      },
      {
        ...valid,
        replyDraft:
          "Dette svaret bygger på faktakonteksten i systemet og skal derfor ikke brukes som kundetekst.",
      },
    ]);

    await expect(
      generateCustomerReplyDraft({
        provider,
        context,
        correlationId: "reply-no-unsafe-generic-fallback",
      }),
    ).rejects.toThrow(/internal technical wording/);
    expect(provider.calls).toBe(2);
  });

  it("enforces quota before the bounded safety retry calls the provider", async () => {
    const provider = new SequentialAiProvider([
      {
        ...valid,
        replyDraft:
          "Arbeidet stanses til kunden har akseptert en skriftlig endringsavtalel.",
      },
      valid,
    ]);
    const beforeGenerate = vi.fn(async ({ attempt }: { attempt: number }) => {
      if (attempt === 2) throw new Error("Gemini daily request limit reached");
    });

    await expect(
      generateCustomerReplyDraft({
        provider,
        context,
        correlationId: "reply-safety-quota",
        beforeGenerate,
      }),
    ).rejects.toThrow(/daily request limit/);
    expect(provider.calls).toBe(1);
    expect(beforeGenerate).toHaveBeenCalledTimes(2);
  });

  it("professionally polishes administrator text without changing verified facts", async () => {
    const provider = new DeterministicAiProvider({
      subject: "Svar om maksimalprisen i T-8-V1",
      replyDraft:
        "Takk for spørsmålet. Maksimalprisen i tilbudet er 20 293,76 kr inkludert mva. Vi forklarer gjerne hva den dekker før du bestemmer deg.",
    });
    const result = await polishCustomerReplyDraft({
      bodyText: "maks er 20 293,76 kr. spør hvis uklart",
      context,
      correlationId: "polish-test",
      provider,
      subject: "Svar om tilbud T-8-V1",
    });

    expect(result.result.subject).toContain("maksimalprisen");
    expect(result.result.replyDraft).toContain("20 293,76 kr");
  });

  it("rejects polished text that exposes internal technical wording", async () => {
    const provider = new DeterministicAiProvider({
      subject: "Svar om tilbud T-8-V1",
      replyDraft:
        "Et senere tillegg kan ikke bekreftes uten kildegrunnlag. Kontakt oss for et revidert tilbud.",
    });

    await expect(
      polishCustomerReplyDraft({
        bodyText: "Kan impregnering legges til senere?",
        context,
        correlationId: "polish-internal-language",
        provider,
        subject: "Svar om tilbud T-8-V1",
      }),
    ).rejects.toThrow(/internal technical wording/);
  });

  it("does not prime polishing with forbidden internal vocabulary", async () => {
    const provider = new SequentialAiProvider([
      {
        subject: "Svar om tilbud T-8-V1",
        replyDraft:
          "Takk for spørsmålet. Vi forklarer gjerne tilbudet og neste steg før du bestemmer deg.",
      },
    ]);

    await polishCustomerReplyDraft({
      bodyText: "Forklar tilbudet og hva kunden kan gjøre videre.",
      context,
      correlationId: "polish-customer-language-only",
      provider,
      subject: "Svar om tilbud T-8-V1",
    });

    expect(provider.requests[0]?.schemaName).toBe(
      "customer-reply-polish-nb-v5",
    );
    expect(provider.requests[0]?.system).not.toMatch(
      /kildegrunnlag|faktakontekst|systemprompt|JSON-kontekst|automatisk faktakontroll/i,
    );
  });
});
