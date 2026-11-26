"use client";

import { useState, useMemo } from "react";
import { Loader2, AlertCircle, IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { useBranch, type BranchOption } from "@/components/layout/branch-context";
import {
  dispatchFormSchema,
  updateDispatchSchema,
} from "@/lib/validations/dispatch";
import {
  createDispatchAction,
  updateDispatchAction,
} from "@/server/actions/dispatch.actions";
import type { DispatchDTO } from "@/server/services/dispatch.service";

interface DispatchFormProps {
  branches: BranchOption[];
  editingDispatch?: DispatchDTO | null;
  onSuccess: (dispatch: DispatchDTO) => void;
  onCancel?: () => void;
}

interface FormState {
  dispatchDate: string;
  branchId: string;
  numberOfJalis: string;
  totalBirdCount: string;
  liveWeight: string;
  dressedWeight: string;
  purchaseRatePerKg: string;
  markAsReceived: boolean;
  notes: string;
}

function toIsoDate(isoString: string): string {
  return isoString.slice(0, 10);
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DispatchForm({
  branches,
  editingDispatch,
  onSuccess,
  onCancel,
}: DispatchFormProps) {
  const { selectedBranchId, selectedDate } = useBranch();

  const defaultBranchId = useMemo(() => {
    if (editingDispatch) return editingDispatch.branchId;
    if (
      selectedBranchId !== "all" &&
      branches.some((b) => b.id === selectedBranchId)
    ) {
      return selectedBranchId;
    }
    return branches.length === 1 ? branches[0].id : "";
  }, [editingDispatch, selectedBranchId, branches]);

  const [form, setForm] = useState<FormState>(() => {
    if (editingDispatch) {
      return {
        dispatchDate: toIsoDate(editingDispatch.dispatchDate),
        branchId: editingDispatch.branchId,
        numberOfJalis: String(editingDispatch.numberOfJalis),
        totalBirdCount: String(editingDispatch.totalBirdCount),
        liveWeight: String(editingDispatch.liveWeight),
        dressedWeight:
          editingDispatch.dressedWeight !== null
            ? String(editingDispatch.dressedWeight)
            : "",
        purchaseRatePerKg: String(editingDispatch.purchaseRatePerKg),
        markAsReceived: false,
        notes: editingDispatch.notes ?? "",
      };
    }

    return {
      dispatchDate: selectedDate,
      branchId: defaultBranchId,
      numberOfJalis: "",
      totalBirdCount: "",
      liveWeight: "",
      dressedWeight: "",
      purchaseRatePerKg: "",
      markAsReceived: false,
      notes: "",
    };
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    createIdempotencyKey()
  );

  const jalisNum = Math.max(0, parseInt(form.numberOfJalis, 10) || 0);
  const liveWeightNum = Math.max(0, parseFloat(form.liveWeight) || 0);
  const dressedWeightNum = Math.max(0, parseFloat(form.dressedWeight) || 0);
  const hasDressed =
    form.dressedWeight.trim() !== "" && dressedWeightNum > 0;
  const rateNum = Math.max(0, parseFloat(form.purchaseRatePerKg) || 0);

  const liveAmount =
    Math.round((liveWeightNum * rateNum + Number.EPSILON) * 100) / 100;
  const jaliCharge = jalisNum * 10;
  const totalAmount =
    Math.round((liveAmount + jaliCharge + Number.EPSILON) * 100) / 100;
  const effectiveStockWeight = hasDressed ? dressedWeightNum : liveWeightNum;
  const yieldPercent =
    liveWeightNum > 0 && hasDressed
      ? ((dressedWeightNum / liveWeightNum) * 100).toFixed(1)
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
      ...(editingDispatch ? { id: editingDispatch.id } : {}),
      dispatchDate: form.dispatchDate,
      branchId: form.branchId,
      numberOfJalis: form.numberOfJalis,
      totalBirdCount: form.totalBirdCount,
      liveWeight: form.liveWeight,
      dressedWeight:
        form.dressedWeight.trim() === "" ? "" : form.dressedWeight,
      purchaseRatePerKg: form.purchaseRatePerKg,
      markAsReceived: form.markAsReceived,
      notes: form.notes,
      idempotencyKey: editingDispatch ? undefined : idempotencyKey,
    };

    const parsed = editingDispatch
      ? updateDispatchSchema.safeParse(rawPayload)
      : dispatchFormSchema.safeParse(rawPayload);

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
      const result = editingDispatch
        ? await updateDispatchAction({
            ...rawPayload,
            id: editingDispatch.id,
          })
        : await createDispatchAction(rawPayload);

      if (!result.success || !result.data) {
        setServerError(result.error ?? "Unable to save dispatch.");
        return;
      }

      if (!editingDispatch) {
        setIdempotencyKey(createIdempotencyKey());
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

      {/* Dispatch Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="dispatch-date" className="text-base">
            Dispatch Date *
          </Label>
          <Input
            id="dispatch-date"
            type="date"
            value={form.dispatchDate}
            onChange={(e) => updateField("dispatchDate", e.target.value)}
          />
          {fieldErrors.dispatchDate && (
            <p className="text-sm text-red-600">{fieldErrors.dispatchDate}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-base">Destination Branch *</Label>
          <Select
            value={form.branchId}
            onValueChange={(val) => updateField("branchId", val)}
          >
            <SelectTrigger aria-label="Destination Branch">
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
          {fieldErrors.branchId && (
            <p className="text-sm text-red-600">{fieldErrors.branchId}</p>
          )}
        </div>
      </div>

      {/* Quantity, Weights & Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="number-of-jalis" className="text-base">
            Number of Jalis *
          </Label>
          <Input
            id="number-of-jalis"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 5"
            value={form.numberOfJalis}
            onChange={(e) => updateField("numberOfJalis", e.target.value)}
          />
          {fieldErrors.numberOfJalis && (
            <p className="text-sm text-red-600">{fieldErrors.numberOfJalis}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="total-bird-count" className="text-base">
            Total Bird Count *
          </Label>
          <Input
            id="total-bird-count"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 250"
            value={form.totalBirdCount}
            onChange={(e) => updateField("totalBirdCount", e.target.value)}
          />
          {fieldErrors.totalBirdCount && (
            <p className="text-sm text-red-600">{fieldErrors.totalBirdCount}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="live-weight" className="text-base">
            Live Weight (kg) *
          </Label>
          <Input
            id="live-weight"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 500.00"
            value={form.liveWeight}
            onChange={(e) => updateField("liveWeight", e.target.value)}
          />
          {fieldErrors.liveWeight && (
            <p className="text-sm text-red-600">{fieldErrors.liveWeight}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dressed-weight" className="text-base">
            Weight After Dressing (kg)
          </Label>
          <Input
            id="dressed-weight"
            type="text"
            inputMode="decimal"
            placeholder="Optional (kg)"
            value={form.dressedWeight}
            onChange={(e) => updateField("dressedWeight", e.target.value)}
          />
          {fieldErrors.dressedWeight ? (
            <p className="text-sm text-red-600">{fieldErrors.dressedWeight}</p>
          ) : yieldPercent ? (
            <p className="text-xs text-gray-500">Yield: {yieldPercent}%</p>
          ) : (
            <p className="text-xs text-gray-400">Can be added later</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase-rate" className="text-base">
            Rate per kg (₹) *
          </Label>
          <Input
            id="purchase-rate"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 150.00"
            value={form.purchaseRatePerKg}
            onChange={(e) => updateField("purchaseRatePerKg", e.target.value)}
          />
          {fieldErrors.purchaseRatePerKg && (
            <p className="text-sm text-red-600">
              {fieldErrors.purchaseRatePerKg}
            </p>
          )}
        </div>
      </div>

      {/* Total Purchase Amount Breakdown */}
      <div className="rounded-xl border border-[#079B50]/25 bg-[#E9F8EF]/60 px-5 py-4 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-base font-medium text-[#092F2B]">
            <IndianRupee className="h-5 w-5 text-[#079B50]" />
            <span>Total Purchase Amount (Auto)</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#079B50]">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="text-xs sm:text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Live Weight ({liveWeightNum.toFixed(2)} kg ×{" "}
            {formatCurrency(rateNum)}) = {formatCurrency(liveAmount)}
          </span>
          <span>
            + Jali Charge ({jalisNum} × ₹10) = {formatCurrency(jaliCharge)}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="dispatch-notes" className="text-base">
          Notes / Remarks (Optional)
        </Label>
        <Textarea
          id="dispatch-notes"
          placeholder="Any notes about this dispatch..."
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
        />
        {fieldErrors.notes && (
          <p className="text-sm text-red-600">{fieldErrors.notes}</p>
        )}
      </div>

      {!editingDispatch && (
        <label className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FA] p-4 cursor-pointer">
          <Checkbox
            checked={form.markAsReceived}
            onCheckedChange={(checked) =>
              updateField("markAsReceived", checked === true)
            }
            className="mt-0.5"
          />
          <div>
            <p className="text-base font-semibold text-[#17212B]">
              Mark as Received Now
            </p>
            <p className="text-sm text-gray-500">
              Adds {form.totalBirdCount || 0} birds and{" "}
              {effectiveStockWeight.toFixed(2)} kg (
              {hasDressed ? "Weight After Dressing" : "Live Weight"}) to branch
              stock immediately.
            </p>
          </div>
        </label>
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
              Saving Dispatch...
            </>
          ) : editingDispatch ? (
            "Save Changes"
          ) : form.markAsReceived ? (
            "Save & Receive Stock"
          ) : (
            "Record Pending Dispatch"
          )}
        </Button>
      </div>
    </form>
  );

  if (editingDispatch) {
    return formBody;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-[#17212B]">
          New Hen Dispatch
        </CardTitle>
        <p className="text-sm sm:text-base text-gray-500">
          Enter jali count, bird count, live weight, optional weight after
          dressing, and rate.
        </p>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}
