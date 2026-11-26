import { startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import prisma from "@/lib/db";
import type { AuthActor } from "@/lib/permissions";
import { canAccessAllBranches } from "@/lib/permissions";

export type DashboardPeriod = "today" | "7days" | "30days" | "thisMonth";

export interface DashboardBranchMetric {
  branchId: string;
  name: string;
  code: string;
  isActive: boolean;
  sales: number;
  purchaseCost: number;
  expenses: number;
  netProfit: number;
  remainingBirds: number;
  remainingWeightKg: number;
}

export interface DashboardDispatchRow {
  id: string;
  dispatchNumber: string;
  date: string;
  branchId: string;
  branch: string;
  jalis: number;
  birds: number;
  liveWeightKg: number;
  dressedWeightKg: number | null;
  cost: number;
  status: "PENDING" | "RECEIVED" | "CANCELLED";
}

export interface DashboardSnapshot {
  birdsSold: number;
  weightSoldKg: number;
  avgPricePerKg: number;
  tokensIssued: number;
  remainingBirds: number;
}

export interface DashboardData {
  period: DashboardPeriod;
  totalSales: number;
  purchaseCost: number;
  expenses: number;
  netProfit: number;
  branches: DashboardBranchMetric[];
  recentDispatches: DashboardDispatchRow[];
  todaySnapshot: DashboardSnapshot;
}

function getDateRange(period: DashboardPeriod, referenceDate?: string): {
  start: Date;
  end: Date;
} {
  const baseDate = referenceDate ? new Date(`${referenceDate}T12:00:00`) : new Date();
  const validBase = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const end = endOfDay(validBase);

  switch (period) {
    case "today":
      return { start: startOfDay(validBase), end };
    case "7days":
      return { start: startOfDay(subDays(validBase, 6)), end };
    case "30days":
      return { start: startOfDay(subDays(validBase, 29)), end };
    case "thisMonth":
      return { start: startOfMonth(validBase), end };
  }
}

export async function getDashboardData(
  actor: AuthActor,
  options?: {
    branchId?: string;
    period?: DashboardPeriod;
    referenceDate?: string;
  }
): Promise<DashboardData> {
  const period = options?.period ?? "today";
  const { start, end } = getDateRange(period, options?.referenceDate);
  const todayStart = startOfDay(
    options?.referenceDate
      ? new Date(`${options.referenceDate}T12:00:00`)
      : new Date()
  );
  const todayEnd = endOfDay(todayStart);

  const allowedBranches = await prisma.branch.findMany({
    where: {
      businessId: actor.businessId,
      ...(!canAccessAllBranches(actor.role)
        ? {
            id: {
              in: actor.branchIds.length > 0 ? actor.branchIds : ["__none__"],
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      currentBirdStock: true,
      currentWeightStock: true,
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  const allowedIds = allowedBranches.map((b) => b.id);
  const requestedBranchId = options?.branchId;
  const scopedBranchIds =
    requestedBranchId &&
    requestedBranchId !== "all" &&
    allowedIds.includes(requestedBranchId)
      ? [requestedBranchId]
      : allowedIds;

  if (scopedBranchIds.length === 0) {
    return {
      period,
      totalSales: 0,
      purchaseCost: 0,
      expenses: 0,
      netProfit: 0,
      branches: [],
      recentDispatches: [],
      todaySnapshot: {
        birdsSold: 0,
        weightSoldKg: 0,
        avgPricePerKg: 0,
        tokensIssued: 0,
        remainingBirds: 0,
      },
    };
  }

  const [
    salesByBranch,
    dispatchesByBranch,
    expensesByBranch,
    todaySalesAgg,
    recentDispatches,
  ] = await Promise.all([
    prisma.retailSale.groupBy({
      by: ["branchId"],
      where: {
        branchId: { in: scopedBranchIds },
        deletedAt: null,
        saleDate: { gte: start, lte: end },
      },
      _sum: { salesAmount: true },
    }),
    prisma.henDispatch.groupBy({
      by: ["branchId"],
      where: {
        branchId: { in: scopedBranchIds },
        deletedAt: null,
        status: { not: "CANCELLED" },
        dispatchDate: { gte: start, lte: end },
      },
      _sum: { totalPurchaseAmount: true },
    }),
    prisma.expense.groupBy({
      by: ["branchId"],
      where: {
        branchId: { in: scopedBranchIds },
        deletedAt: null,
        expenseDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.retailSale.aggregate({
      where: {
        branchId: { in: scopedBranchIds },
        deletedAt: null,
        saleDate: { gte: todayStart, lte: todayEnd },
      },
      _sum: {
        numberOfBirdsSold: true,
        totalWeightSold: true,
        salesAmount: true,
        tokensIssued: true,
      },
    }),
    prisma.henDispatch.findMany({
      where: {
        branchId: { in: scopedBranchIds },
        deletedAt: null,
      },
      include: {
        branch: { select: { name: true } },
      },
      orderBy: [{ dispatchDate: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);

  const salesMap = new Map(
    salesByBranch.map((row) => [row.branchId, Number(row._sum.salesAmount ?? 0)])
  );
  const purchaseMap = new Map(
    dispatchesByBranch.map((row) => [
      row.branchId,
      Number(row._sum.totalPurchaseAmount ?? 0),
    ])
  );
  const expenseMap = new Map(
    expensesByBranch.map((row) => [row.branchId, Number(row._sum.amount ?? 0)])
  );

  const branchMetrics: DashboardBranchMetric[] = allowedBranches.map((b) => {
    const bSales = salesMap.get(b.id) ?? 0;
    const bPurchase = purchaseMap.get(b.id) ?? 0;
    const bExpenses = expenseMap.get(b.id) ?? 0;
    return {
      branchId: b.id,
      name: b.name,
      code: b.code,
      isActive: b.isActive,
      sales: bSales,
      purchaseCost: bPurchase,
      expenses: bExpenses,
      netProfit: bSales - bPurchase - bExpenses,
      remainingBirds: b.currentBirdStock,
      remainingWeightKg: Number(b.currentWeightStock),
    };
  });

  const scopedMetrics = branchMetrics.filter((m) =>
    scopedBranchIds.includes(m.branchId)
  );

  const totalSales = scopedMetrics.reduce((s, b) => s + b.sales, 0);
  const purchaseCost = scopedMetrics.reduce((s, b) => s + b.purchaseCost, 0);
  const expenses = scopedMetrics.reduce((s, b) => s + b.expenses, 0);
  const netProfit = totalSales - purchaseCost - expenses;

  const birdsSoldToday = Number(todaySalesAgg._sum.numberOfBirdsSold ?? 0);
  const weightSoldToday = Number(todaySalesAgg._sum.totalWeightSold ?? 0);
  const salesAmountToday = Number(todaySalesAgg._sum.salesAmount ?? 0);
  const tokensIssuedToday = Number(todaySalesAgg._sum.tokensIssued ?? 0);
  const remainingBirds = scopedMetrics.reduce(
    (s, b) => s + b.remainingBirds,
    0
  );

  return {
    period,
    totalSales,
    purchaseCost,
    expenses,
    netProfit,
    branches: branchMetrics,
    recentDispatches: recentDispatches.map((d) => ({
      id: d.id,
      dispatchNumber: d.dispatchNumber,
      date: d.dispatchDate.toISOString(),
      branchId: d.branchId,
      branch: d.branch.name,
      jalis: d.numberOfJalis,
      birds: d.totalBirdCount,
      liveWeightKg: Number(d.netWeight),
      dressedWeightKg: d.dressedWeight !== null ? Number(d.dressedWeight) : null,
      cost: Number(d.totalPurchaseAmount),
      status: d.status,
    })),
    todaySnapshot: {
      birdsSold: birdsSoldToday,
      weightSoldKg: weightSoldToday,
      avgPricePerKg:
        weightSoldToday > 0 ? salesAmountToday / weightSoldToday : 0,
      tokensIssued: tokensIssuedToday,
      remainingBirds,
    },
  };
}
