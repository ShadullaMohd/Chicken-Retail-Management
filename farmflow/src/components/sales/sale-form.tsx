"use client";

import { useState, useMemo } from "react";
import { Loader2, AlertCircle, IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/layout/branch-context";
import { saleFormSchema, updateSaleSchema } from "@/lib/validations/sale";
import {
  createSaleAction,
  updateSaleAction,
} from "@/server/actions/sale.actions";
import type { SaleDTO } from "@/server/services/sale.service";

export interface BranchStockOption {
  id: string;
  name: string;
  code: string;
  currentBirdStock: number;
  currentWeightStock: number;
}

interface SaleFormProps {
  branches: BranchStockOption[];
  editingSale?: SaleDTO | null;
  onSuccess: (sale: SaleDTO) => void;
  onCancel?: () => void;
}

interface FormState {
  saleDate: string;
  branchId: string;
  totalWeightSold: string;
  numberOfBirdsSold: string;
  tokensIssued: string;
  cashReceived: string;
  closingStockKg: string;
  mortalityWeightKg: string;
  correctionReason: string;
}

function toIsoDate(isoString: string): string {
  return isoString.slice(0, 10);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function SaleForm({
  branches,
  editingSale,
  onSuccess,
  onCancel,
}: SaleFormProps) {
  const { selectedBranchId, selectedDate } = useBranch();

  const defaultBranchId = useMemo(() => {
    if (editingSale) return editingSale.branchId;
    if (
      selectedBranchId !== "all" &&
      branches.some((b) => b.id === selectedBranchId)
    ) {
      return selectedBranchId;
    }
    return branches.length === 1 ? branches[0].id : "";
  }, [editingSale, selectedBranchId, branches]);

  const [form, setForm] = useState<FormState>(() => {
    if (editingSale) {
      return {
        saleDate: toIsoDate(editingSale.saleDate),
        branchId: editingSale.branchId,
        totalWeightSold: String(editingSale.totalWeightSold),
        numberOfBirdsSold:
          editingSale.numberOfBirdsSold > 0
            ? String(editingSale.numberOfBirdsSold)
            : "",
        tokensIssued: String(editingSale.tokensIssued),
        cashReceived: String(editingSale.retailedSaleCash),
        closingStockKg:
          editingSale.closingStockKg !== null
            ? String(editingSale.closingStockKg)
            : "",
        mortalityWeightKg:
          editingSale.mortalityWeightKg > 0
            ? String(editingSale.mortalityWeightKg)
            : "",
        correctionReason: "",
      };
    }

    return {
      saleDate: selectedDate,
      branchId: defaultBranchId,
      totalWeightSold: "",
      numberOfBirdsSold: "",
      tokensIssued: "",
      cashReceived: "",
      closingStockKg: "",
      mortalityWeightKg: "",
      correctionReason: "",
    };
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    createIdempotencyKey()
  );

  const selectedBranchStock = useMemo(
    () => branches.find((b) => b.id === form.branchId) ?? null,
    [branches, form.branchId]
  );

  const weightNum = Math.max(0, parseFloat(form.totalWeightSold) || 0);
  const cashNum = Math.max(0, parseFloat(form.cashReceived) || 0);
  const mortalityNum = Math.max(0, parseFloat(form.mortalityWeightKg) || 0);
  const closingNum =
    form.closingStockKg.trim() !== ""
      ? Math.max(0, parseFloat(form.closingStockKg) || 0)
      : null;

  const avgRatePerKg = weightNum > 0 ? round2(cashNum / weightNum) : 0;
  const availableStockKg = selectedBranchStock
    ? editingSale
      ? round2(
          selectedBranchStock.currentWeightStock +
            editingSale.totalWeightDeducted
        )
      : selectedBranchStock.currentWeightStock
    : null;

  const expectedLeftoverKg =
    selectedBranchStock && !editingSale
      ? round2(
          selectedBranchStock.currentWeightStock - weightNum - mortalityNum
        )
      : null;

  const totalLossTodayKg =
    availableStockKg !== null
      ? round2(
          availableStockKg - weightNum - (closingNum ?? 0) - mortalityNum
        )
      : null;

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const rawPayload = {
      ...(editingSale
        ? { id: editingSale.id, correctionReason: form.correctionReason }
        : {}),
      saleDate: form.saleDate,
      branchId: form.branchId,
      totalWeightSold: form.totalWeightSold,
      numberOfBirdsSold:
        form.numberOfBirdsSold.trim() === "" ? "" : form.numberOfBirdsSold,
      tokensIssued: form.tokensIssued.trim() === "" ? "" : form.tokensIssued,
      cashReceived: form.cashReceived,
      closingStockKg:
        form.closingStockKg.trim() === "" ? "" : form.closingStockKg,
      mortalityWeightKg:
        form.mortalityWeightKg.trim() === "" ? "" : form.mortalityWeightKg,
      idempotencyKey: editingSale ? undefined : idempotencyKey,
    };

    const parsed = editingSale
      ? updateSaleSchema.safeParse(rawPayload)
      : saleFormSchema.safeParse(rawPayload);

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = editingSale
        ? await updateSaleAction({
            ...rawPayload,
            id: editingSale.id,
            correctionReason: form.correctionReason,
          })
        : await createSaleAction(rawPayload);

      if (!result.success || !result.data) {
        setServerError(result.error ?? "Unable to save sale.");
        return;
      }

      if (!editingSale) {
        setIdempotencyKey(createIdempotencyKey());
        setForm((prev) => ({
          ...prev,
          totalWeightSold: "",
          numberOfBirdsSold: "",
          tokensIssued: "",
          cashReceived: "",
          closingStockKg: "",
          mortalityWeightKg: "",
        }));
      }

      onSuccess(result.data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {serverError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm sm:text-base text-red-700"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Date & Branch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sale-date" className="text-base">
            Sale Date *
          </Label>
          <Input
            id="sale-date"
            type="date"
            value={form.saleDate}
            onChange={(e) => updateField("saleDate", e.target.value)}
          />
          {fieldErrors.saleDate && (
            <p className="text-sm text-red-600">{fieldErrors.saleDate}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-base">Branch *</Label>
          <Select
            value={form.branchId}
            onValueChange={(val) => updateField("branchId", val)}
          >
            <SelectTrigger aria-label="Branch">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.branchId ? (
            <p className="text-sm text-red-600">{fieldErrors.branchId}</p>
          ) : selectedBranchStock ? (
            <p className="text-xs sm:text-sm text-gray-500">
              Available Stock:{" "}
              <strong className="text-[#17212B]">
                {selectedBranchStock.currentWeightStock.toFixed(2)} kg
              </strong>{" "}
              ({selectedBranchStock.currentBirdStock} birds)
            </p>
          ) : null}
        </div>
      </div>

      {/* Retail Sale (kg), Retailed Sale Cash, Birds & Tokens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="retail-sale-kg" className="text-base">
            Retail Sale (kg) *
          </Label>
          <Input
            id="retail-sale-kg"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 45.50"
            value={form.totalWeightSold}
            onChange={(e) => updateField("totalWeightSold", e.target.value)}
          />
          {fieldErrors.totalWeightSold && (
            <p className="text-sm text-red-600">
              {fieldErrors.totalWeightSold}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="retailed-sale-cash" className="text-base">
            Retailed Sale Cash (₹) *
          </Label>
          <Input
            id="retailed-sale-cash"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 10500"
            value={form.cashReceived}
            onChange={(e) => updateField("cashReceived", e.target.value)}
          />
          {fieldErrors.cashReceived && (
            <p className="text-sm text-red-600">{fieldErrors.cashReceived}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="birds-sold" className="text-base">
            Number of Birds Sold (Optional)
          </Label>
          <Input
            id="birds-sold"
            type="text"
            inputMode="numeric"
            placeholder="Optional"
            value={form.numberOfBirdsSold}
            onChange={(e) => updateField("numberOfBirdsSold", e.target.value)}
          />
          {fieldErrors.numberOfBirdsSold && (
            <p className="text-sm text-red-600">
              {fieldErrors.numberOfBirdsSold}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tokens-issued" className="text-base">
            Tokens Issued
          </Label>
          <Input
            id="tokens-issued"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={form.tokensIssued}
            onChange={(e) => updateField("tokensIssued", e.target.value)}
          />
          {fieldErrors.tokensIssued && (
            <p className="text-sm text-red-600">{fieldErrors.tokensIssued}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="closing-stock-kg" className="text-base">
            Closing Stock (kg)
          </Label>
          <Input
            id="closing-stock-kg"
            type="text"
            inputMode="decimal"
            placeholder="Chicken left for the day"
            value={form.closingStockKg}
            onChange={(e) => updateField("closingStockKg", e.target.value)}
          />
          {fieldErrors.closingStockKg && (
            <p className="text-sm text-red-600">{fieldErrors.closingStockKg}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mortality-weight-kg" className="text-base">
            Mortality Weight (kg)
          </Label>
          <Input
            id="mortality-weight-kg"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={form.mortalityWeightKg}
            onChange={(e) => updateField("mortalityWeightKg", e.target.value)}
          />
          {fieldErrors.mortalityWeightKg && (
            <p className="text-sm text-red-600">
              {fieldErrors.mortalityWeightKg}
            </p>
          )}
        </div>
      </div>

      {/* Live Summary Box */}
      <div className="rounded-xl border border-[#079B50]/25 bg-[#E9F8EF]/60 px-5 py-4 space-y-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-base font-medium text-[#092F2B]">
            <IndianRupee className="h-5 w-5 text-[#079B50]" />
            <span>Retailed Sale Cash Total</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#079B50]">
            {formatCurrency(cashNum)}
          </p>
        </div>
        <div className="text-xs sm:text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Retail Sale: <strong>{weightNum.toFixed(2)} kg</strong>
          </span>
          {avgRatePerKg > 0 && (
            <span>
              Avg Rate: <strong>{formatCurrency(avgRatePerKg)}/kg</strong>
            </span>
          )}
          {expectedLeftoverKg !== null && (
            <span>
              Expected Leftover:{" "}
              <strong>{expectedLeftoverKg.toFixed(2)} kg</strong>
              {closingNum !== null && (
                <span> (Entered Closing: {closingNum.toFixed(2)} kg)</span>
              )}
            </span>
          )}
        </div>
      </div>

      <p
        data-testid="total-loss-today"
        className="text-sm sm:text-base font-semibold text-red-600"
      >
        Total Loss of Chicken Today:{" "}
        {totalLossTodayKg !== null
          ? `${totalLossTodayKg.toFixed(2)} kg`
          : "—"}
      </p>

      {editingSale && (
        <div className="space-y-1.5">
          <Label htmlFor="correction-reason" className="text-base">
            Reason for Correction *
          </Label>
          <Input
            id="correction-reason"
            placeholder="e.g. Updated closing stock or corrected cash..."
            value={form.correctionReason}
            onChange={(e) => updateField("correctionReason", e.target.value)}
            required
          />
          {fieldErrors.correctionReason && (
            <p className="text-sm text-red-600">
              {fieldErrors.correctionReason}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            className="h-12 text-base cursor-pointer"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 px-8 text-base font-semibold cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving Sale...
            </>
          ) : editingSale ? (
            "Save Correction"
          ) : (
            "Record Sale"
          )}
        </Button>
      </div>
    </form>
  );

  if (editingSale) {
    return formBody;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#17212B]">
          New Retail Sale
        </CardTitle>
        <p className="text-sm sm:text-base text-gray-500">
          Enter retail sale kg, retailed sale cash, closing stock, and mortality
          weight.
        </p>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}
