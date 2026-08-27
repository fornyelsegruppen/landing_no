import { describe, expect, it } from "vitest";
import { employeeInputSchema } from "@/lib/employees/employee-input";

const validEmployee = {
  displayName: "Kari Nordmann",
  email: "kari@example.no",
  phone: "+47 900 00 000",
  password: "temporary-password",
  interfaceLanguage: "nb" as const,
};

describe("employee input", () => {
  it("accepts an assignable employee with a usable phone number", () => {
    expect(employeeInputSchema.safeParse(validEmployee).success).toBe(true);
  });

  it("rejects an employee who cannot receive customer-facing assignments", () => {
    expect(
      employeeInputSchema.safeParse({ ...validEmployee, phone: "123" }).success,
    ).toBe(false);
  });
});
