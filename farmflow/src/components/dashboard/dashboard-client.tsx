"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  IndianRupee,
  Truck,
  Receipt,
  TrendingUp,
  Bird,
  Weight,
  Tag,
  Ticket,
  Package,
  Plus,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useBranch } from "@/components/layout/branch-context";
import type {
  DashboardData,
  DashboardPeriod,
} from "@/server/services/dashboard.service";
import {
  canManageDispatches,
  canManageExpenses,
  canRecordSales,
} from "@/lib/permissions";

const PERIOD_OPTIONS: { label: string; value: DashboardPeriod }[] = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7days" },
  { label: "30 Days", value: "30days" },
  { label: "This Month", value: "thisMonth" },
];

function getDispatchBadgeStyle(status: "PENDING" | "RECEIVED" | "CANCELLED") {
  switch (status) {
    case "RECEIVED":
      return "bg-[#E9F8EF] text-[#079B50] border border-[#079B50]/20";
    case "PENDING":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "CANCELLED":
      return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

function formatStatusLabel(status: "PENDING" | "RECEIVED" | "CANCELLED") {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

interface DashboardClientProps {
  data: DashboardData;
  userRole: Role;
}

export function DashboardClient({ data, userRole }: DashboardClientProps) {
  const router = useRouter();
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    canViewAllBranches,
  } = useBranch();

  const handlePeriodChange = (nextPeriod: DashboardPeriod) => {
    router.replace(`/dashboard?period=${nextPeriod}`);
  };

  const summaryCards = [
    {
      title: "Total Sales",
      amount: data.totalSales,
      icon: IndianRupee,
      isProfit: false,
    },
    {
      title: "Purchase Cost",
      amount: data.purchaseCost,
      icon: Truck,
      isProfit: false,
    },
    {
      title: "Expenses",
      amount: data.expenses,
      icon: Receipt,
      isProfit: false,
    },
    {
      title: "Net Profit",
      amount: data.netProfit,
      icon: TrendingUp,
      isProfit: true,
    },
  ];

  const retailSnapshot = [
    {
      label: "Birds Sold",
      value: String(data.todaySnapshot.birdsSold),
      icon: Bird,
    },
    {
      label: "Weight Sold",
      value: `${data.todaySnapshot.weightSoldKg.toFixed(2)} kg`,
      icon: Weight,
    },
    {
      label: "Avg Price / kg",
      value: formatCurrency(data.todaySnapshot.avgPricePerKg),
      icon: Tag,
    },
    {
      label: "Tokens Issued",
      value: String(data.todaySnapshot.tokensIssued),
      icon: Ticket,
    },
    {
      label: "Remaining Stock",
      value: `${data.todaySnapshot.remainingBirds} birds`,
      icon: Package,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Toolbar: Quick Actions & Period Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap gap-2.5">
          {canRecordSales(userRole) && (
            <Button asChild size="lg" className="h-12 text-base font-semibold">
              <Link href="/sales">
                <Plus className="mr-2 h-5 w-5" />
                New Sale
              </Link>
            </Button>
          )}
          {canManageDispatches(userRole) && (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 text-base font-semibold text-[#17212B] bg-white hover:bg-gray-50"
            >
              <Link href="/dispatch">
                <Plus className="mr-2 h-5 w-5 text-[#F59E0B]" />
                New Dispatch
              </Link>
            </Button>
          )}
          {canManageExpenses(userRole) && (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 text-base font-semibold text-[#17212B] bg-white hover:bg-gray-50"
            >
              <Link href="/expenses">
                <Plus className="mr-2 h-5 w-5 text-gray-500" />
                Add Expense
              </Link>
            </Button>
          )}
        </div>

        {/* Clean Segmented Period Control */}
        <div className="inline-flex rounded-xl bg-gray-200/70 p-1 w-full lg:w-auto">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handlePeriodChange(option.value)}
              className={`flex-1 lg:flex-none px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors cursor-pointer ${
                data.period === option.value
                  ? "bg-white text-[#17212B] shadow-sm"
                  : "text-gray-600 hover:text-[#17212B]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <div>
          Showing records for{" "}
          <span className="font-semibold text-[#17212B]">
            {selectedBranch
              ? selectedBranch.name
              : canViewAllBranches
              ? "All Branches"
              : "Assigned Branches"}
          </span>
          {selectedBranch && (canViewAllBranches || data.branches.length > 1) && (
            <button
              type="button"
              onClick={() => setSelectedBranchId("all")}
              className="ml-2 font-medium text-[#079B50] hover:underline cursor-pointer"
            >
              Reset to all
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-base font-medium text-gray-500">
                      {card.title}
                    </p>
                    <p
                      className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                        card.isProfit ? "text-[#079B50]" : "text-[#17212B]"
                      }`}
                    >
                      {formatCurrency(card.amount)}
                    </p>
                  </div>
                  <div
                    className={`h-11 w-11 shrink-0 rounded-lg flex items-center justify-center ${
                      card.isProfit
                        ? "bg-[#E9F8EF] text-[#079B50]"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Today's Retail Snapshot */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl font-semibold text-[#17212B]">
            Today&apos;s Retail Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {retailSnapshot.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FA] p-4"
                >
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">{stat.label}</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-[#17212B]">
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Branch Overview */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl font-semibold text-[#17212B]">
            Branch Overview
          </CardTitle>
          <p className="text-sm text-gray-500">
            Select a branch to filter dashboard metrics
          </p>
        </CardHeader>
        <CardContent>
          {data.branches.length === 0 ? (
            <p className="text-base text-gray-500 py-4">
              No active branches available.
            </p>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {data.branches.map((branch) => {
                  const isSelected = selectedBranchId === branch.branchId;
                  return (
                    <button
                      key={branch.branchId}
                      type="button"
                      onClick={() =>
                        setSelectedBranchId(isSelected ? "all" : branch.branchId)
                      }
                      className={`w-full text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                        isSelected
                          ? "border-[#079B50] bg-[#E9F8EF]/40"
                          : "border-[#E5E7EB] bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-base font-semibold text-[#17212B]">
                          {branch.name}
                        </span>
                        <span className="text-base font-bold text-[#079B50]">
                          {formatCurrency(branch.netProfit)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-[#F7F9FA] px-3 py-2">
                          <span className="text-gray-500 block">Sales</span>
                          <span className="font-semibold text-[#17212B]">
                            {formatCurrency(branch.sales)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-[#F7F9FA] px-3 py-2">
                          <span className="text-gray-500 block">Expenses</span>
                          <span className="font-semibold text-[#17212B]">
                            {formatCurrency(branch.expenses)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">
                        Branch Name
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">
                        Total Sales
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">
                        Expenses
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">
                        Net Profit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.branches.map((branch) => {
                      const isHighlighted =
                        selectedBranchId === branch.branchId;
                      return (
                        <tr
                          key={branch.branchId}
                          onClick={() =>
                            setSelectedBranchId(
                              isHighlighted ? "all" : branch.branchId
                            )
                          }
                          className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                            isHighlighted
                              ? "bg-[#E9F8EF]/50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="py-4 px-4 font-semibold text-[#17212B]">
                            {branch.name}
                          </td>
                          <td className="py-4 px-4 text-right text-[#17212B]">
                            {formatCurrency(branch.sales)}
                          </td>
                          <td className="py-4 px-4 text-right text-gray-600">
                            {formatCurrency(branch.expenses)}
                          </td>
                          <td className="py-4 px-4 text-right text-[#079B50] font-semibold">
                            {formatCurrency(branch.netProfit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Hen Dispatches */}
      {canManageDispatches(userRole) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-lg sm:text-xl font-semibold text-[#17212B]">
              Recent Hen Dispatches
            </CardTitle>
            <Link
              href="/dispatch"
              className="text-sm sm:text-base font-medium text-[#079B50] hover:underline"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentDispatches.length === 0 ? (
              <p className="text-base text-gray-500 py-4">
                No hen dispatches recorded yet.
              </p>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {data.recentDispatches.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-[#17212B]">
                            {d.branch}
                          </p>
                          <p className="text-sm text-gray-500">
                            {d.dispatchNumber} &bull; {formatDate(d.date)}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={getDispatchBadgeStyle(d.status)}
                        >
                          {formatStatusLabel(d.status)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-gray-100">
                        <div>
                          <span className="text-gray-500 block">Quantity</span>
                          <span className="font-medium text-[#17212B]">
                            {d.jalis} Jalis &bull; {d.birds} Birds
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-500 block">
                            Live: {d.liveWeightKg.toFixed(2)} kg
                            {d.dressedWeightKg !== null
                              ? ` • Dressed: ${d.dressedWeightKg.toFixed(2)} kg`
                              : ""}
                          </span>
                          <span className="font-semibold text-[#17212B] text-base">
                            {formatCurrency(d.cost)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="text-left py-3 px-3 font-medium text-gray-500">
                          Dispatch ID
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-gray-500">
                          Date
                        </th>
                        <th className="text-left py-3 px-3 font-medium text-gray-500">
                          Branch
                        </th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">
                          Jalis
                        </th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">
                          Birds
                        </th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">
                          Live Weight
                        </th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">
                          Dressed Weight
                        </th>
                        <th className="text-right py-3 px-3 font-medium text-gray-500">
                          Purchase Cost
                        </th>
                        <th className="text-center py-3 px-3 font-medium text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentDispatches.map((d) => (
                        <tr
                          key={d.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                        >
                          <td className="py-4 px-3 font-mono text-sm font-semibold text-[#17212B]">
                            {d.dispatchNumber}
                          </td>
                          <td className="py-4 px-3 text-gray-600">
                            {formatDate(d.date)}
                          </td>
                          <td className="py-4 px-3 font-medium text-[#17212B]">
                            {d.branch}
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B]">
                            {d.jalis}
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B]">
                            {d.birds}
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B]">
                            {d.liveWeightKg.toFixed(2)} kg
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B]">
                            {d.dressedWeightKg !== null
                              ? `${d.dressedWeightKg.toFixed(2)} kg`
                              : "—"}
                          </td>
                          <td className="py-4 px-3 text-right text-[#17212B] font-semibold">
                            {formatCurrency(d.cost)}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <Badge
                              variant="secondary"
                              className={getDispatchBadgeStyle(d.status)}
                            >
                              {formatStatusLabel(d.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
