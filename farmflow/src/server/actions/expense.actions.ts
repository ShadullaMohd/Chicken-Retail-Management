"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  createExpenseCategorySchema,
  createExpensesBulkSchema,
  deleteExpenseSchema,
  toggleExpenseCategorySchema,
  updateExpenseSchema,
  type CreateExpenseCategoryValues,
  type CreateExpensesBulkInput,
  type DeleteExpenseInput,
  type ToggleExpenseCategoryValues,
  type UpdateExpenseInput,
} from "@/lib/validations/expense";
import {
  createExpenseCategory,
  createExpensesBulk,
  deleteExpense,
  toggleExpenseCategoryStatus,
  updateExpense,
  type BulkCreateExpensesResult,
  type ExpenseCategoryDTO,
  type ExpenseDTO,
} from "@/server/services/expense.service";
import type { ActionResponse } from "./branch.actions";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function revalidateExpensePaths(branchId?: string) {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/branches");
  revalidatePath("/reports");
  if (branchId) {
    revalidatePath(`/branches/${branchId}`);
  }
}

export async function createExpensesBulkAction(
  values: CreateExpensesBulkInput
): Promise<ActionResponse<BulkCreateExpensesResult>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = createExpensesBulkSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid expense details.",
      };
    }

    const result = await createExpensesBulk(parsed.data, actor);
    revalidateExpensePaths(parsed.data.branchId);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to save expenses."),
    };
  }
}

export async function updateExpenseAction(
  values: UpdateExpenseInput
): Promise<ActionResponse<ExpenseDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = updateExpenseSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid expense edit.",
      };
    }

    const expense = await updateExpense(parsed.data, actor);
    revalidateExpensePaths(expense.branchId);
    return { success: true, data: expense };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to update expense."),
    };
  }
}

export async function deleteExpenseAction(
  values: DeleteExpenseInput
): Promise<ActionResponse<void>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = deleteExpenseSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid delete request.",
      };
    }

    await deleteExpense(parsed.data, actor);
    revalidateExpensePaths();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to delete expense."),
    };
  }
}

export async function createExpenseCategoryAction(
  values: CreateExpenseCategoryValues
): Promise<ActionResponse<ExpenseCategoryDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = createExpenseCategorySchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid category name.",
      };
    }

    const category = await createExpenseCategory(parsed.data, actor);
    revalidatePath("/expenses");
    return { success: true, data: category };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to create category."),
    };
  }
}

export async function toggleExpenseCategoryAction(
  values: ToggleExpenseCategoryValues
): Promise<ActionResponse<ExpenseCategoryDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = toggleExpenseCategorySchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid category request.",
      };
    }

    const category = await toggleExpenseCategoryStatus(parsed.data, actor);
    revalidatePath("/expenses");
    return { success: true, data: category };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to update category status."),
    };
  }
}
