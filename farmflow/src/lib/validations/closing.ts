import { z } from "zod";

const nonNegDecimal = (label: string, max = 10000000) =>
  z.coerce
    .number({ message: `Please enter a valid ${label}` })
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} looks too high`);

const optionalNonNegInt = z
  .union([
    z.literal(""),
    z.null(),
    z.undefined(),
    z.coerce
      .number({ message: "Must be a whole number" })
      .int("Must be a whole number")
      .min(0, "Cannot be negative")
      .max(100000, "Count looks too high"),
  ])
  .optional()
  .transform((val) => (typeof val === "number" ? val : undefined));

export const dailyClosingInputSchema = z.object({
  closingDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid closing date"),
  branchId: z.string().trim().min(1, "Please select a branch"),
  openingCashBalance: z
    .union([z.literal(""), z.null(), z.undefined(), nonNegDecimal("opening cash")])
    .optional()
    .transform((val) => (typeof val === "number" ? val : 0)),
  cashDeposited: z
    .union([z.literal(""), z.null(), z.undefined(), nonNegDecimal("cash deposited")])
    .optional()
    .transform((val) => (typeof val === "number" ? val : 0)),
  closingCashBalance: nonNegDecimal("closing cash balance"),
  closingWeight: nonNegDecimal("closing chicken weight", 100000),
  closingBirdCount: optionalNonNegInt,
  reconcileStock: z.boolean().optional().default(true),
  notes: z
    .string()
    .trim()
    .max(300, "Notes cannot exceed 300 characters")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
});

export const reopenDailyClosingSchema = z.object({
  id: z.string().min(1, "Closing ID is required"),
  reason: z
    .string()
    .trim()
    .min(3, "Please provide a short reason for reopening")
    .max(250, "Reason cannot exceed 250 characters"),
});

export type DailyClosingValues = z.infer<typeof dailyClosingInputSchema>;
export type DailyClosingInput = z.input<typeof dailyClosingInputSchema>;
export type ReopenDailyClosingValues = z.infer<typeof reopenDailyClosingSchema>;
