"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ReceiptIndianRupee,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BranchOption } from "@/components/layout/branch-context";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/validations/expense";
import { deleteExpenseAction } from "@/server/actions/expense.actions";
import type {
  ExpenseCategoryDTO,
  ExpenseDTO,
  ExpenseListResult,
} from "@/server/services/expense.service";
import { ExpenseForm } from "./expense-form";

interface ExpenseHistoryProps {
  data: ExpenseListResult;
  branches: BranchOption[];
  categories: ExpenseCategoryDTO[];
  filters: {
    search: string;
    branchId: string;
    categoryId: string;
    paymentMethod: string;
    startDate: string;
    endDate: string;
  };
  onNotify: (type: "success" | "error", message: string) => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
};

export function ExpenseHistory({
  data,
  branches,
  categories,
  filters,
  onNotify,
}: ExpenseHistoryProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [editingExpense, setEditingExpense] = useState<ExpenseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseDTO | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const updateUrlParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string> = {
      tab: "history",
      search: searchInput,
      branchId: filters.branchId,
      categoryId: filters.categoryId,
      paymentMethod: filters.paymentMethod,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: "1",
      ...updates,
    };

    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all" && v !== "ALL" && !(k === "page" && v === "1")) {
        params.set(k, v);
      }
    }

    router.push(`/expenses?${params.toString()}`);
  };

  const resetFilters = () => {
    setSearchInput("");
    router.push("/expenses?tab=history");
  };

  const handleDeleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setDeleteError(null);

    if (deleteReason.trim().length < 3) {
      setDeleteError("Please provide a short reason for removing.");
      return;
    }

    const target = deleteTarget;
    startDeleteTransition(async () => {
      const res = await deleteExpenseAction({
        id: target.id,
        reason: deleteReason.trim(),
      });
      if (!res.success) {
        setDeleteError(res.error ?? "Failed to remove expense.");
        return;
      }
      setDeleteTarget(null);
      setDeleteReason("");
      onNotify(
        "success",
        `Removed ${target.categoryName} expense (${formatCurrency(target.amount)}) for ${target.branchName}.`
      );
      router.refresh();
    });
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const startRow = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const endRow = Math.min(data.total, data.page * data.pageSize);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUrlParams({ search: searchInput });
              }}
              className="md:col-span-2"
            >
              <Label
                htmlFor="expense-search"
                className="text-xs text-gray-500 mb-1 block"
              >
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="expense-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onBlur={() => {
                    if (searchInput !== filters.search) {
                      updateUrlParams({ search: searchInput });
                    }
                  }}
                  placeholder="Category, notes, or branch..."
                  className="pl-10 h-11"
                />
              </div>
            </form>

            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Branch</Label>
              <Select
                value={filters.branchId}
                onValueChange={(val) => updateUrlParams({ branchId: val })}
              >
                <SelectTrigger aria-label="Filter by branch">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  {branches.length > 1 && (
                    <SelectItem value="all">All Branches</SelectItem>
                  )}
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-500 mb-1 block">
                Category
              </Label>
              <Select
                value={filters.categoryId}
                onValueChange={(val) => updateUrlParams({ categoryId: val })}
              >
                <SelectTrigger aria-label="Filter by category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-gray-500 mb-1 block">
                Payment
              </Label>
              <Select
                value={filters.paymentMethod}
                onValueChange={(val) => updateUrlParams({ paymentMethod: val })}
              >
                <SelectTrigger aria-label="Filter by payment method">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Methods</SelectItem>
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="h-11 cursor-pointer"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div>
              <Label
                htmlFor="expense-start-date"
                className="text-xs text-gray-500 mb-1 block"
              >
                From Date
              </Label>
              <Input
                id="expense-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => updateUrlParams({ startDate: e.target.value })}
              />
            </div>
            <div>
              <Label
                htmlFor="expense-end-date"
                className="text-xs text-gray-500 mb-1 block"
              >
                To Date
              </Label>
              <Input
                id="expense-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => updateUrlParams({ endDate: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <div className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F9FA] px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Filtered Total ({data.filteredSummary.count}{" "}
                  {data.filteredSummary.count === 1 ? "entry" : "entries"})
                </span>
                <strong className="text-base text-[#17212B]">
                  {formatCurrency(data.filteredSummary.totalAmount)}
                </strong>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense List */}
      {data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ReceiptIndianRupee className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-[#17212B]">
              No expenses found
            </p>
            <p className="text-base text-gray-500 mt-1">
              Add daily expenses or adjust your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {data.items.map((exp) => (
              <Card key={exp.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge
                        variant="secondary"
                        className="mb-1.5 bg-[#E9F8EF] text-[#092F2B] border border-[#079B50]/20"
                      >
                        {exp.categoryName}
                      </Badge>
                      <p className="text-base font-bold text-[#17212B]">
                        {exp.branchName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(exp.expenseDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">
                        {PAYMENT_LABELS[exp.paymentMethod] ?? exp.paymentMethod}
                      </span>
                      <span className="text-lg font-bold text-[#17212B]">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                  </div>

                  {exp.description && (
                    <p className="text-sm text-gray-600 pt-2 border-t border-gray-100">
                      {exp.description}
                    </p>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingExpense(exp)}
                      className="flex-1 h-10 cursor-pointer"
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeleteReason("");
                        setDeleteError(null);
                        setDeleteTarget(exp);
                      }}
                      className="flex-1 h-10 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm lg:text-base">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F7F9FA]">
                      <th className="text-left py-3.5 px-4 font-medium text-gray-500">
                        Date
                      </th>
                      <th className="text-left py-3.5 px-3 font-medium text-gray-500">
                        Branch
                      </th>
                      <th className="text-left py-3.5 px-3 font-medium text-gray-500">
                        Category
                      </th>
                      <th className="text-left py-3.5 px-3 font-medium text-gray-500">
                        Payment
                      </th>
                      <th className="text-left py-3.5 px-3 font-medium text-gray-500">
                        Notes
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Amount
                      </th>
                      <th className="text-right py-3.5 px-4 font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((exp) => (
                      <tr
                        key={exp.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70"
                      >
                        <td className="py-4 px-4 whitespace-nowrap text-[#17212B]">
                          {formatDate(exp.expenseDate)}
                        </td>
                        <td className="py-4 px-3 font-medium text-[#17212B]">
                          {exp.branchName}
                        </td>
                        <td className="py-4 px-3">
                          <Badge
                            variant="secondary"
                            className="bg-[#E9F8EF] text-[#092F2B] border border-[#079B50]/20"
                          >
                            {exp.categoryName}
                          </Badge>
                        </td>
                        <td className="py-4 px-3 text-gray-600 whitespace-nowrap">
                          {PAYMENT_LABELS[exp.paymentMethod] ?? exp.paymentMethod}
                        </td>
                        <td className="py-4 px-3 text-gray-600 max-w-xs truncate">
                          {exp.description ?? "—"}
                        </td>
                        <td className="py-4 px-3 text-right font-semibold text-[#17212B] whitespace-nowrap">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingExpense(exp)}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDeleteReason("");
                                setDeleteError(null);
                                setDeleteTarget(exp);
                              }}
                              className="text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <p className="text-sm text-gray-600">
              Showing {startRow}–{endRow} of {data.total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() =>
                  updateUrlParams({ page: String(data.page - 1) })
                }
                className="cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm font-medium text-[#17212B] px-2">
                Page {data.page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={data.page >= totalPages}
                onClick={() =>
                  updateUrlParams({ page: String(data.page + 1) })
                }
                className="cursor-pointer"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Edit Expense Dialog */}
      <Dialog
        open={Boolean(editingExpense)}
        onOpenChange={(open) => {
          if (!open) setEditingExpense(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense details and record an audit log entry.
            </DialogDescription>
          </DialogHeader>
          {editingExpense && (
            <ExpenseForm
              branches={branches}
              categories={categories}
              editingExpense={editingExpense}
              onCancel={() => setEditingExpense(null)}
              onEditSuccess={(updated) => {
                setEditingExpense(null);
                onNotify(
                  "success",
                  `Updated ${updated.categoryName} expense (${formatCurrency(updated.amount)}).`
                );
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Expense Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Expense</DialogTitle>
            <DialogDescription>
              Removing{" "}
              <strong>
                {deleteTarget?.categoryName} (
                {deleteTarget ? formatCurrency(deleteTarget.amount) : ""})
              </strong>{" "}
              for <strong>{deleteTarget?.branchName}</strong> hides it from
              reports and keeps an audit trail.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDeleteSubmit} className="space-y-4">
            {deleteError && (
              <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                {deleteError}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="delete-expense-reason" className="text-base">
                Reason for Removing *
              </Label>
              <Textarea
                id="delete-expense-reason"
                placeholder="e.g. Duplicate entry..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer"
              >
                Keep Expense
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="lg"
                disabled={isDeleting}
                className="cursor-pointer"
              >
                {isDeleting ? "Removing..." : "Confirm Remove"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
