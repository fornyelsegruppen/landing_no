import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomerQuestionDeliverySuccess } from "./customer-question-workbench";

const reply = {
  bodyText: "Dette er svaret som ble levert til kunden.",
  channel: "email",
  deliveredAt: "2026-08-29 15:26",
  deliveryRecipient: "fornyelsegruppen+uat-question@gmail.com",
  id: 17,
  status: "delivered",
  subject: "Svar på spørsmål om tilbud T-17-V1",
  updatedAt: "2026-08-29T13:26:00.000Z",
};

describe("customer question delivery success", () => {
  it("renders a fully clickable Lithuanian disclosure with delivery evidence", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerQuestionDeliverySuccess, {
        locale: "lt",
        reply,
      }),
    );

    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Atsakymas pristatytas");
    expect(html).toContain("Rodyti pristatymo informaciją");
    expect(html).toContain("Slėpti pristatymo informaciją");
    expect(html).toContain("fornyelsegruppen+uat-question@gmail.com");
    expect(html).toContain("2026-08-29 15:26");
    expect(html).toContain("Pristatytas atsakymas");
  });

  it("keeps touch and responsive layout affordances in the disclosure", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerQuestionDeliverySuccess, {
        locale: "lt",
        reply,
      }),
    );

    expect(html).toContain("min-h-14");
    expect(html).toContain("sm:flex-row");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("break-all");
  });

  it.each([
    ["nb", "Svaret er levert", "Vis leveringsinformasjon"],
    ["en", "Reply delivered", "Show delivery information"],
  ] as const)(
    "localizes administrator copy for %s",
    (locale, title, action) => {
      const html = renderToStaticMarkup(
        createElement(CustomerQuestionDeliverySuccess, { locale, reply }),
      );

      expect(html).toContain(title);
      expect(html).toContain(action);
    },
  );
});
