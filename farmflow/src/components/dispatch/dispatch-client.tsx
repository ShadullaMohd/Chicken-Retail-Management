"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Plus,
  Truck,
  History,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BranchOption } from "@/components/layout/branch-context";
import type { DispatchListResult } from "@/server/services/dispatch.service";
import { DispatchForm } from "./dispatch-form";
import { DispatchHistory } from "./dispatch-history";

type DispatchTab = "history" | "new";

interface DispatchClientProps {
  initialTab: DispatchTab;
  branches: BranchOption[];
  dispatchData: DispatchListResult;
  userRole: Role;
  filters: {
    search: string;
    branchId: string;
    status: string;
    startDate: string;
    endDate: string;
  };
}

export function DispatchClient({
  initialTab,
  branches,
  dispatchData,
  userRole,
  filters,
}: DispatchClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DispatchTab>(initialTab);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
    receiptId?: string;
    receiptNumber?: string;
  } | null>(null);

  const notify = (
    type: "success" | "error",
    message: string,
    receipt?: { id: string; number: string }
  ) => {
    setFeedback({
      type,
      message,
      receiptId: receipt?.id,
      receiptNumber: receipt?.number,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Quick CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#17212B]">Hen Dispatch</h2>
          <p className="text-base text-gray-500 mt-0.5">
            Track poultry dispatches sent to branches
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
            New Dispatch
          </Button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-base ${
            feedback.type === "success"
              ? "border-[#079B50]/30 bg-[#E9F8EF] text-[#092F2B]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-[#079B50] shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>

          {feedback.receiptId && (
            <Button asChild variant="outline" size="sm" className="bg-white">
              <Link href={`/dispatch/${feedback.receiptId}`}>
                Print Receipt ({feedback.receiptNumber})
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Section Switcher */}
      <div className="inline-flex flex-wrap rounded-xl bg-gray-200/70 p-1 w-full sm:w-auto gap-1">
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
          <span>Dispatch History</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {dispatchData.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm sm:text-base rounded-lg font-medium transition-colors cursor-pointer ${
            activeTab === "new"
              ? "bg-white text-[#17212B] shadow-sm"
              : "text-gray-600 hover:text-[#17212B]"
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>New Dispatch</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "new" && (
        <DispatchForm
          branches={branches}
          onCancel={() => setActiveTab("history")}
          onSuccess={(created) => {
            notify(
              "success",
              created.status === "RECEIVED"
                ? `Dispatch ${created.dispatchNumber} recorded & received into ${created.branchName} stock.`
                : `Dispatch ${created.dispatchNumber} recorded as Pending.`,
              { id: created.id, number: created.dispatchNumber }
            );
            setActiveTab("history");
            router.refresh();
          }}
        />
      )}

      {activeTab === "history" && (
        <DispatchHistory
          data={dispatchData}
          branches={branches}
          userRole={userRole}
          filters={filters}
          onNotify={(type, message) => notify(type, message)}
        />
      )}
    </div>
  );
}
