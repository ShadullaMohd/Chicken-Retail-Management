"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  dailyClosingInputSchema,
  reopenDailyClosingSchema,
  type DailyClosingInput,
  type ReopenDailyClosingValues,
} from "@/lib/validations/closing";
import {
  reopenDailyClosing,
  submitDailyClosing,
  type DailyClosingDTO,
} from "@/server/services/closing.service";
import type { ActionResponse } from "./branch.actions";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function revalidateClosingPaths(branchId?: string) {
  revalidatePath("/closing");
  revalidatePath("/dashboard");
  revalidatePath("/branches");
  revalidatePath("/sales");
  revalidatePath("/reports");
  if (branchId) {
    revalidatePath(`/branches/${branchId}`);
  }
}

export async function submitDailyClosingAction(
  values: DailyClosingInput
): Promise<ActionResponse<DailyClosingDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = dailyClosingInputSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid closing details.",
      };
    }

    const closing = await submitDailyClosing(parsed.data, actor);
    revalidateClosingPaths(closing.branchId);
    return { success: true, data: closing };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to save daily closing."),
    };
  }
}

export async function reopenDailyClosingAction(
  values: ReopenDailyClosingValues
): Promise<ActionResponse<DailyClosingDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = reopenDailyClosingSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid reopen request.",
      };
    }

    const closing = await reopenDailyClosing(parsed.data, actor);
    revalidateClosingPaths(closing.branchId);
    return { success: true, data: closing };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to reopen closing."),
    };
  }
}
