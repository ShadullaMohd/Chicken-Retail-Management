import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import {
  BranchProvider,
  type BranchOption,
} from "@/components/layout/branch-context";
import { Navbar } from "@/components/layout/navbar";
import { requireCurrentUser } from "@/lib/auth/session";
import { canAccessAllBranches, ROLE_LABELS } from "@/lib/permissions";
import { getAuthorizedBranches } from "@/server/services/branch.service";
import { getInitials } from "@/lib/utils";

function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  const canViewAll = canAccessAllBranches(user.role);
  const authorizedBranches = await getAuthorizedBranches(user, {
    activeOnly: true,
  });

  const branchOptions: BranchOption[] = authorizedBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    isActive: b.isActive,
  }));

  const cookieStore = await cookies();
  const cookieBranchId = cookieStore.get("farmflow_branch_id")?.value;
  const cookieDate = cookieStore.get("farmflow_date")?.value;

  const validBranchIds = new Set(branchOptions.map((b) => b.id));
  const showAllOption = canViewAll || branchOptions.length > 1;

  let initialBranchId = "all";
  if (cookieBranchId && validBranchIds.has(cookieBranchId)) {
    initialBranchId = cookieBranchId;
  } else if (!showAllOption) {
    initialBranchId = branchOptions[0]?.id ?? "";
  }

  const initialDate =
    cookieDate && /^\d{4}-\d{2}-\d{2}$/.test(cookieDate)
      ? cookieDate
      : getTodayIso();

  return (
    <SidebarProvider>
      <BranchProvider
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roleLabel: ROLE_LABELS[user.role],
          initials: getInitials(user.name),
        }}
        branches={branchOptions}
        canViewAllBranches={canViewAll}
        initialBranchId={initialBranchId}
        initialDate={initialDate}
      >
        <div className="flex min-h-screen bg-[#F7F9FA]">
          <Sidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <Navbar />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </BranchProvider>
    </SidebarProvider>
  );
}
