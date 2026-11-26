import { z } from "zod";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
] as const;

export const paymentMethodSchema = z.enum(
  ["CASH", "UPI", "BANK_TRANSFER", "OTHER"],
  { message: "Please select a valid payment method" }
);

export const expenseRowSchema = z.object({
  categoryId: z.string().trim().min(1, "Please select an expense category"),
  amount: z.coerce
    .number({ message: "Please enter a valid expense amount" })
    .positive("Amount must be greater than 0")
    .max(10000000, "Amount looks too high"),
  paymentMethod: paymentMethodSchema,
  description: z
    .string()
    .trim()
    .max(300, "Description cannot exceed 300 characters")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
});

export const createExpensesBulkSchema = z.object({
  expenseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid expense date"),
  branchId: z.string().trim().min(1, "Please select a branch"),
  rows: z
    .array(expenseRowSchema)
    .min(1, "Please enter at least one expense")
    .max(50, "Cannot save more than 50 expenses in one batch"),
  idempotencyKey: z.string().trim().optional(),
});

export const updateExpenseSchema = expenseRowSchema.extend({
  id: z.string().min(1, "Expense ID is required"),
  expenseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid expense date"),
  branchId: z.string().trim().min(1, "Please select a branch"),
  correctionReason: z
    .string()
    .trim()
    .min(3, "Please provide a short reason for this edit")
    .max(250, "Reason cannot exceed 250 characters"),
});

export const deleteExpenseSchema = z.object({
  id: z.string().min(1, "Expense ID is required"),
  reason: z
    .string()
    .trim()
    .min(3, "Please provide a short reason for removing this expense")
    .max(250, "Reason cannot exceed 250 characters"),
});

export const createExpenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(60, "Category name cannot exceed 60 characters"),
});

export const toggleExpenseCategorySchema = z.object({
  id: z.string().min(1, "Category ID is required"),
  isActive: z.boolean(),
});

export type ExpenseRowValues = z.infer<typeof expenseRowSchema>;
export type ExpenseRowInput = z.input<typeof expenseRowSchema>;
export type CreateExpensesBulkValues = z.infer<typeof createExpensesBulkSchema>;
export type CreateExpensesBulkInput = z.input<typeof createExpensesBulkSchema>;
export type UpdateExpenseValues = z.infer<typeof updateExpenseSchema>;
export type UpdateExpenseInput = z.input<typeof updateExpenseSchema>;
export type DeleteExpenseValues = z.infer<typeof deleteExpenseSchema>;
export type DeleteExpenseInput = z.input<typeof deleteExpenseSchema>;
export type CreateExpenseCategoryValues = z.infer<
  typeof createExpenseCategorySchema
>;
export type ToggleExpenseCategoryValues = z.infer<
  typeof toggleExpenseCategorySchema
>;
