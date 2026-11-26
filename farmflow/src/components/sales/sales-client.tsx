"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Plus,
  ShoppingCart,
  History,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { SalesListResult } from "@/server/services/sale.service";
import { SaleForm, type BranchStockOption } from "./sale-form";
import { SalesHistory } from "./sales-history";

type SalesTab = "new" | "history";

interface SalesClientProps {
  initialTab: SalesTab;
  branches: BranchStockOption[];
  salesData: SalesListResult;
  userRole: Role;
  filters: {
    search: string;
    branchId: string;
    startDate: string;
    endDate: string;
  };
}

export function SalesClient({
  initialTab,
  branches,
  salesData,
  userRole,
  filters,
}: SalesClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SalesTab>(initialTab);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { todaySummary } = salesData;

  const summaryItems = [
    {
      label: "Retailed Sale Cash",
      value: formatCurrency(todaySummary.retailedSaleCash),
      highlight: true,
    },
    {
      label: "Retail Sale (kg)",
      value: `${todaySummary.retailSaleKg.toFixed(2)} kg`,
      highlight: false,
    },
    {
      label: "Avg Rate / kg",
      value: `${formatCurrency(todaySummary.avgRatePerKg)}/kg`,
      highlight: false,
    },
    {
      label: "Birds Sold",
      value: String(todaySummary.birdsSold),
      highlight: false,
    },
    {
      label: "Tokens Issued",
      value: String(todaySummary.tokensIssued),
      highlight: false,
    },
    {
      label: "Mortality Weight",
      value: `${todaySummary.mortalityWeightKg.toFixed(2)} kg`,
      highlight: false,
    },
    {
      label: "Closing Stock",
      value:
        todaySummary.latestClosingStockKg !== null
          ? `${todaySummary.latestClosingStockKg.toFixed(2)} kg`
          : "—",
      highlight: false,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Quick CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#17212B]">Retail Sales</h2>
          <p className="text-base text-gray-500 mt-0.5">
            Record daily retail sales, retailed sale cash, closing stock, and
            mortality weight
          </p>
        </div>

        {activeTab !== "new" && (
          <Button
            type="button"
            size="lg"
            onClick={() => {
              setFeedback(null);
              setActiveTab("new");
            }}
            className="h-12 text-base font-semibold cursor-pointer"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Sale
          </Button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-base ${
            feedback.type === "success"
              ? "border-[#079B50]/30 bg-[#E9F8EF] text-[#092F2B]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-[#079B50] shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Today's Sales Summary Strip */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Today&apos;s Sales Summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FA] p-3"
              >
                <p className="text-xs text-gray-500">{item.label}</p>
                <p
                  className={`text-base sm:text-lg font-bold mt-1 ${
                    item.highlight ? "text-[#079B50]" : "text-[#17212B]"
                  }`}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section Switcher */}
      <div className="inline-flex flex-wrap rounded-xl bg-gray-200/70 p-1 w-full sm:w-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm sm:text-base rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "new"
              ? "bg-white text-[#17212B] shadow-sm"
              : "text-gray-600 hover:text-[#17212B]"
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>New Sale</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm sm:text-base rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "history"
              ? "bg-white text-[#17212B] shadow-sm"
              : "text-gray-600 hover:text-[#17212B]"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Sales History</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {salesData.total}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "new" && (
        <SaleForm
          branches={branches}
          onSuccess={(created) => {
            setFeedback({
              type: "success",
              message: `Sale ${created.saleNumber} recorded for ${created.branchName} (${created.totalWeightSold.toFixed(2)} kg, ${formatCurrency(created.retailedSaleCash)}).`,
            });
            router.refresh();
          }}
        />
      )}

      {activeTab === "history" && (
        <SalesHistory
          data={salesData}
          branches={branches}
          userRole={userRole}
          filters={filters}
          onNotify={(type, message) => setFeedback({ type, message })}
        />
      )}
    </div>
  );
}
