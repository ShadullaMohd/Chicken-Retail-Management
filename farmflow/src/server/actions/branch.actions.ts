"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  createBranchSchema,
  updateBranchSchema,
  toggleBranchStatusSchema,
  type BranchFormValues,
  type UpdateBranchInput,
  type ToggleBranchStatusInput,
} from "@/lib/validations/branch";
import {
  createBranch,
  updateBranch,
  toggleBranchStatus,
  type BranchDTO,
} from "@/server/services/branch.service";

export interface ActionResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function createBranchAction(
  values: BranchFormValues
): Promise<ActionResponse<BranchDTO>> {
  try {
    const actor = await requireRole(["OWNER"]);
    const parsed = createBranchSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid branch details.",
      };
    }

    const branch = await createBranch(parsed.data, actor);
    revalidatePath("/branches");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");

    return { success: true, data: branch };
  } catch (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to create branch."),
    };
  }
}

export async function updateBranchAction(
  values: UpdateBranchInput
): Promise<ActionResponse<BranchDTO>> {
  try {
    const actor = await requireRole(["OWNER"]);
    const parsed = updateBranchSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid branch details.",
      };
    }

    const branch = await updateBranch(parsed.data, actor);
    revalidatePath("/branches");
    revalidatePath(`/branches/${branch.id}`);
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");

    return { success: true, data: branch };
  } catch (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to update branch."),
    };
  }
}

export async function toggleBranchStatusAction(
  values: ToggleBranchStatusInput
): Promise<ActionResponse<BranchDTO>> {
  try {
    const actor = await requireRole(["OWNER"]);
    const parsed = toggleBranchStatusSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid status update.",
      };
    }

    const branch = await toggleBranchStatus(parsed.data, actor);
    revalidatePath("/branches");
    revalidatePath(`/branches/${branch.id}`);
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");

    return { success: true, data: branch };
  } catch (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to update branch status."),
    };
  }
}
