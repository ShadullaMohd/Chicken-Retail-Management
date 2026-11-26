"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ReceiptIndianRupee,
  History,
  Tags,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { BranchOption } from "@/components/layout/branch-context";
import type {
  ExpenseCategoryDTO,
  ExpenseListResult,
} from "@/server/services/expense.service";
import { ExpenseForm } from "./expense-form";
import { ExpenseHistory } from "./expense-history";
import { ExpenseCategoriesPanel } from "./expense-categories-panel";

type ExpenseTab = "new" | "history" | "categories";

interface ExpensesClientProps {
  initialTab: ExpenseTab;
  branches: BranchOption[];
  initialCategories: ExpenseCategoryDTO[];
  expenseData: ExpenseListResult;
  filters: {
    search: string;
    branchId: string;
    categoryId: string;
    paymentMethod: string;
    startDate: string;
    endDate: string;
  };
}

export function ExpensesClient({
  initialTab,
  branches,
  initialCategories,
  expenseData,
  filters,
}: ExpensesClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ExpenseTab>(initialTab);
  const [prevInitialCategories, setPrevInitialCategories] =
    useState<ExpenseCategoryDTO[]>(initialCategories);
  const [categories, setCategories] =
    useState<ExpenseCategoryDTO[]>(initialCategories);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (initialCategories !== prevInitialCategories) {
    setPrevInitialCategories(initialCategories);
    setCategories(initialCategories);
  }

  const upsertCategory = (cat: ExpenseCategoryDTO) => {
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === cat.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = cat;
        return next;
      }
      return [...prev, cat];
    });
  };

  const { todaySummary } = expenseData;

  const summaryItems = [
    {
      label: "Today's Expenses",
      value: formatCurrency(todaySummary.totalAmount),
      highlight: true,
    },
    {
      label: "Entries Today",
      value: String(todaySummary.count),
      highlight: false,
    },
    {
      label: "Cash Paid",
      value: formatCurrency(todaySummary.cashTotal),
      highlight: false,
    },
    {
      label: "UPI Paid",
      value: formatCurrency(todaySummary.upiTotal),
      highlight: false,
    },
    {
      label: "Bank / Other",
      value: formatCurrency(
        todaySummary.bankTransferTotal + todaySummary.otherTotal
      ),
      highlight: false,
    },
  ];

  const activeCategoryCount = categories.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#17212B]">Expenses</h2>
          <p className="text-base text-gray-500 mt-0.5">
            Record multiple daily shop expenses at once and manage categories
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
            Add Expenses
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

      {/* Today's Expense Summary Strip */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Today&apos;s Expense Summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

      {/* Tab Switcher */}
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
          <ReceiptIndianRupee className="h-4 w-4" />
          <span>Add Expenses</span>
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
          <span>Expense History</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {expenseData.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm sm:text-base rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "categories"
              ? "bg-white text-[#17212B] shadow-sm"
              : "text-gray-600 hover:text-[#17212B]"
          }`}
        >
          <Tags className="h-4 w-4" />
          <span>Categories</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {activeCategoryCount}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "new" && (
        <ExpenseForm
          branches={branches}
          categories={categories}
          onCategoryCreated={(cat) => {
            upsertCategory(cat);
            setFeedback({
              type: "success",
              message: `Added category "${cat.name}".`,
            });
          }}
          onBulkSuccess={(result, branchName) => {
            setFeedback({
              type: "success",
              message: `Saved ${result.createdCount} ${
                result.createdCount === 1 ? "expense" : "expenses"
              } totaling ${formatCurrency(result.totalAmount)} for ${branchName}.`,
            });
            router.refresh();
          }}
        />
      )}

      {activeTab === "history" && (
        <ExpenseHistory
          data={expenseData}
          branches={branches}
          categories={categories}
          filters={filters}
          onNotify={(type, message) => setFeedback({ type, message })}
        />
      )}

      {activeTab === "categories" && (
        <ExpenseCategoriesPanel
          categories={categories}
          onCategoryChange={upsertCategory}
          onNotify={(type, message) => setFeedback({ type, message })}
        />
      )}
    </div>
  );
}
