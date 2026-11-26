import { z } from "zod";

const optionalNonNegInt = z
  .union([
    z.literal(""),
    z.null(),
    z.undefined(),
    z.coerce
      .number()
      .int("Must be a whole number")
      .min(0, "Cannot be negative")
      .max(100000, "Value looks too high"),
  ])
  .optional()
  .transform((val) => (typeof val === "number" ? val : 0));

const optionalNonNegDecimal = z
  .union([
    z.literal(""),
    z.null(),
    z.undefined(),
    z.coerce
      .number()
      .min(0, "Cannot be negative")
      .max(100000, "Value looks too high"),
  ])
  .optional()
  .transform((val) => (typeof val === "number" ? val : undefined));

export const saleFormSchema = z.object({
  saleDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid sale date"),
  branchId: z.string().trim().min(1, "Please select a branch"),
  totalWeightSold: z.coerce
    .number({ message: "Please enter a valid retail sale weight (kg)" })
    .positive("Retail sale (kg) must be greater than 0")
    .max(100000, "Retail sale weight looks too high"),
  numberOfBirdsSold: optionalNonNegInt,
  tokensIssued: optionalNonNegInt,
  cashReceived: z.coerce
    .number({ message: "Please enter a valid retailed sale cash amount" })
    .min(0, "Retailed sale cash cannot be negative")
    .max(10000000, "Amount looks too high"),
  closingStockKg: optionalNonNegDecimal,
  mortalityWeightKg: z
    .union([
      z.literal(""),
      z.null(),
      z.undefined(),
      z.coerce
        .number()
        .min(0, "Mortality weight cannot be negative")
        .max(100000, "Mortality weight looks too high"),
    ])
    .optional()
    .transform((val) => (typeof val === "number" ? val : 0)),
  idempotencyKey: z.string().trim().optional(),
});

export const updateSaleSchema = saleFormSchema.extend({
  id: z.string().min(1, "Sale ID is required"),
  correctionReason: z
    .string()
    .trim()
    .min(3, "Please provide a short reason for this correction")
    .max(250, "Reason cannot exceed 250 characters"),
});

export const voidSaleSchema = z.object({
  id: z.string().min(1, "Sale ID is required"),
  reason: z
    .string()
    .trim()
    .min(3, "Please provide a short reason for voiding this sale")
    .max(250, "Reason cannot exceed 250 characters"),
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;
export type SaleFormInput = z.input<typeof saleFormSchema>;
export type UpdateSaleValues = z.infer<typeof updateSaleSchema>;
export type UpdateSaleInput = z.input<typeof updateSaleSchema>;
export type VoidSaleValues = z.infer<typeof voidSaleSchema>;
export type VoidSaleInput = z.input<typeof voidSaleSchema>;
