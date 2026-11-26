import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DispatchStatus } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth/session";
import { canManageDispatches } from "@/lib/permissions";
import { getAuthorizedBranches } from "@/server/services/branch.service";
import { getDispatches } from "@/server/services/dispatch.service";
import { DispatchClient } from "@/components/dispatch/dispatch-client";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["ALL", "PENDING", "RECEIVED", "CANCELLED"]);

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    branchId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}) {
  const user = await requireCurrentUser();
  if (!canManageDispatches(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieBranchId = cookieStore.get("farmflow_branch_id")?.value ?? "all";

  const authorizedBranches = await getAuthorizedBranches(user, {
    activeOnly: true,
  });

  const branchOptions = authorizedBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    isActive: b.isActive,
  }));

  const selectedBranchFilter =
    params.branchId ??
    (branchOptions.length === 1 ? branchOptions[0].id : cookieBranchId);

  const statusFilter =
    params.status && VALID_STATUSES.has(params.status)
      ? (params.status as "ALL" | DispatchStatus)
      : "ALL";

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const dispatchData = await getDispatches(user, {
    search: params.search,
    branchId: selectedBranchFilter,
    status: statusFilter,
    startDate: params.startDate,
    endDate: params.endDate,
    page,
    pageSize: 20,
  });

  const initialTab = params.tab === "new" ? "new" : "history";

  return (
    <DispatchClient
      initialTab={initialTab}
      branches={branchOptions}
      dispatchData={dispatchData}
      userRole={user.role}
      filters={{
        search: params.search ?? "",
        branchId: selectedBranchFilter,
        status: statusFilter,
        startDate: params.startDate ?? "",
        endDate: params.endDate ?? "",
      }}
    />
  );
}
