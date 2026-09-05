import { describe, expect, it } from "vitest";
import {
  contactMethodSchema,
  isReasonablePhone,
} from "./lead-contact-validation";

describe("contactMethodSchema", () => {
  it("accepts phone only", () => {
    expect(contactMethodSchema.safeParse({ phone: "90000000" }).success).toBe(
      true,
    );
  });

  it("accepts email only", () => {
    expect(
      contactMethodSchema.safeParse({ email: "kunde@example.no" }).success,
    ).toBe(true);
  });

  it("accepts phone and email together", () => {
    expect(
      contactMethodSchema.safeParse({
        phone: "90000000",
        email: "kunde@example.no",
      }).success,
    ).toBe(true);
  });

  it("rejects a lead without either contact method", () => {
    expect(contactMethodSchema.safeParse({}).success).toBe(false);
  });

  it("rejects email-like and alphabetic values in the phone field", () => {
    expect(isReasonablePhone("kunde@example.no")).toBe(false);
    expect(isReasonablePhone("CALL-ME-NOW")).toBe(false);
    expect(
      contactMethodSchema.safeParse({ phone: "kunde@example.no" }).success,
    ).toBe(false);
  });

  it.each(["22 33 44 55", "+47 900 00 000", "+44 (0)20 7946 0958"])(
    "accepts a reasonable Norwegian or international phone number",
    (phone) => {
      expect(isReasonablePhone(phone)).toBe(true);
    },
  );

  it("preserves the email-only path when phone is omitted", () => {
    expect(
      contactMethodSchema.safeParse({ email: "kunde@example.no" }).success,
    ).toBe(true);
  });
});
