"use client";

import { useState, useMemo } from "react";
import {
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ReceiptIndianRupee,
  FolderPlus,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { useBranch, type BranchOption } from "@/components/layout/branch-context";
import type { PaymentMethod } from "@prisma/client";
import {
  PAYMENT_METHOD_OPTIONS,
  createExpensesBulkSchema,
  expenseRowSchema,
  updateExpenseSchema,
} from "@/lib/validations/expense";
import {
  createExpenseCategoryAction,
  createExpensesBulkAction,
  updateExpenseAction,
} from "@/server/actions/expense.actions";
import type {
  BulkCreateExpensesResult,
  ExpenseCategoryDTO,
  ExpenseDTO,
} from "@/server/services/expense.service";

type PaymentMethodValue = PaymentMethod;

interface DraftExpenseRow {
  rowKey: string;
  categoryId: string;
  amount: string;
  paymentMethod: PaymentMethodValue;
  description: string;
}

interface RowErrors {
  categoryId?: string;
  amount?: string;
  paymentMethod?: string;
  description?: string;
}

interface ExpenseFormProps {
  branches: BranchOption[];
  categories: ExpenseCategoryDTO[];
  editingExpense?: ExpenseDTO | null;
  onBulkSuccess?: (result: BulkCreateExpensesResult, branchName: string) => void;
  onEditSuccess?: (expense: ExpenseDTO) => void;
  onCategoryCreated?: (category: ExpenseCategoryDTO) => void;
  onCancel?: () => void;
}

let rowCounter = 1;
function createBlankRow(): DraftExpenseRow {
  rowCounter += 1;
  return {
    rowKey: `row-${Date.now()}-${rowCounter}`,
    categoryId: "",
    amount: "",
    paymentMethod: "CASH",
    description: "",
  };
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRowBlank(row: DraftExpenseRow): boolean {
  return (
    row.categoryId === "" &&
    row.amount.trim() === "" &&
    row.description.trim() === ""
  );
}

function isRowReadyForNext(row: DraftExpenseRow): boolean {
  const amt = parseFloat(row.amount);
  return row.categoryId !== "" && Number.isFinite(amt) && amt > 0;
}

export function ExpenseForm({
  branches,
  categories,
  editingExpense,
  onBulkSuccess,
  onEditSuccess,
  onCategoryCreated,
  onCancel,
}: ExpenseFormProps) {
  const { selectedBranchId, selectedDate } = useBranch();

  const defaultBranchId = useMemo(() => {
    if (editingExpense) return editingExpense.branchId;
    if (
      selectedBranchId !== "all" &&
      branches.some((b) => b.id === selectedBranchId)
    ) {
      return selectedBranchId;
    }
    return branches.length === 1 ? branches[0].id : "";
  }, [editingExpense, selectedBranchId, branches]);

  const activeCategories = useMemo(
    () =>
      categories.filter(
        (c) => c.isActive || (editingExpense && c.id === editingExpense.categoryId)
      ),
    [categories, editingExpense]
  );

  const [expenseDate, setExpenseDate] = useState<string>(() =>
    editingExpense ? editingExpense.expenseDate.slice(0, 10) : selectedDate
  );
  const [branchId, setBranchId] = useState<string>(defaultBranchId);

  const [rows, setRows] = useState<DraftExpenseRow[]>(() =>
    editingExpense
      ? [
          {
            rowKey: editingExpense.id,
            categoryId: editingExpense.categoryId,
            amount: String(editingExpense.amount),
            paymentMethod: editingExpense.paymentMethod,
            description: editingExpense.description ?? "",
          },
        ]
      : [createBlankRow()]
  );

  const [correctionReason, setCorrectionReason] = useState("");
  const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    createIdempotencyKey()
  );

  // Quick add category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [targetRowKeyForCategory, setTargetRowKeyForCategory] = useState<
    string | null
  >(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const batchStats = useMemo(() => {
    let validCount = 0;
    let totalAmount = 0;
    for (const r of rows) {
      if (isRowBlank(r)) continue;
      validCount += 1;
      const num = parseFloat(r.amount);
      if (Number.isFinite(num) && num > 0) {
        totalAmount += num;
      }
    }
    return {
      count: validCount,
      totalAmount: Math.round((totalAmount + Number.EPSILON) * 100) / 100,
    };
  }, [rows]);

  const updateRowField = <K extends keyof DraftExpenseRow>(
    rowKey: string,
    field: K,
    value: DraftExpenseRow[K]
  ) => {
    setRowErrors((prev) => {
      if (!prev[rowKey]?.[field as keyof RowErrors]) return prev;
      const next = { ...prev };
      next[rowKey] = { ...next[rowKey], [field]: undefined };
      return next;
    });

    setRows((prev) => {
      const updated = prev.map((r) =>
        r.rowKey === rowKey ? { ...r, [field]: value } : r
      );

      // In bulk add mode, automatically add the next blank row as soon as the last row has category + amount
      if (!editingExpense && updated.length < 50) {
        const last = updated[updated.length - 1];
        if (last && isRowReadyForNext(last)) {
          return [...updated, createBlankRow()];
        }
      }
      return updated;
    });
  };

  const addManualRow = () => {
    setRows((prev) => {
      if (prev.length >= 50) return prev;
      return [...prev, createBlankRow()];
    });
  };

  const removeRow = (rowKey: string) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });

    setRows((prev) => {
      if (prev.length <= 1) {
        return [createBlankRow()];
      }
      const filtered = prev.filter((r) => r.rowKey !== rowKey);
      return filtered.length === 0 ? [createBlankRow()] : filtered;
    });
  };

  const handleQuickCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(null);
    const trimmed = newCategoryName.trim();
    if (trimmed.length < 2) {
      setCategoryError("Category name must be at least 2 characters.");
      return;
    }

    setIsCreatingCategory(true);
    try {
      const res = await createExpenseCategoryAction({ name: trimmed });
      if (!res.success || !res.data) {
        setCategoryError(res.error ?? "Failed to create category.");
        return;
      }

      onCategoryCreated?.(res.data);
      if (targetRowKeyForCategory) {
        updateRowField(targetRowKeyForCategory, "categoryId", res.data.id);
      }
      setNewCategoryName("");
      setCategoryDialogOpen(false);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeaderErrors({});
    setRowErrors({});
    setServerError(null);

    if (editingExpense) {
      const firstRow = rows[0];
      const payload = {
        id: editingExpense.id,
        expenseDate,
        branchId,
        categoryId: firstRow.categoryId,
        amount: firstRow.amount,
        paymentMethod: firstRow.paymentMethod,
        description: firstRow.description,
        correctionReason,
      };

      const parsed = updateExpenseSchema.safeParse(payload);
      if (!parsed.success) {
        const nextHeader: Record<string, string> = {};
        const nextRowErrs: RowErrors = {};
        for (const issue of parsed.error.issues) {
          const field = String(issue.path[0] ?? "form");
          if (
            field === "categoryId" ||
            field === "amount" ||
            field === "paymentMethod" ||
            field === "description"
          ) {
            if (!nextRowErrs[field]) nextRowErrs[field] = issue.message;
          } else if (!nextHeader[field]) {
            nextHeader[field] = issue.message;
          }
        }
        setHeaderErrors(nextHeader);
        setRowErrors({ [firstRow.rowKey]: nextRowErrs });
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await updateExpenseAction(payload);
        if (!res.success || !res.data) {
          setServerError(res.error ?? "Failed to update expense.");
          return;
        }
        onEditSuccess?.(res.data);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Bulk add mode: skip trailing/completely empty placeholder rows unless ALL rows are blank
    const nonBlankRows = rows.filter((r) => !isRowBlank(r));
    const rowsToValidate = nonBlankRows.length > 0 ? nonBlankRows : [rows[0]];

    const nextHeaderErrors: Record<string, string> = {};
    const nextRowErrors: Record<string, RowErrors> = {};
    let hasErrors = false;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      nextHeaderErrors.expenseDate = "Please choose a valid expense date";
      hasErrors = true;
    }
    if (!branchId.trim()) {
      nextHeaderErrors.branchId = "Please select a branch";
      hasErrors = true;
    }

    for (const r of rowsToValidate) {
      const parsedRow = expenseRowSchema.safeParse({
        categoryId: r.categoryId,
        amount: r.amount,
        paymentMethod: r.paymentMethod,
        description: r.description,
      });
      if (!parsedRow.success) {
        hasErrors = true;
        const errs: RowErrors = {};
        for (const issue of parsedRow.error.issues) {
          const field = String(issue.path[0] ?? "") as keyof RowErrors;
          if (field && !errs[field]) {
            errs[field] = issue.message;
          }
        }
        nextRowErrors[r.rowKey] = errs;
      }
    }

    const bulkPayload = {
      expenseDate,
      branchId,
      rows: rowsToValidate.map((r) => ({
        categoryId: r.categoryId,
        amount: r.amount,
        paymentMethod: r.paymentMethod,
        description: r.description,
      })),
      idempotencyKey,
    };

    if (!hasErrors) {
      const fullParsed = createExpensesBulkSchema.safeParse(bulkPayload);
      if (!fullParsed.success) {
        hasErrors = true;
        setServerError(
          fullParsed.error.issues[0]?.message ?? "Please check your expense rows."
        );
      }
    }

    if (hasErrors) {
      setHeaderErrors(nextHeaderErrors);
      setRowErrors(nextRowErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createExpensesBulkAction(bulkPayload);
      if (!res.success || !res.data) {
        setServerError(res.error ?? "Unable to save expenses.");
        return;
      }

      const branchName =
        branches.find((b) => b.id === branchId)?.name ?? "branch";
      setIdempotencyKey(createIdempotencyKey());
      setRows([createBlankRow()]);
      onBulkSuccess?.(res.data, branchName);
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

      {/* Shared Expense Date & Branch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="expense-date" className="text-base">
            Expense Date *
          </Label>
          <Input
            id="expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => {
              setExpenseDate(e.target.value);
              setHeaderErrors((prev) => ({ ...prev, expenseDate: "" }));
            }}
          />
          {headerErrors.expenseDate && (
            <p className="text-sm text-red-600">{headerErrors.expenseDate}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-base">Branch *</Label>
          <Select
            value={branchId}
            onValueChange={(val) => {
              setBranchId(val);
              setHeaderErrors((prev) => ({ ...prev, branchId: "" }));
            }}
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
          {headerErrors.branchId && (
            <p className="text-sm text-red-600">{headerErrors.branchId}</p>
          )}
        </div>
      </div>

      {/* Expense Rows */}
      <div className="space-y-3">
        {!editingExpense && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#17212B]">
                Expense Items
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                Fill category and amount — a new row appears automatically when
                you add each item.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTargetRowKeyForCategory(rows[rows.length - 1]?.rowKey ?? null);
                setCategoryError(null);
                setNewCategoryName("");
                setCategoryDialogOpen(true);
              }}
              className="self-start sm:self-auto cursor-pointer"
            >
              <FolderPlus className="mr-1.5 h-4 w-4 text-[#079B50]" />
              New Category
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row, index) => {
            const errs = rowErrors[row.rowKey] ?? {};
            const canRemove =
              !editingExpense && (rows.length > 1 || !isRowBlank(row));

            return (
              <div
                key={row.rowKey}
                data-testid={`expense-row-${index}`}
                className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FA]/70 p-3.5 sm:p-4 space-y-3"
              >
                {!editingExpense && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Expense #{index + 1}
                    </span>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.rowKey)}
                        aria-label={`Remove expense row ${index + 1}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                  {/* Category */}
                  <div className="lg:col-span-4 space-y-1">
                    <Label
                      htmlFor={`expense-category-${index}`}
                      className="text-sm text-gray-700"
                    >
                      Category *
                    </Label>
                    <Select
                      value={row.categoryId}
                      onValueChange={(val) =>
                        updateRowField(row.rowKey, "categoryId", val)
                      }
                    >
                      <SelectTrigger
                        id={`expense-category-${index}`}
                        aria-label={`Category for row ${index + 1}`}
                        className="bg-white"
                      >
                        <SelectValue placeholder="Choose category" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errs.categoryId && (
                      <p className="text-xs text-red-600">{errs.categoryId}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="lg:col-span-3 space-y-1">
                    <Label
                      htmlFor={`expense-amount-${index}`}
                      className="text-sm text-gray-700"
                    >
                      Amount (₹) *
                    </Label>
                    <Input
                      id={`expense-amount-${index}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 500"
                      value={row.amount}
                      onChange={(e) =>
                        updateRowField(row.rowKey, "amount", e.target.value)
                      }
                      className="bg-white"
                    />
                    {errs.amount && (
                      <p className="text-xs text-red-600">{errs.amount}</p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="lg:col-span-2 space-y-1">
                    <Label
                      htmlFor={`expense-payment-${index}`}
                      className="text-sm text-gray-700"
                    >
                      Payment *
                    </Label>
                    <Select
                      value={row.paymentMethod}
                      onValueChange={(val) =>
                        updateRowField(
                          row.rowKey,
                          "paymentMethod",
                          val as PaymentMethodValue
                        )
                      }
                    >
                      <SelectTrigger
                        id={`expense-payment-${index}`}
                        aria-label={`Payment method for row ${index + 1}`}
                        className="bg-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errs.paymentMethod && (
                      <p className="text-xs text-red-600">{errs.paymentMethod}</p>
                    )}
                  </div>

                  {/* Description / Notes */}
                  <div className="lg:col-span-3 space-y-1">
                    <Label
                      htmlFor={`expense-notes-${index}`}
                      className="text-sm text-gray-700"
                    >
                      Notes (Optional)
                    </Label>
                    <Input
                      id={`expense-notes-${index}`}
                      type="text"
                      placeholder="e.g. Ice, fuel, wage..."
                      value={row.description}
                      onChange={(e) =>
                        updateRowField(
                          row.rowKey,
                          "description",
                          e.target.value
                        )
                      }
                      className="bg-white"
                    />
                    {errs.description && (
                      <p className="text-xs text-red-600">{errs.description}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!editingExpense && rows.length < 50 && (
          <Button
            type="button"
            variant="outline"
            onClick={addManualRow}
            className="w-full sm:w-auto h-11 border-dashed cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4 text-[#079B50]" />
            Add Another Expense Row
          </Button>
        )}
      </div>

      {/* Live Batch Total Box (Add Mode) */}
      {!editingExpense && (
        <div className="rounded-xl border border-[#079B50]/25 bg-[#E9F8EF]/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-base font-medium text-[#092F2B]">
            <ReceiptIndianRupee className="h-5 w-5 text-[#079B50]" />
            <span>
              Total Expenses ({batchStats.count}{" "}
              {batchStats.count === 1 ? "item" : "items"})
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#079B50]">
            {formatCurrency(batchStats.totalAmount)}
          </p>
        </div>
      )}

      {/* Correction Reason (Edit Mode) */}
      {editingExpense && (
        <div className="space-y-1.5">
          <Label htmlFor="expense-correction-reason" className="text-base">
            Reason for Edit *
          </Label>
          <Input
            id="expense-correction-reason"
            placeholder="e.g. Corrected bill amount..."
            value={correctionReason}
            onChange={(e) => {
              setCorrectionReason(e.target.value);
              setHeaderErrors((prev) => ({ ...prev, correctionReason: "" }));
            }}
            required
          />
          {headerErrors.correctionReason && (
            <p className="text-sm text-red-600">
              {headerErrors.correctionReason}
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
              Saving...
            </>
          ) : editingExpense ? (
            "Save Changes"
          ) : batchStats.count > 1 ? (
            `Save ${batchStats.count} Expenses`
          ) : (
            "Save Expense"
          )}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {editingExpense ? (
        formBody
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#17212B]">
              Record Daily Expenses
            </CardTitle>
            <p className="text-sm text-gray-500">
              Add one or multiple expenses at once — each completed row unlocks
              the next row automatically.
            </p>
          </CardHeader>
          <CardContent>{formBody}</CardContent>
        </Card>
      )}

      {/* Quick Create Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
            <DialogDescription>
              Create a custom expense category (e.g. Ice Blocks, Diesel, Cleaning).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickCreateCategory} className="space-y-4">
            {categoryError && (
              <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                {categoryError}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="quick-category-name" className="text-base">
                Category Name *
              </Label>
              <Input
                id="quick-category-name"
                placeholder="e.g. Ice Blocks"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingCategory}
                className="cursor-pointer"
              >
                {isCreatingCategory ? "Creating..." : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
