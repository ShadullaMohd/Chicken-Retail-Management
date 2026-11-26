import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { canManageBranches } from "@/lib/permissions";
import {
  getAuthorizedBranches,
  getAvailableManagers,
} from "@/server/services/branch.service";
import { BranchesClient } from "@/components/branches/branches-client";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const user = await requireCurrentUser();

  if (user.role === "SALES_EMPLOYEE") {
    redirect("/dashboard");
  }

  const canManage = canManageBranches(user.role);
  const [branches, managers] = await Promise.all([
    getAuthorizedBranches(user),
    canManage ? getAvailableManagers(user.businessId) : Promise.resolve([]),
  ]);

  return (
    <BranchesClient
      initialBranches={branches}
      managers={managers}
      canManage={canManage}
    />
  );
}
