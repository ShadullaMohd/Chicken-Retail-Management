import { z } from "zod";

const optionalPositiveWeight = z
  .union([
    z.literal(""),
    z.null(),
    z.undefined(),
    z.coerce
      .number()
      .positive("Weight after dressing must be greater than 0")
      .max(100000, "Weight after dressing looks too high"),
  ])
  .optional()
  .transform((val) => (typeof val === "number" ? val : undefined));

export const dispatchFormSchema = z
  .object({
    dispatchDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid dispatch date"),
    branchId: z.string().trim().min(1, "Please select a destination branch"),
    numberOfJalis: z.coerce
      .number()
      .int("Number of jalis must be a whole number")
      .min(1, "Number of jalis must be at least 1")
      .max(10000, "Number of jalis looks too high"),
    totalBirdCount: z.coerce
      .number()
      .int("Total bird count must be a whole number")
      .min(1, "Total bird count must be at least 1")
      .max(100000, "Total bird count looks too high"),
    liveWeight: z.coerce
      .number()
      .positive("Live weight must be greater than 0")
      .max(100000, "Live weight looks too high"),
    dressedWeight: optionalPositiveWeight,
    purchaseRatePerKg: z.coerce
      .number()
      .positive("Purchase rate per kg must be greater than 0")
      .max(10000, "Purchase rate per kg looks too high"),
    markAsReceived: z.boolean().default(false),
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional()
      .or(z.literal("")),
    idempotencyKey: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      data.dressedWeight === undefined ||
      data.dressedWeight <= data.liveWeight,
    {
      message: "Weight after dressing cannot exceed live weight",
      path: ["dressedWeight"],
    }
  );

export const updateDispatchSchema = z
  .object({
    id: z.string().min(1, "Dispatch ID is required"),
    dispatchDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid dispatch date"),
    branchId: z.string().trim().min(1, "Please select a destination branch"),
    numberOfJalis: z.coerce
      .number()
      .int("Number of jalis must be a whole number")
      .min(1, "Number of jalis must be at least 1"),
    totalBirdCount: z.coerce
      .number()
      .int("Total bird count must be a whole number")
      .min(1, "Total bird count must be at least 1"),
    liveWeight: z.coerce
      .number()
      .positive("Live weight must be greater than 0"),
    dressedWeight: optionalPositiveWeight,
    purchaseRatePerKg: z.coerce
      .number()
      .positive("Purchase rate per kg must be greater than 0"),
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) =>
      data.dressedWeight === undefined ||
      data.dressedWeight <= data.liveWeight,
    {
      message: "Weight after dressing cannot exceed live weight",
      path: ["dressedWeight"],
    }
  );

export const receiveDispatchSchema = z.object({
  id: z.string().min(1, "Dispatch ID is required"),
  dressedWeight: optionalPositiveWeight,
});

export const updateDressedWeightSchema = z.object({
  id: z.string().min(1, "Dispatch ID is required"),
  dressedWeight: z.coerce
    .number()
    .positive("Weight after dressing must be greater than 0")
    .max(100000, "Weight after dressing looks too high"),
});

export const cancelDispatchSchema = z.object({
  id: z.string().min(1, "Dispatch ID is required"),
  reason: z
    .string()
    .trim()
    .min(3, "Please provide a short cancellation reason")
    .max(250, "Reason cannot exceed 250 characters"),
});

export type DispatchFormValues = z.infer<typeof dispatchFormSchema>;
export type DispatchFormInput = z.input<typeof dispatchFormSchema>;
export type UpdateDispatchValues = z.infer<typeof updateDispatchSchema>;
export type UpdateDispatchInput = z.input<typeof updateDispatchSchema>;
export type ReceiveDispatchValues = z.infer<typeof receiveDispatchSchema>;
export type ReceiveDispatchInput = z.input<typeof receiveDispatchSchema>;
export type UpdateDressedWeightValues = z.infer<
  typeof updateDressedWeightSchema
>;
export type UpdateDressedWeightInput = z.input<
  typeof updateDressedWeightSchema
>;
export type CancelDispatchInput = z.infer<typeof cancelDispatchSchema>;
