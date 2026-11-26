import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth/session";
import { canManageExpenses } from "@/lib/permissions";
import { getAuthorizedBranches } from "@/server/services/branch.service";
import {
  getExpenseCategories,
  getExpenses,
} from "@/server/services/expense.service";
import { ExpensesClient } from "@/components/expenses/expenses-client";

export const dynamic = "force-dynamic";

const VALID_PAYMENT_METHODS = new Set([
  "ALL",
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "OTHER",
]);

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    branchId?: string;
    categoryId?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}) {
  const user = await requireCurrentUser();
  if (!canManageExpenses(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const cookieStore = await cookies();

  const cookieBranchId = cookieStore.get("farmflow_branch_id")?.value ?? "all";
  const referenceDate = cookieStore.get("farmflow_date")?.value;

  const [authorizedBranches, categories] = await Promise.all([
    getAuthorizedBranches(user, { activeOnly: true }),
    getExpenseCategories(user),
  ]);

  const branchOptions = authorizedBranches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    isActive: b.isActive,
  }));

  const selectedBranchFilter =
    params.branchId ??
    (branchOptions.length === 1 ? branchOptions[0].id : cookieBranchId);

  const paymentMethodFilter =
    params.paymentMethod && VALID_PAYMENT_METHODS.has(params.paymentMethod)
      ? (params.paymentMethod as "ALL" | PaymentMethod)
      : "ALL";

  const categoryFilter = params.categoryId ?? "ALL";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const expenseData = await getExpenses(user, {
    search: params.search,
    branchId: selectedBranchFilter,
    categoryId: categoryFilter,
    paymentMethod: paymentMethodFilter,
    startDate: params.startDate,
    endDate: params.endDate,
    referenceDate,
    page,
    pageSize: 20,
  });

  const hasFilterQuery = Boolean(
    params.search ||
      params.branchId ||
      params.categoryId ||
      params.paymentMethod ||
      params.startDate ||
      params.endDate ||
      params.page
  );

  const initialTab =
    params.tab === "history" || hasFilterQuery
      ? "history"
      : params.tab === "categories"
      ? "categories"
      : "new";

  return (
    <ExpensesClient
      initialTab={initialTab}
      branches={branchOptions}
      initialCategories={categories}
      expenseData={expenseData}
      filters={{
        search: params.search ?? "",
        branchId: selectedBranchFilter,
        categoryId: categoryFilter,
        paymentMethod: paymentMethodFilter,
        startDate: params.startDate ?? "",
        endDate: params.endDate ?? "",
      }}
    />
  );
}
