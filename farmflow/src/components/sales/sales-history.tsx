"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { voidSaleAction } from "@/server/actions/sale.actions";
import type { SaleDTO, SalesListResult } from "@/server/services/sale.service";
import { SaleForm, type BranchStockOption } from "./sale-form";

interface SalesHistoryProps {
  data: SalesListResult;
  branches: BranchStockOption[];
  userRole: Role;
  filters: {
    search: string;
    branchId: string;
    startDate: string;
    endDate: string;
  };
  onNotify: (type: "success" | "error", message: string) => void;
}

export function SalesHistory({
  data,
  branches,
  userRole,
  filters,
  onNotify,
}: SalesHistoryProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [editingSale, setEditingSale] = useState<SaleDTO | null>(null);
  const [voidTarget, setVoidTarget] = useState<SaleDTO | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, startVoidTransition] = useTransition();

  const canCorrectOrVoid = userRole === "OWNER" || userRole === "BRANCH_MANAGER";

  const updateUrlParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string> = {
      tab: "history",
      search: searchInput,
      branchId: filters.branchId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: "1",
      ...updates,
    };

    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all" && !(k === "page" && v === "1")) {
        params.set(k, v);
      }
    }

    router.push(`/sales?${params.toString()}`);
  };

  const resetFilters = () => {
    setSearchInput("");
    router.push("/sales?tab=history");
  };

  const handleVoidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    setVoidError(null);

    if (voidReason.trim().length < 3) {
      setVoidError("Please provide a short reason for voiding.");
      return;
    }

    const target = voidTarget;
    startVoidTransition(async () => {
      const result = await voidSaleAction({
        id: target.id,
        reason: voidReason.trim(),
      });
      if (!result.success) {
        setVoidError(result.error ?? "Failed to void sale.");
        return;
      }
      setVoidTarget(null);
      setVoidReason("");
      onNotify(
        "success",
        `Sale ${target.saleNumber} voided and stock restored to ${target.branchName}.`
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
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUrlParams({ search: searchInput });
              }}
              className="relative md:col-span-2"
            >
              <Label
                htmlFor="sales-search"
                className="text-xs text-gray-500 mb-1 block"
              >
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="sales-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onBlur={() => {
                    if (searchInput !== filters.search) {
                      updateUrlParams({ search: searchInput });
                    }
                  }}
                  placeholder="Sale ID or branch..."
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
              <Label
                htmlFor="sales-start-date"
                className="text-xs text-gray-500 mb-1 block"
              >
                From Date
              </Label>
              <Input
                id="sales-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => updateUrlParams({ startDate: e.target.value })}
              />
            </div>

            <div>
              <Label
                htmlFor="sales-end-date"
                className="text-xs text-gray-500 mb-1 block"
              >
                To Date
              </Label>
              <Input
                id="sales-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => updateUrlParams({ endDate: e.target.value })}
              />
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
        </CardContent>
      </Card>

      {/* Sales Table / Cards */}
      {data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-[#17212B]">
              No sales recorded yet
            </p>
            <p className="text-base text-gray-500 mt-1">
              Record a retail sale or adjust your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {data.items.map((sale) => (
              <Card key={sale.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-gray-500">
                        {sale.saleNumber}
                      </p>
                      <p className="text-base font-bold text-[#17212B]">
                        {sale.branchName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(sale.saleDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">
                        Retailed Sale Cash
                      </span>
                      <span className="text-lg font-bold text-[#079B50]">
                        {formatCurrency(sale.retailedSaleCash)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-gray-100">
                    <div>
                      <span className="text-gray-500 block">
                        Retail Sale: {sale.totalWeightSold.toFixed(2)} kg
                      </span>
                      <span className="text-gray-600 block">
                        Birds: {sale.numberOfBirdsSold || "—"} &bull; Tokens:{" "}
                        {sale.tokensIssued}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 block">
                        Closing:{" "}
                        {sale.closingStockKg !== null
                          ? `${sale.closingStockKg.toFixed(2)} kg`
                          : "—"}
                      </span>
                      <span className="text-gray-600 block">
                        Mortality: {sale.mortalityWeightKg.toFixed(2)} kg
                      </span>
                    </div>
                  </div>

                  {canCorrectOrVoid && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingSale(sale)}
                        className="flex-1 h-10 cursor-pointer"
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Correct
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVoidReason("");
                          setVoidError(null);
                          setVoidTarget(sale);
                        }}
                        className="flex-1 h-10 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Void
                      </Button>
                    </div>
                  )}
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
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Retail Sale (kg)
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Birds
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Tokens
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Mortality (kg)
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Closing Stock (kg)
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Retailed Sale Cash
                      </th>
                      {canCorrectOrVoid && (
                        <th className="text-right py-3.5 px-4 font-medium text-gray-500">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70"
                      >
                        <td className="py-4 px-4 whitespace-nowrap">
                          <p className="text-[#17212B]">
                            {formatDate(sale.saleDate)}
                          </p>
                          <p className="text-xs font-mono text-gray-400">
                            {sale.saleNumber}
                          </p>
                        </td>
                        <td className="py-4 px-3 font-medium text-[#17212B]">
                          {sale.branchName}
                        </td>
                        <td className="py-4 px-3 text-right text-[#17212B] whitespace-nowrap">
                          {sale.totalWeightSold.toFixed(2)} kg
                        </td>
                        <td className="py-4 px-3 text-right text-[#17212B]">
                          {sale.numberOfBirdsSold > 0
                            ? sale.numberOfBirdsSold
                            : "—"}
                        </td>
                        <td className="py-4 px-3 text-right text-gray-600">
                          {sale.tokensIssued}
                        </td>
                        <td className="py-4 px-3 text-right text-gray-600 whitespace-nowrap">
                          {sale.mortalityWeightKg.toFixed(2)} kg
                        </td>
                        <td className="py-4 px-3 text-right text-[#17212B] whitespace-nowrap">
                          {sale.closingStockKg !== null
                            ? `${sale.closingStockKg.toFixed(2)} kg`
                            : "—"}
                        </td>
                        <td className="py-4 px-3 text-right font-semibold text-[#079B50] whitespace-nowrap">
                          {formatCurrency(sale.retailedSaleCash)}
                        </td>
                        {canCorrectOrVoid && (
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingSale(sale)}
                                className="cursor-pointer"
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Correct
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setVoidReason("");
                                  setVoidError(null);
                                  setVoidTarget(sale);
                                }}
                                className="text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                Void
                              </Button>
                            </div>
                          </td>
                        )}
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

      {/* Correct Sale Dialog */}
      <Dialog
        open={Boolean(editingSale)}
        onOpenChange={(open) => {
          if (!open) setEditingSale(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Correct Sale {editingSale?.saleNumber}</DialogTitle>
            <DialogDescription>
              Updates branch stock and records an audit log entry.
            </DialogDescription>
          </DialogHeader>
          {editingSale && (
            <SaleForm
              branches={branches}
              editingSale={editingSale}
              onCancel={() => setEditingSale(null)}
              onSuccess={(updated) => {
                setEditingSale(null);
                onNotify("success", `Sale ${updated.saleNumber} corrected.`);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Void Sale Dialog */}
      <Dialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Sale {voidTarget?.saleNumber}</DialogTitle>
            <DialogDescription>
              Voiding restores{" "}
              {voidTarget
                ? voidTarget.totalWeightDeducted.toFixed(2)
                : "0.00"}{" "}
              kg
              {voidTarget && voidTarget.numberOfBirdsSold > 0
                ? ` and ${voidTarget.numberOfBirdsSold} birds`
                : ""}{" "}
              back to <strong>{voidTarget?.branchName}</strong> stock and logs
              an audit record.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVoidSubmit} className="space-y-4">
            {voidError && (
              <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                {voidError}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="void-reason" className="text-base">
                Reason for Voiding *
              </Label>
              <Textarea
                id="void-reason"
                placeholder="e.g. Duplicate sale entry..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setVoidTarget(null)}
                className="cursor-pointer"
              >
                Keep Sale
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="lg"
                disabled={isVoiding}
                className="cursor-pointer"
              >
                {isVoiding ? "Voiding..." : "Confirm Void"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
