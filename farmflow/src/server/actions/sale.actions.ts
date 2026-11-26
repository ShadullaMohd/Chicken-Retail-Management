"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  saleFormSchema,
  updateSaleSchema,
  voidSaleSchema,
  type SaleFormInput,
  type UpdateSaleInput,
  type VoidSaleInput,
} from "@/lib/validations/sale";
import {
  createSale,
  updateSale,
  voidSale,
  type SaleDTO,
} from "@/server/services/sale.service";
import type { ActionResponse } from "./branch.actions";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function revalidateSalesPaths(branchId?: string) {
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/branches");
  if (branchId) {
    revalidatePath(`/branches/${branchId}`);
  }
}

export async function createSaleAction(
  values: SaleFormInput
): Promise<ActionResponse<SaleDTO>> {
  try {
    const actor = await requireRole([
      "OWNER",
      "BRANCH_MANAGER",
      "SALES_EMPLOYEE",
    ]);
    const parsed = saleFormSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid sale details.",
      };
    }

    const sale = await createSale(parsed.data, actor);
    revalidateSalesPaths(sale.branchId);
    return { success: true, data: sale };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to record retail sale."),
    };
  }
}

export async function updateSaleAction(
  values: UpdateSaleInput
): Promise<ActionResponse<SaleDTO>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = updateSaleSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid sale correction.",
      };
    }

    const sale = await updateSale(parsed.data, actor);
    revalidateSalesPaths(sale.branchId);
    return { success: true, data: sale };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to update retail sale."),
    };
  }
}

export async function voidSaleAction(
  values: VoidSaleInput
): Promise<ActionResponse<void>> {
  try {
    const actor = await requireRole(["OWNER", "BRANCH_MANAGER"]);
    const parsed = voidSaleSchema.safeParse(values);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid void request.",
      };
    }

    await voidSale(parsed.data, actor);
    revalidateSalesPaths();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, "Failed to void retail sale."),
    };
  }
}
