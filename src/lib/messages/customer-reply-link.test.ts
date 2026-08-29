import type { Payload } from "payload";
import { describe, expect, it, vi } from "vitest";
import {
  appendSecureQuoteCallToAction,
  customerQuestionReplyEmailText,
  findCurrentSecureQuoteUrl,
} from "./customer-reply-link";

vi.mock("@/lib/quotes/customer-access", () => ({
  resolveQuoteAccessToken: vi.fn(async (_payload: Payload, token: string) =>
    token === "current-token" ? { quoteId: 17 } : null,
  ),
}));

function sources(quoteId: number | null = 17) {
  return {
    context: {
      customerMessage: "Er tilbudet fortsatt gyldig?",
      purpose: "question",
    },
    fingerprint: "fingerprint",
    snapshot: { quote: quoteId ? { id: quoteId } : null },
  } as never;
}

describe("customer question reply secure link", () => {
  it("reuses the newest valid link for the exact quote without rotating the active token", async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [
        {
          bodyText:
            "Nyere, men utløpt: https://takfornyelse.as/tilbud/old-token",
        },
        {
          bodyText:
            "Åpne tilbudet:\nhttps://takfornyelse-staging.vercel.app/tilbud/current-token",
        },
      ],
    });
    const payload = { find } as unknown as Payload;

    await expect(
      findCurrentSecureQuoteUrl(payload, { leadId: 17, sources: sources() }),
    ).resolves.toBe(
      "https://takfornyelse-staging.vercel.app/tilbud/current-token",
    );
    expect(find).toHaveBeenCalledTimes(1);
  });

  it("blocks sending when no valid link exists for the bound quote version", async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            bodyText: "Gammel lenke: https://takfornyelse.as/tilbud/old-token",
          },
        ],
      }),
    } as unknown as Payload;

    await expect(
      findCurrentSecureQuoteUrl(payload, { leadId: 17, sources: sources() }),
    ).rejects.toThrow(/No current secure customer link/);
  });

  it("blocks a question that is not bound to a quote version", async () => {
    const payload = { find: vi.fn() } as unknown as Payload;

    await expect(
      findCurrentSecureQuoteUrl(payload, {
        leadId: 17,
        sources: sources(null),
      }),
    ).rejects.toThrow(/not bound to a quote version/);
    expect(payload.find).not.toHaveBeenCalled();
  });

  it("adds one separate secure CTA and keeps repeated composition idempotent", () => {
    const url = "https://takfornyelse.as/tilbud/current-token";
    const once = appendSecureQuoteCallToAction("Takk for spørsmålet.", url);
    const twice = appendSecureQuoteCallToAction(once, url);

    expect(once).toBe(
      `Takk for spørsmålet.\n\nÅpne tilbudet og fortsett på din sikre kundeside:\n${url}`,
    );
    expect(twice).toBe(once);
  });

  it("builds the persisted email text from the approved reply and current link", async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [
          {
            bodyText:
              "Åpne tilbudet:\nhttps://takfornyelse.as/tilbud/current-token",
          },
        ],
      }),
    } as unknown as Payload;

    await expect(
      customerQuestionReplyEmailText(payload, {
        bodyText: "Kontrollert svar.",
        leadId: 17,
        sources: sources(),
      }),
    ).resolves.toContain("\nhttps://takfornyelse.as/tilbud/current-token");
  });
});
