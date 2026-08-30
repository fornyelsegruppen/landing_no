import { describe, expect, it } from "vitest";
import {
  assertPaymentReminderCooldown,
  assertPaymentReminderInvoiceReady,
  defaultPaymentReminderCooldownDays,
  paymentReminderCooldownDays,
  paymentReminderKey,
} from "./payment-reminder-policy";

describe("payment reminder policy", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("requires an overdue unpaid invoice and a bank check from today in Oslo", () => {
    expect(() =>
      assertPaymentReminderInvoiceReady(
        {
          status: "overdue",
          dueAt: "2026-08-20T12:00:00.000Z",
          bankCheckedAt: "2026-08-30T06:00:00.000Z",
        },
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertPaymentReminderInvoiceReady(
        {
          status: "paid",
          dueAt: "2026-08-20T12:00:00.000Z",
          bankCheckedAt: "2026-08-30T06:00:00.000Z",
        },
        now,
      ),
    ).toThrow(/unpaid/i);
    expect(() =>
      assertPaymentReminderInvoiceReady(
        {
          status: "overdue",
          dueAt: "2026-08-20T12:00:00.000Z",
          bankCheckedAt: "2026-08-29T20:00:00.000Z",
        },
        now,
      ),
    ).toThrow(/bank today/i);
  });

  it("uses a conservative seven-day cooldown with a bounded override", () => {
    expect(paymentReminderCooldownDays({})).toBe(
      defaultPaymentReminderCooldownDays,
    );
    expect(
      paymentReminderCooldownDays({ PAYMENT_REMINDER_COOLDOWN_DAYS: "14" }),
    ).toBe(14);
    expect(
      paymentReminderCooldownDays({ PAYMENT_REMINDER_COOLDOWN_DAYS: "0" }),
    ).toBe(defaultPaymentReminderCooldownDays);
    expect(() =>
      assertPaymentReminderCooldown(
        [{ sentAt: "2026-08-24T12:00:01.000Z" }],
        now,
      ),
    ).toThrow(/7 days/i);
    expect(() =>
      assertPaymentReminderCooldown(
        [{ sentAt: "2026-08-23T12:00:00.000Z" }],
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertPaymentReminderCooldown(
        [{
          aiAnalysis: {
            paymentReminderSendClaimedAt: "2026-08-30T11:59:00.000Z",
          },
          createdAt: "2026-08-01T12:00:00.000Z",
        }],
        now,
      ),
    ).toThrow(/7 days/i);
  });

  it("keeps the idempotency key on the Oslo business date", () => {
    expect(paymentReminderKey(4, new Date("2026-08-29T22:30:00.000Z"))).toBe(
      "official-invoice-reminder:4:2026-08-30",
    );
  });
});
