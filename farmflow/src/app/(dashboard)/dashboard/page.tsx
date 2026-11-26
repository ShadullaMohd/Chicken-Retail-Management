import { cookies } from "next/headers";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  getDashboardData,
  type DashboardPeriod,
} from "@/server/services/dashboard.service";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

const VALID_PERIODS: DashboardPeriod[] = [
  "today",
  "7days",
  "30days",
  "thisMonth",
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const cookieStore = await cookies();

  const branchId = cookieStore.get("farmflow_branch_id")?.value ?? "all";
  const referenceDate = cookieStore.get("farmflow_date")?.value;
  const period = VALID_PERIODS.includes(params.period as DashboardPeriod)
    ? (params.period as DashboardPeriod)
    : "today";

  const data = await getDashboardData(user, {
    branchId,
    period,
    referenceDate,
  });

  return <DashboardClient data={data} userRole={user.role} />;
}
