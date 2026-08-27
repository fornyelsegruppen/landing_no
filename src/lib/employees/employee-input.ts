import { z } from "zod";

export const employeeInputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().email().max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((value) => value.replace(/\D/g, "").length >= 8),
  password: z.string().min(10).max(200),
  interfaceLanguage: z.enum(["nb", "lt", "en"]),
});
