import { cookies } from "next/headers";
import { requireCurrentUser } from "@/lib/auth/session";
import { getAuthorizedBranches } from "@/server/services/branch.service";
import { getSales } from "@/server/services/sale.service";
import { SalesClient } from "@/components/sales/sales-client";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const cookieStore = await cookies();

  const cookieBranchId = cookieStore.get("farmflow_branch_id")?.value ?? "all";
  const referenceDate = cookieStore.get("farmflow_date")?.value;

  const authorizedBranches = await getAuthorizedBranches(user, {
    activeOnly: true,
  });

  const branchOptions = authorizedBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    currentBirdStock: b.currentBirdStock,
    currentWeightStock: b.currentWeightStock,
  }));

  const selectedBranchFilter =
    params.branchId ??
    (branchOptions.length === 1 ? branchOptions[0].id : cookieBranchId);

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const salesData = await getSales(user, {
    search: params.search,
    branchId: selectedBranchFilter,
    startDate: params.startDate,
    endDate: params.endDate,
    referenceDate,
    page,
    pageSize: 20,
  });

  const hasFilterQuery = Boolean(
    params.search ||
      params.branchId ||
      params.startDate ||
      params.endDate ||
      params.page
  );

  const initialTab =
    params.tab === "history" || hasFilterQuery
      ? "history"
      : params.tab === "new"
      ? "new"
      : user.role === "SALES_EMPLOYEE"
      ? "new"
      : "history";

  return (
    <SalesClient
      initialTab={initialTab}
      branches={branchOptions}
      salesData={salesData}
      userRole={user.role}
      filters={{
        search: params.search ?? "",
        branchId: selectedBranchFilter,
        startDate: params.startDate ?? "",
        endDate: params.endDate ?? "",
      }}
    />
  );
}
