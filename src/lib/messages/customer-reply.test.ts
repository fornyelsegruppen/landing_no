import { describe, expect, it } from "vitest";
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
      assertCustomerReplyTextSafe(
        "Maksimalprisen er 2 029 376 øre.",
        context,
      ),
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
});
