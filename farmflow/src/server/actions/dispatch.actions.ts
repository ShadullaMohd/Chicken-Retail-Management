"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  dispatchFormSchema,
  updateDispatchSchema,
  receiveDispatchSchema,
  updateDressedWeightSchema,
  cancelDispatchSchema,
  type DispatchFormInput,
  type UpdateDispatchInput,
  type ReceiveDispatchInput,
  type UpdateDressedWeightInput,
  type CancelDispatchInput,
} from "@/lib/validations/dispatch";
import {
  createDispatch,
  updateDispatch,
  receiveDispatch,
  updateReceivedDressedWeight,
  cancelDispatch,
  type DispatchDTO,
} from "@/server/services/dispatch.service";
import type { ActionResponse } from "./branch.actions";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function revalidateDispatchPaths(branchId?: string) {
  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
  revalidatePath("/branches");
  if (branchId) {
    revalidatePath(`/branches/${branchId}`);
  }
}

export async function createDispatchAction(
  values: DispatchFormInput
): Promise<ActionResponse<DispatchDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = dispatchFormSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid dispatch details.",
      };
    }

    const dispatch = await createDispatch(parsed.data, actor);
    revalidateDispatchPaths(dispatch.branchId);
    return { success: true, data: dispatch };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to create dispatch."),
    };
  }
}

export async function updateDispatchAction(
  values: UpdateDispatchInput
): Promise<ActionResponse<DispatchDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = updateDispatchSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid dispatch details.",
      };
    }

    const dispatch = await updateDispatch(parsed.data, actor);
    revalidateDispatchPaths(dispatch.branchId);
    revalidatePath(`/dispatch/${dispatch.id}`);
    return { success: true, data: dispatch };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to update dispatch."),
    };
  }
}

export async function receiveDispatchAction(
  values: ReceiveDispatchInput
): Promise<ActionResponse<DispatchDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = receiveDispatchSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid receipt details.",
      };
    }

    const dispatch = await receiveDispatch(parsed.data, actor);
    revalidateDispatchPaths(dispatch.branchId);
    revalidatePath(`/dispatch/${dispatch.id}`);
    return { success: true, data: dispatch };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to receive dispatch."),
    };
  }
}

export async function updateDressedWeightAction(
  values: UpdateDressedWeightInput
): Promise<ActionResponse<DispatchDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = updateDressedWeightSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid dressed weight.",
      };
    }

    const dispatch = await updateReceivedDressedWeight(parsed.data, actor);
    revalidateDispatchPaths(dispatch.branchId);
    revalidatePath(`/dispatch/${dispatch.id}`);
    return { success: true, data: dispatch };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to update dressed weight."),
    };
  }
}

export async function cancelDispatchAction(
  values: CancelDispatchInput
): Promise<ActionResponse<DispatchDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = cancelDispatchSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid cancellation details.",
      };
    }

    const dispatch = await cancelDispatch(parsed.data, actor);
    revalidateDispatchPaths(dispatch.branchId);
    revalidatePath(`/dispatch/${dispatch.id}`);
    return { success: true, data: dispatch };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to cancel dispatch."),
    };
  }
}
