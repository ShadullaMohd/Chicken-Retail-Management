import { z } from "zod";

export const branchFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Branch name must be at least 2 characters")
    .max(100, "Branch name cannot exceed 100 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Branch code must be at least 2 characters")
    .max(20, "Branch code cannot exceed 20 characters")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Branch code can only contain letters, numbers, and hyphens"
    )
    .transform((val) => val.toUpperCase()),
  address: z
    .string()
    .trim()
    .max(255, "Address cannot exceed 255 characters")
    .optional()
    .or(z.literal("")),
  contactNumber: z
    .string()
    .trim()
    .max(25, "Contact number cannot exceed 25 characters")
    .optional()
    .or(z.literal("")),
  managerId: z.string().trim().optional().or(z.literal("")),
  isActive: z.boolean(),
});

export const createBranchSchema = branchFormSchema;

export const updateBranchSchema = branchFormSchema.extend({
  id: z.string().min(1, "Branch ID is required"),
});

export const toggleBranchStatusSchema = z.object({
  id: z.string().min(1, "Branch ID is required"),
  isActive: z.boolean(),
});

export type BranchFormValues = z.infer<typeof branchFormSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ToggleBranchStatusInput = z.infer<typeof toggleBranchStatusSchema>;
