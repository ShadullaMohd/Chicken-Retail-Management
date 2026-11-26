"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DispatchStatus, Role } from "@prisma/client";
import {
  Search,
  Eye,
  Printer,
  CheckCircle2,
  Pencil,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Truck,
  RotateCcw,
  Scale,
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
import {
  cancelDispatchAction,
  receiveDispatchAction,
  updateDressedWeightAction,
} from "@/server/actions/dispatch.actions";
import type {
  DispatchDTO,
  DispatchListResult,
} from "@/server/services/dispatch.service";
import { DispatchForm } from "./dispatch-form";

interface DispatchHistoryProps {
  data: DispatchListResult;
  branches: BranchOption[];
  userRole: Role;
  filters: {
    search: string;
    branchId: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  onNotify: (type: "success" | "error", message: string) => void;
}

function getStatusBadgeClass(status: DispatchStatus) {
  switch (status) {
    case "RECEIVED":
      return "bg-[#E9F8EF] text-[#079B50] border border-[#079B50]/20";
    case "PENDING":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "CANCELLED":
      return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

function formatStatus(status: DispatchStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function DispatchHistory({
  data,
  branches,
  userRole,
  filters,
  onNotify,
}: DispatchHistoryProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [receiveTarget, setReceiveTarget] = useState<DispatchDTO | null>(null);
  const [receiveDressedInput, setReceiveDressedInput] = useState("");
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<DispatchDTO | null>(null);
  const [dressedTarget, setDressedTarget] = useState<DispatchDTO | null>(null);
  const [dressedInput, setDressedInput] = useState("");
  const [dressedError, setDressedError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DispatchDTO | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isMutating, startTransition] = useTransition();

  const updateUrlParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string> = {
      tab: "history",
      search: searchInput,
      branchId: filters.branchId,
      status: filters.status,
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

    router.push(`/dispatch?${params.toString()}`);
  };

  const resetFilters = () => {
    setSearchInput("");
    router.push("/dispatch?tab=history");
  };

  const openReceiveDialog = (d: DispatchDTO) => {
    setReceiveTarget(d);
    setReceiveDressedInput(
      d.dressedWeight !== null ? String(d.dressedWeight) : ""
    );
    setReceiveError(null);
  };

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTarget) return;
    setReceiveError(null);

    const trimmed = receiveDressedInput.trim();
    if (trimmed !== "") {
      const val = Number(trimmed);
      if (!Number.isFinite(val) || val <= 0) {
        setReceiveError("Weight after dressing must be greater than 0.");
        return;
      }
      if (val > receiveTarget.liveWeight) {
        setReceiveError("Weight after dressing cannot exceed live weight.");
        return;
      }
    }

    const target = receiveTarget;
    startTransition(async () => {
      const result = await receiveDispatchAction({
        id: target.id,
        dressedWeight: trimmed === "" ? "" : trimmed,
      });
      if (!result.success || !result.data) {
        setReceiveError(result.error ?? "Failed to mark dispatch received.");
        return;
      }
      setReceiveTarget(null);
      onNotify(
        "success",
        `Dispatch ${target.dispatchNumber} marked Received. Added ${target.totalBirdCount} birds (${result.data.effectiveStockWeight.toFixed(2)} kg) to ${target.branchName}.`
      );
      router.refresh();
    });
  };

  const openDressedModal = (d: DispatchDTO) => {
    setDressedTarget(d);
    setDressedInput(d.dressedWeight !== null ? String(d.dressedWeight) : "");
    setDressedError(null);
  };

  const handleDressedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dressedTarget) return;
    setDressedError(null);

    const val = Number(dressedInput.trim());
    if (!Number.isFinite(val) || val <= 0) {
      setDressedError("Please enter a valid weight after dressing (> 0).");
      return;
    }
    if (val > dressedTarget.liveWeight) {
      setDressedError("Weight after dressing cannot exceed live weight.");
      return;
    }

    const target = dressedTarget;
    startTransition(async () => {
      const result = await updateDressedWeightAction({
        id: target.id,
        dressedWeight: val,
      });
      if (!result.success) {
        setDressedError(result.error ?? "Failed to update dressed weight.");
        return;
      }
      setDressedTarget(null);
      onNotify(
        "success",
        `Updated Weight After Dressing for ${target.dispatchNumber} to ${val.toFixed(2)} kg and adjusted ${target.branchName} stock.`
      );
      router.refresh();
    });
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelError(null);

    if (cancelReason.trim().length < 3) {
      setCancelError("Please enter a short cancellation reason.");
      return;
    }

    const target = cancelTarget;
    startTransition(async () => {
      const result = await cancelDispatchAction({
        id: target.id,
        reason: cancelReason.trim(),
      });
      if (!result.success) {
        setCancelError(result.error ?? "Failed to cancel dispatch.");
        return;
      }
      setCancelTarget(null);
      setCancelReason("");
      onNotify("success", `Dispatch ${target.dispatchNumber} cancelled.`);
      router.refresh();
    });
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const startRow = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const endRow = Math.min(data.total, data.page * data.pageSize);

  return (
    <div className="space-y-5">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-500">
              Active Dispatches
            </p>
            <p className="text-2xl font-bold text-[#17212B] mt-1">
              {data.summary.totalDispatches}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-500">Total Birds</p>
            <p className="text-2xl font-bold text-[#17212B] mt-1">
              {data.summary.totalBirds.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-500">
              Total Live Weight
            </p>
            <p className="text-2xl font-bold text-[#17212B] mt-1">
              {data.summary.totalLiveWeightKg.toFixed(2)} kg
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-500">Purchase Cost</p>
            <p className="text-2xl font-bold text-[#17212B] mt-1">
              {formatCurrency(data.summary.totalPurchaseCost)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUrlParams({ search: searchInput });
              }}
              className="relative md:col-span-2"
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onBlur={() => {
                  if (searchInput !== filters.search) {
                    updateUrlParams({ search: searchInput });
                  }
                }}
                placeholder="Search Dispatch ID, branch, or notes..."
                className="pl-10 h-11"
              />
            </form>

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

            <Select
              value={filters.status}
              onValueChange={(val) => updateUrlParams({ status: val })}
            >
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

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
            <div className="space-y-1">
              <Label
                htmlFor="filter-start-date"
                className="text-xs text-gray-500"
              >
                From Date
              </Label>
              <Input
                id="filter-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => updateUrlParams({ startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-end-date" className="text-xs text-gray-500">
                To Date
              </Label>
              <Input
                id="filter-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => updateUrlParams({ endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dispatch List */}
      {data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-[#17212B]">
              No dispatches found
            </p>
            <p className="text-base text-gray-500 mt-1">
              Record a new hen dispatch or adjust your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {data.items.map((d) => {
              const canCancel =
                d.status === "PENDING" ||
                (d.status === "RECEIVED" && userRole === "OWNER");

              return (
                <Card key={d.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-mono text-gray-500">
                          {d.dispatchNumber}
                        </p>
                        <p className="text-base font-bold text-[#17212B]">
                          {d.branchName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(d.dispatchDate)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={getStatusBadgeClass(d.status)}
                      >
                        {formatStatus(d.status)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-gray-500 block">
                          {d.numberOfJalis} Jalis &bull; {d.totalBirdCount} Birds
                        </span>
                        <span className="font-medium text-[#17212B] block">
                          Live: {d.liveWeight.toFixed(2)} kg
                        </span>
                        <span className="text-gray-600 block">
                          Dressed:{" "}
                          {d.dressedWeight !== null
                            ? `${d.dressedWeight.toFixed(2)} kg`
                            : "Not entered"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block">
                          @ {formatCurrency(d.purchaseRatePerKg)}/kg +{" "}
                          {formatCurrency(d.jaliCharge)}
                        </span>
                        <span className="text-base font-bold text-[#17212B]">
                          {formatCurrency(d.totalPurchaseAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      <Button asChild variant="outline" size="sm" className="h-10">
                        <Link href={`/dispatch/${d.id}`}>
                          <Printer className="mr-1.5 h-4 w-4" />
                          Receipt
                        </Link>
                      </Button>

                      {d.status === "PENDING" && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openReceiveDialog(d)}
                            className="h-10 cursor-pointer"
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            Receive
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTarget(d)}
                            className="h-10 cursor-pointer"
                          >
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit
                          </Button>
                        </>
                      )}

                      {d.status === "RECEIVED" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openDressedModal(d)}
                          className="h-10 cursor-pointer"
                        >
                          <Scale className="mr-1.5 h-4 w-4" />
                          Dressed Wt
                        </Button>
                      )}

                      {canCancel && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCancelReason("");
                            setCancelError(null);
                            setCancelTarget(d);
                          }}
                          className="h-10 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <XCircle className="mr-1.5 h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm lg:text-base">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F7F9FA]">
                      <th className="text-left py-3.5 px-4 font-medium text-gray-500">
                        Dispatch ID
                      </th>
                      <th className="text-left py-3.5 px-3 font-medium text-gray-500">
                        Date
                      </th>
                      <th className="text-left py-3.5 px-3 font-medium text-gray-500">
                        Branch
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Jalis
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Birds
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Live Wt
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Dressed Wt
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Rate/kg
                      </th>
                      <th className="text-right py-3.5 px-3 font-medium text-gray-500">
                        Total Cost
                      </th>
                      <th className="text-center py-3.5 px-3 font-medium text-gray-500">
                        Status
                      </th>
                      <th className="text-right py-3.5 px-4 font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((d) => {
                      const canCancel =
                        d.status === "PENDING" ||
                        (d.status === "RECEIVED" && userRole === "OWNER");

                      return (
                        <tr
                          key={d.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70"
                        >
                          <td className="py-4 px-4 font-mono text-sm font-semibold text-[#17212B]">
                            {d.dispatchNumber}
                          </td>
                          <td className="py-4 px-3 text-gray-600 whitespace-nowrap">
                            {formatDate(d.dispatchDate)}
                          </td>
                          <td className="py-4 px-3 font-medium text-[#17212B]">
                            {d.branchName}
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B]">
                            {d.numberOfJalis}
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B]">
                            {d.totalBirdCount}
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B] whitespace-nowrap">
                            {d.liveWeight.toFixed(2)} kg
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B] whitespace-nowrap">
                            {d.dressedWeight !== null
                              ? `${d.dressedWeight.toFixed(2)} kg`
                              : "—"}
                          </td>
                          <td className="py-4 px-3 text-right text-gray-600 whitespace-nowrap">
                            {formatCurrency(d.purchaseRatePerKg)}
                          </td>
                          <td className="py-4 px-3 text-right font-semibold text-[#17212B] whitespace-nowrap">
                            {formatCurrency(d.totalPurchaseAmount)}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <Badge
                              variant="secondary"
                              className={getStatusBadgeClass(d.status)}
                            >
                              {formatStatus(d.status)}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                title="View & Print Receipt"
                              >
                                <Link href={`/dispatch/${d.id}`}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Link>
                              </Button>

                              {d.status === "PENDING" && (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => openReceiveDialog(d)}
                                    className="cursor-pointer"
                                  >
                                    Receive
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingTarget(d)}
                                    className="cursor-pointer"
                                  >
                                    Edit
                                  </Button>
                                </>
                              )}

                              {d.status === "RECEIVED" && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDressedModal(d)}
                                  className="cursor-pointer"
                                >
                                  Dressed Wt
                                </Button>
                              )}

                              {canCancel && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCancelReason("");
                                    setCancelError(null);
                                    setCancelTarget(d);
                                  }}
                                  className="text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <p className="text-sm text-gray-600">
              Showing {startRow}–{endRow} of {data.total} dispatches
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

      {/* Receive Dispatch Dialog (allows optional dressed weight entry) */}
      <Dialog
        open={Boolean(receiveTarget)}
        onOpenChange={(open) => {
          if (!open) setReceiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Receive Dispatch {receiveTarget?.dispatchNumber}
            </DialogTitle>
            <DialogDescription>
              Adding {receiveTarget?.totalBirdCount} birds (Live Weight:{" "}
              {receiveTarget?.liveWeight.toFixed(2)} kg) to{" "}
              <strong>{receiveTarget?.branchName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReceiveSubmit} className="space-y-4">
            {receiveError && (
              <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                {receiveError}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="receive-dressed-weight" className="text-base">
                Weight After Dressing (kg) (Optional)
              </Label>
              <Input
                id="receive-dressed-weight"
                type="text"
                inputMode="decimal"
                placeholder={`Leave blank to use Live Weight (${receiveTarget?.liveWeight.toFixed(2)} kg)`}
                value={receiveDressedInput}
                onChange={(e) => setReceiveDressedInput(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                If entered, Weight After Dressing will be added to shop weight
                stock; otherwise Live Weight is used until dressed weight is
                entered.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setReceiveTarget(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isMutating}
                className="cursor-pointer"
              >
                {isMutating ? "Receiving..." : "Confirm & Add Stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Dressed Weight Dialog (for Received Dispatches) */}
      <Dialog
        open={Boolean(dressedTarget)}
        onOpenChange={(open) => {
          if (!open) setDressedTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Weight After Dressing — {dressedTarget?.dispatchNumber}
            </DialogTitle>
            <DialogDescription>
              Live Weight: {dressedTarget?.liveWeight.toFixed(2)} kg. Updating
              weight after dressing automatically adjusts{" "}
              <strong>{dressedTarget?.branchName}</strong> weight stock.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDressedSubmit} className="space-y-4">
            {dressedError && (
              <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                {dressedError}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="update-dressed-weight" className="text-base">
                Weight After Dressing (kg) *
              </Label>
              <Input
                id="update-dressed-weight"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 180.00"
                value={dressedInput}
                onChange={(e) => setDressedInput(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setDressedTarget(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isMutating}
                className="cursor-pointer"
              >
                {isMutating ? "Updating..." : "Save Dressed Weight"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Pending Dispatch Dialog */}
      <Dialog
        open={Boolean(editingTarget)}
        onOpenChange={(open) => {
          if (!open) setEditingTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Dispatch {editingTarget?.dispatchNumber}
            </DialogTitle>
            <DialogDescription>
              Update dispatch details while it is still Pending.
            </DialogDescription>
          </DialogHeader>
          {editingTarget && (
            <DispatchForm
              branches={branches}
              editingDispatch={editingTarget}
              onCancel={() => setEditingTarget(null)}
              onSuccess={(updated) => {
                setEditingTarget(null);
                onNotify(
                  "success",
                  `Dispatch ${updated.dispatchNumber} updated.`
                );
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dispatch Dialog */}
      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cancel Dispatch {cancelTarget?.dispatchNumber}
            </DialogTitle>
            <DialogDescription>
              {cancelTarget?.status === "RECEIVED"
                ? `This dispatch was already received. Cancelling will deduct ${cancelTarget.totalBirdCount} birds (${cancelTarget.effectiveStockWeight.toFixed(2)} kg) from ${cancelTarget.branchName} stock.`
                : "Cancelled dispatches remain in history for audit tracking."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCancelSubmit} className="space-y-4">
            {cancelError && (
              <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                {cancelError}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-base">
                Cancellation Reason *
              </Label>
              <Textarea
                id="cancel-reason"
                placeholder="e.g. Wrong entry..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setCancelTarget(null)}
                className="cursor-pointer"
              >
                Keep Dispatch
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="lg"
                disabled={isMutating}
                className="cursor-pointer"
              >
                {isMutating ? "Cancelling..." : "Confirm Cancel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
