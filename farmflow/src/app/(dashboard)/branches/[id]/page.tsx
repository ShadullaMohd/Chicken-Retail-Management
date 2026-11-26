import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  UserCheck,
  Bird,
  Weight,
  Truck,
  ShoppingCart,
  Receipt,
  CalendarCheck,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { getBranchDetail } from "@/server/services/branch.service";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const branch = await getBranchDetail(id, user);

  if (!branch) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-gray-400 mx-auto" />
            <h2 className="text-2xl font-bold text-[#17212B]">
              Branch Not Accessible
            </h2>
            <p className="text-base text-gray-500">
              This branch could not be found or you do not have permission to
              view its records.
            </p>
            <Button asChild size="lg">
              <Link href="/branches">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Branches
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/branches"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#17212B]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Branches
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-[#17212B]">{branch.name}</h2>
            <span className="rounded-md bg-gray-100 border border-[#E5E7EB] px-2.5 py-0.5 text-sm font-mono text-gray-700">
              {branch.code}
            </span>
            <Badge
              variant="secondary"
              className={
                branch.isActive
                  ? "bg-[#E9F8EF] text-[#079B50] border border-[#079B50]/20"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }
            >
              {branch.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Branch Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-base">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium text-[#17212B]">
                  {branch.address || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-500">Contact Number</p>
                <p className="font-medium text-[#17212B]">
                  {branch.contactNumber || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <UserCheck className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-500">Branch Manager</p>
                <p className="font-medium text-[#17212B]">
                  {branch.managerName ?? "Unassigned"}
                </p>
                {branch.managerEmail && (
                  <p className="text-xs text-gray-500">{branch.managerEmail}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Isolated Branch Stock & Record Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1.5">
              <Bird className="h-4 w-4" />
              <span>Birds in Stock</span>
            </div>
            <p className="text-2xl font-bold text-[#17212B]">
              {branch.currentBirdStock}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1.5">
              <Weight className="h-4 w-4" />
              <span>Weight Stock</span>
            </div>
            <p className="text-2xl font-bold text-[#17212B]">
              {branch.currentWeightStock.toFixed(2)} kg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1.5">
              <Truck className="h-4 w-4" />
              <span>Dispatches</span>
            </div>
            <p className="text-2xl font-bold text-[#17212B]">
              {branch.counts.dispatches}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1.5">
              <ShoppingCart className="h-4 w-4" />
              <span>Retail Sales</span>
            </div>
            <p className="text-2xl font-bold text-[#17212B]">
              {branch.counts.sales}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1.5">
              <Receipt className="h-4 w-4" />
              <span>Expenses</span>
            </div>
            <p className="text-2xl font-bold text-[#17212B]">
              {branch.counts.expenses}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1.5">
              <CalendarCheck className="h-4 w-4" />
              <span>Daily Closings</span>
            </div>
            <p className="text-2xl font-bold text-[#17212B]">
              {branch.counts.dailyClosings}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Staff & Module Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#17212B]">
              Assigned Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            {branch.assignedStaff.length === 0 ? (
              <p className="text-base text-gray-500">
                No staff members explicitly assigned to this branch yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {branch.assignedStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-base font-semibold text-[#17212B]">
                        {staff.name}
                      </p>
                      <p className="text-sm text-gray-500">{staff.email}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-[#17212B]"
                    >
                      {ROLE_LABELS[staff.role as Role] ?? staff.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#17212B]">
              Branch Operations
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="justify-start h-12"
            >
              <Link href="/dispatch">
                <Truck className="mr-2.5 h-5 w-5 text-[#F59E0B]" />
                Hen Dispatches
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="justify-start h-12"
            >
              <Link href="/sales">
                <ShoppingCart className="mr-2.5 h-5 w-5 text-[#079B50]" />
                Retail Sales
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="justify-start h-12"
            >
              <Link href="/expenses">
                <Receipt className="mr-2.5 h-5 w-5 text-gray-500" />
                Branch Expenses
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="justify-start h-12"
            >
              <Link href="/reports">
                <Building2 className="mr-2.5 h-5 w-5 text-gray-500" />
                Branch Reports
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
