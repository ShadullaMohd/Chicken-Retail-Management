import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { canManageDispatches } from "@/lib/permissions";
import { getDispatchById } from "@/server/services/dispatch.service";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PrintReceiptButton } from "@/components/dispatch/print-receipt-button";

export const dynamic = "force-dynamic";

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "RECEIVED":
      return "bg-[#E9F8EF] text-[#079B50] border border-[#079B50]/20";
    case "PENDING":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    default:
      return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}

export default async function DispatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();

  if (!canManageDispatches(user.role)) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-gray-400 mx-auto" />
            <h2 className="text-2xl font-bold text-[#17212B]">
              Access Restricted
            </h2>
            <Button asChild size="lg">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await getDispatchById(id, user);

  if (!result) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-gray-400 mx-auto" />
            <h2 className="text-2xl font-bold text-[#17212B]">
              Dispatch Not Found
            </h2>
            <p className="text-base text-gray-500">
              This dispatch record does not exist or belongs to another branch.
            </p>
            <Button asChild size="lg">
              <Link href="/dispatch">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dispatches
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { dispatch: d, businessName, businessAddress, businessPhone } = result;
  const liveCost =
    Math.round((d.liveWeight * d.purchaseRatePerKg + Number.EPSILON) * 100) /
    100;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Screen Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dispatch"
          className="inline-flex items-center gap-1.5 text-base font-medium text-gray-600 hover:text-[#17212B]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dispatch History
        </Link>
        <PrintReceiptButton />
      </div>

      {/* Printable Receipt Card */}
      <Card className="print:shadow-none print:border-gray-300">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Receipt Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-[#E5E7EB] pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#079B50]">
                Hen Dispatch Receipt
              </p>
              <h2 className="text-2xl font-bold text-[#17212B] mt-1">
                {businessName}
              </h2>
              {businessAddress && (
                <p className="text-sm text-gray-600 mt-0.5">{businessAddress}</p>
              )}
              {businessPhone && (
                <p className="text-sm text-gray-600">Ph: {businessPhone}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <p className="text-lg font-mono font-bold text-[#17212B]">
                {d.dispatchNumber}
              </p>
              <p className="text-sm text-gray-600">
                Date: {formatDate(d.dispatchDate)}
              </p>
              <Badge
                variant="secondary"
                className={getStatusBadgeClass(d.status)}
              >
                {d.status.charAt(0) + d.status.slice(1).toLowerCase()}
              </Badge>
            </div>
          </div>

          {/* Destination Branch */}
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FA] p-4 space-y-1 text-base">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Destination Branch
            </p>
            <p className="font-bold text-[#17212B]">
              {d.branchName} ({d.branchCode})
            </p>
            {d.branchAddress && (
              <p className="text-sm text-gray-600">{d.branchAddress}</p>
            )}
            {d.branchContact && (
              <p className="text-sm text-gray-600">Ph: {d.branchContact}</p>
            )}
          </div>

          {/* Quantity & Weight Breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-base border border-[#E5E7EB] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#F7F9FA] border-b border-[#E5E7EB]">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Description
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3 px-4 text-gray-600">Number of Jalis</td>
                  <td className="py-3 px-4 text-right font-semibold text-[#17212B]">
                    {d.numberOfJalis}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-600">Total Bird Count</td>
                  <td className="py-3 px-4 text-right font-semibold text-[#17212B]">
                    {d.totalBirdCount} birds
                  </td>
                </tr>
                <tr className="bg-[#F7F9FA]">
                  <td className="py-3.5 px-4 font-semibold text-[#17212B]">
                    Live Weight
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-[#17212B]">
                    {d.liveWeight.toFixed(2)} kg
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-600">
                    Weight After Dressing
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[#17212B]">
                    {d.dressedWeight !== null
                      ? `${d.dressedWeight.toFixed(2)} kg`
                      : "Not entered"}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-600">
                    Purchase Rate per kg
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-[#17212B]">
                    {formatCurrency(d.purchaseRatePerKg)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-600">
                    Live Weight Cost ({d.liveWeight.toFixed(2)} kg ×{" "}
                    {formatCurrency(d.purchaseRatePerKg)})
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-[#17212B]">
                    {formatCurrency(liveCost)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-600">
                    Jali Charge ({d.numberOfJalis} jalis × ₹10)
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-[#17212B]">
                    {formatCurrency(d.jaliCharge)}
                  </td>
                </tr>
                <tr className="bg-[#E9F8EF]/60">
                  <td className="py-4 px-4 text-lg font-bold text-[#092F2B]">
                    Total Purchase Amount
                  </td>
                  <td className="py-4 px-4 text-right text-xl font-bold text-[#079B50]">
                    {formatCurrency(d.totalPurchaseAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {d.notes && (
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F7F9FA] px-4 py-3 text-sm">
              <span className="font-semibold text-gray-600">Notes: </span>
              <span className="text-[#17212B]">{d.notes}</span>
            </div>
          )}

          {/* Metadata & Signature */}
          <div className="text-xs sm:text-sm text-gray-500 space-y-1 border-t border-[#E5E7EB] pt-4">
            <p>
              Recorded by <span className="font-medium">{d.createdByName}</span>{" "}
              on {formatDateTime(d.createdAt)}
            </p>
            {d.receivedAt && (
              <p>
                Received by{" "}
                <span className="font-medium">
                  {d.receivedByName ?? "Staff"}
                </span>{" "}
                on {formatDateTime(d.receivedAt)}
              </p>
            )}
            {d.cancelledAt && (
              <p className="text-red-600">
                Cancelled on {formatDateTime(d.cancelledAt)}
                {d.cancelReason ? ` — Reason: ${d.cancelReason}` : ""}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8 text-sm text-gray-600">
            <div className="border-t border-gray-300 pt-2 text-center">
              Dispatched By
            </div>
            <div className="border-t border-gray-300 pt-2 text-center">
              Branch Receiver Signature
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
