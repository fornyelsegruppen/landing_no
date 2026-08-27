import { z } from "zod";

const employeeEmailSchema = z.string().trim().toLowerCase().email().max(200);

const employeePhoneSchema = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value.replace(/\D/g, "").length >= 8);

export const employeeInputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: employeeEmailSchema,
  phone: employeePhoneSchema,
  password: z.string().min(10).max(200),
  interfaceLanguage: z.enum(["nb", "lt", "en"]),
});

export const employeeUpdateSchema = z
  .object({
    active: z.boolean().optional(),
    displayName: z.string().trim().min(2).max(120).optional(),
    email: employeeEmailSchema.optional(),
    phone: employeePhoneSchema.optional(),
    password: z.union([z.literal(""), z.string().min(10).max(200)]).optional(),
    interfaceLanguage: z.enum(["nb", "lt", "en"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
