import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { canViewReports } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireCurrentUser();
  if (!canViewReports(user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-[#17212B]">Reports</h2>
      <p className="text-base text-gray-500">
        Financial, stock, and branch reports will be implemented in Phase 7.
      </p>
    </div>
  );
}
