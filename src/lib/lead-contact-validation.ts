import { z } from "zod";

export function isReasonablePhone(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.includes("@") || /[A-Za-z]/u.test(normalized)) {
    return false;
  }
  if (!/^\+?[\d\s().-]+$/u.test(normalized)) return false;
  if (normalized.slice(1).includes("+")) return false;

  const digits = normalized.replace(/\D/gu, "");
  return digits.length >= 7 && digits.length <= 15;
}

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(40)
  .refine(isReasonablePhone, { message: "Invalid phone number" })
  .optional();

export const contactMethodSchema = z
  .object({
    phone: optionalPhoneSchema,
    email: z.string().email().max(200).optional(),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: "Phone or email is required",
    path: ["phone"],
  });
