import { startOfDay, endOfDay } from "date-fns";
import { MovementType, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { AuthActor } from "@/lib/permissions";
import {
  canAccessAllBranches,
  canAccessBranch,
  canPerformDailyClosing,
} from "@/lib/permissions";
import type {
  DailyClosingValues,
  ReopenDailyClosingValues,
} from "@/lib/validations/closing";
import { recordAuditLog } from "./audit.service";

export interface DailyClosingDTO {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  openingBirdCount: number;
  birdsReceived: number;
  birdsSold: number;
  birdsDeadOrDamaged: number;
  otherBirdAdjustments: number;
  expectedClosingBirdCount: number;
  closingBirdCount: number;
  birdDifference: number;
  openingWeight: number;
  weightReceived: number;
  weightSold: number;
  otherWeightAdjustments: number;
  expectedClosingWeight: number;
  closingWeight: number;
  weightDifference: number;
  openingCashBalance: number;
  totalSalesAmount: number;
  totalExpensesAmount: number;
  totalCashReceived: number;
  cashDeposited: number;
  expectedCashBalance: number;
  closingCashBalance: number;
  cashDifference: number;
  isClosed: boolean;
  closedByName: string | null;
  closedAt: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface DailyClosingPreviewDTO {
  branchId: string;
  branchName: string;
  branchCode: string;
  closingDate: string;
  existingClosing: DailyClosingDTO | null;
  stock: {
    openingBirdCount: number;
    birdsReceived: number;
    birdsSold: number;
    otherBirdAdjustments: number;
    expectedClosingBirdCount: number;
    openingWeight: number;
    weightReceived: number;
    weightSold: number;
    mortalityWeight: number;
    saleLossWeight: number;
    otherWeightAdjustments: number;
    expectedClosingWeight: number;
    suggestedClosingWeight: number;
    latestSaleClosingWeight: number | null;
  };
  cash: {
    previousClosedCashBalance: number;
    totalSalesAmount: number;
    totalCashReceived: number;
    totalExpensesAmount: number;
    cashExpensesAmount: number;
    upiExpensesAmount: number;
    bankOtherExpensesAmount: number;
    expectedCashBeforeDeposit: number;
  };
}

export interface DailyClosingFilterParams {
  branchId?: string;
  status?: "ALL" | "CLOSED" | "REOPENED";
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface DailyClosingListResult {
  items: DailyClosingDTO[];
  total: number;
  page: number;
  pageSize: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseLocalDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parsed = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const closingInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  closedBy: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.DailyClosingInclude;

type ClosingRow = Prisma.DailyClosingGetPayload<{
  include: typeof closingInclude;
}>;

function mapClosingToDTO(row: ClosingRow): DailyClosingDTO {
  return {
    id: row.id,
    date: row.date.toISOString(),
    branchId: row.branchId,
    branchName: row.branch.name,
    branchCode: row.branch.code,
    openingBirdCount: row.openingBirdCount,
    birdsReceived: row.birdsReceived,
    birdsSold: row.birdsSold,
    birdsDeadOrDamaged: row.birdsDeadOrDamaged,
    otherBirdAdjustments: row.otherBirdAdjustments,
    expectedClosingBirdCount: row.expectedClosingBirdCount,
    closingBirdCount: row.closingBirdCount,
    birdDifference: row.birdDifference,
    openingWeight: Number(row.openingWeight),
    weightReceived: Number(row.weightReceived),
    weightSold: Number(row.weightSold),
    otherWeightAdjustments: Number(row.otherWeightAdjustments),
    expectedClosingWeight: Number(row.expectedClosingWeight),
    closingWeight: Number(row.closingWeight),
    weightDifference: Number(row.weightDifference),
    openingCashBalance: Number(row.openingCashBalance),
    totalSalesAmount: Number(row.totalSalesAmount),
    totalExpensesAmount: Number(row.totalExpensesAmount),
    totalCashReceived: Number(row.totalCashReceived),
    cashDeposited: Number(row.cashDeposited),
    expectedCashBalance: Number(row.expectedCashBalance),
    closingCashBalance: Number(row.closingCashBalance),
    cashDifference: Number(row.cashDifference),
    isClosed: row.isClosed,
    closedByName: row.closedBy?.name ?? null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function computeBranchDayNumbers(
  db: Prisma.TransactionClient | typeof prisma,
  branch: {
    id: string;
    currentBirdStock: number;
    currentWeightStock: Prisma.Decimal;
  },
  dateStr: string,
  excludeClosingId?: string
) {
  const targetDate = parseLocalDate(dateStr);
  if (!targetDate) {
    throw new Error("Please select a valid date.");
  }
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  const [
    dayMovements,
    futureMovementsAgg,
    salesAgg,
    latestSaleClosing,
    expenseByMethod,
    previousClosedDay,
  ] = await Promise.all([
    db.stockMovement.findMany({
      where: {
        branchId: branch.id,
        date: { gte: dayStart, lte: dayEnd },
        ...(excludeClosingId
          ? {
              NOT: {
                referenceId: excludeClosingId,
                referenceType: "DailyClosing",
              },
            }
          : {}),
      },
      select: {
        movementType: true,
        birdCount: true,
        weight: true,
        referenceType: true,
      },
    }),
    db.stockMovement.aggregate({
      where: {
        branchId: branch.id,
        date: { gt: dayEnd },
      },
      _sum: {
        birdCount: true,
        weight: true,
      },
    }),
    db.retailSale.aggregate({
      where: {
        branchId: branch.id,
        deletedAt: null,
        saleDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: {
        totalWeightSold: true,
        numberOfBirdsSold: true,
        salesAmount: true,
        cashReceived: true,
      },
    }),
    db.retailSale.findFirst({
      where: {
        branchId: branch.id,
        deletedAt: null,
        closingStockKg: { not: null },
        saleDate: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createdAt: "desc" },
      select: { closingStockKg: true },
    }),
    db.expense.groupBy({
      by: ["paymentMethod"],
      where: {
        branchId: branch.id,
        deletedAt: null,
        expenseDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amount: true },
    }),
    db.dailyClosing.findFirst({
      where: {
        branchId: branch.id,
        isClosed: true,
        date: { lt: dayStart },
      },
      orderBy: { date: "desc" },
      select: { closingCashBalance: true },
    }),
  ]);

  let birdsReceived = 0;
  let birdsSoldMov = 0;
  let otherBirdAdjustments = 0;
  let weightReceived = 0;
  let weightSoldMov = 0;
  let mortalityWeight = 0;
  let saleLossWeight = 0;
  let manualAdjustmentWeight = 0;
  let closingAdjustmentWeight = 0;
  let closingAdjustmentBirds = 0;

  for (const m of dayMovements) {
    const w = Number(m.weight);
    const b = m.birdCount;
    if (m.referenceType === "DailyClosing") {
      closingAdjustmentWeight += w;
      closingAdjustmentBirds += b;
      continue;
    }
    switch (m.movementType) {
      case "DISPATCH_IN":
        weightReceived += w;
        birdsReceived += b;
        break;
      case "SALE_OUT":
        weightSoldMov += -w;
        birdsSoldMov += -b;
        break;
      case "DEAD_DAMAGED":
        mortalityWeight += -w;
        otherBirdAdjustments += b;
        break;
      case "ADJUSTMENT":
        if (m.referenceType === "RetailSaleLoss") {
          saleLossWeight += -w;
        } else {
          manualAdjustmentWeight += w;
        }
        otherBirdAdjustments += b;
        break;
    }
  }

  const futureWeight = Number(futureMovementsAgg._sum.weight ?? 0);
  const futureBirds = Number(futureMovementsAgg._sum.birdCount ?? 0);

  // Actual stock at end of day EXCLUDING any prior adjustment from this same day's closing record
  const stockAtDayEndBeforeThisClosingWeight = round2(
    Number(branch.currentWeightStock) - futureWeight - closingAdjustmentWeight
  );
  const stockAtDayEndBeforeThisClosingBirds =
    branch.currentBirdStock - futureBirds - closingAdjustmentBirds;

  const netDayWeightChange = round2(
    weightReceived -
      weightSoldMov -
      mortalityWeight -
      saleLossWeight +
      manualAdjustmentWeight
  );
  const netDayBirdChange =
    birdsReceived - birdsSoldMov + otherBirdAdjustments;

  const openingWeight = round2(
    stockAtDayEndBeforeThisClosingWeight - netDayWeightChange
  );
  const openingBirdCount =
    stockAtDayEndBeforeThisClosingBirds - netDayBirdChange;

  const totalSalesAmount = round2(Number(salesAgg._sum.salesAmount ?? 0));
  const totalCashReceived = round2(Number(salesAgg._sum.cashReceived ?? 0));

  let cashExpensesAmount = 0;
  let upiExpensesAmount = 0;
  let bankOtherExpensesAmount = 0;
  for (const grp of expenseByMethod) {
    const amt = Number(grp._sum.amount ?? 0);
    if (grp.paymentMethod === "CASH") {
      cashExpensesAmount += amt;
    } else if (grp.paymentMethod === "UPI") {
      upiExpensesAmount += amt;
    } else {
      bankOtherExpensesAmount += amt;
    }
  }

  const totalExpensesAmount = round2(
    cashExpensesAmount + upiExpensesAmount + bankOtherExpensesAmount
  );

  const otherWeightAdjustments = round2(
    -mortalityWeight - saleLossWeight + manualAdjustmentWeight
  );

  const latestSaleClosingWeight =
    latestSaleClosing?.closingStockKg !== null &&
    latestSaleClosing?.closingStockKg !== undefined
      ? round2(Number(latestSaleClosing.closingStockKg))
      : null;

  return {
    dayStart,
    dayEnd,
    targetDate,
    stock: {
      openingBirdCount,
      birdsReceived,
      birdsSold: birdsSoldMov,
      otherBirdAdjustments,
      expectedClosingBirdCount: stockAtDayEndBeforeThisClosingBirds,
      openingWeight,
      weightReceived: round2(weightReceived),
      weightSold: round2(weightSoldMov),
      mortalityWeight: round2(mortalityWeight),
      saleLossWeight: round2(saleLossWeight),
      otherWeightAdjustments,
      expectedClosingWeight: stockAtDayEndBeforeThisClosingWeight,
      suggestedClosingWeight:
        latestSaleClosingWeight ?? stockAtDayEndBeforeThisClosingWeight,
      latestSaleClosingWeight,
    },
    cash: {
      previousClosedCashBalance: round2(
        Number(previousClosedDay?.closingCashBalance ?? 0)
      ),
      totalSalesAmount,
      totalCashReceived,
      totalExpensesAmount,
      cashExpensesAmount: round2(cashExpensesAmount),
      upiExpensesAmount: round2(upiExpensesAmount),
      bankOtherExpensesAmount: round2(bankOtherExpensesAmount),
      expectedCashBeforeDeposit: round2(totalCashReceived - cashExpensesAmount),
    },
  };
}

export async function getDailyClosingPreview(
  actor: AuthActor,
  branchId: string,
  dateStr: string
): Promise<DailyClosingPreviewDTO | null> {
  if (!canPerformDailyClosing(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can access daily closing."
    );
  }

  if (!branchId || branchId === "all") {
    return null;
  }

  if (!canAccessBranch(actor, branchId)) {
    throw new Error("Forbidden: You do not have access to this branch.");
  }

  const targetDate = parseLocalDate(dateStr);
  if (!targetDate) {
    return null;
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      businessId: actor.businessId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
      currentBirdStock: true,
      currentWeightStock: true,
    },
  });

  if (!branch) {
    return null;
  }

  const existingRow = await prisma.dailyClosing.findFirst({
    where: {
      branchId: branch.id,
      date: {
        gte: startOfDay(targetDate),
        lte: endOfDay(targetDate),
      },
    },
    include: closingInclude,
  });

  const computed = await computeBranchDayNumbers(
    prisma,
    branch,
    dateStr,
    existingRow?.id
  );

  return {
    branchId: branch.id,
    branchName: branch.name,
    branchCode: branch.code,
    closingDate: dateStr,
    existingClosing: existingRow ? mapClosingToDTO(existingRow) : null,
    stock: computed.stock,
    cash: computed.cash,
  };
}

export async function getDailyClosings(
  actor: AuthActor,
  filters: DailyClosingFilterParams = {}
): Promise<DailyClosingListResult> {
  if (!canPerformDailyClosing(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can view daily closings."
    );
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));

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
    select: { id: true },
  });

  const allowedIds = allowedBranches.map((b) => b.id);
  const scopedBranchIds =
    filters.branchId &&
    filters.branchId !== "all" &&
    allowedIds.includes(filters.branchId)
      ? [filters.branchId]
      : allowedIds;

  if (scopedBranchIds.length === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  const where: Prisma.DailyClosingWhereInput = {
    branchId: { in: scopedBranchIds },
  };

  if (filters.status === "CLOSED") {
    where.isClosed = true;
  } else if (filters.status === "REOPENED") {
    where.isClosed = false;
  }

  const parsedStart = filters.startDate
    ? parseLocalDate(filters.startDate)
    : null;
  const parsedEnd = filters.endDate ? parseLocalDate(filters.endDate) : null;

  if (parsedStart || parsedEnd) {
    where.date = {
      ...(parsedStart ? { gte: startOfDay(parsedStart) } : {}),
      ...(parsedEnd ? { lte: endOfDay(parsedEnd) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.dailyClosing.count({ where }),
    prisma.dailyClosing.findMany({
      where,
      include: closingInclude,
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(mapClosingToDTO),
    total,
    page,
    pageSize,
  };
}

export async function submitDailyClosing(
  input: DailyClosingValues,
  actor: AuthActor
): Promise<DailyClosingDTO> {
  if (!canPerformDailyClosing(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can perform daily closing."
    );
  }

  if (!canAccessBranch(actor, input.branchId)) {
    throw new Error("Forbidden: You do not have access to this branch.");
  }

  const parsedDate = parseLocalDate(input.closingDate);
  if (!parsedDate) {
    throw new Error("Please select a valid closing date.");
  }

  const saved = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({
      where: {
        id: input.branchId,
        businessId: actor.businessId,
        isActive: true,
      },
      include: {
        business: { select: { allowNegativeStock: true } },
      },
    });

    if (!branch) {
      throw new Error("Selected branch is invalid or inactive.");
    }

    const lockedRows = await tx.$queryRaw<
      { currentBirdStock: number; currentWeightStock: Prisma.Decimal }[]
    >`SELECT "currentBirdStock", "currentWeightStock" FROM "Branch" WHERE "id" = ${branch.id} FOR UPDATE`;

    const lockedBranch = lockedRows[0];
    if (!lockedBranch) {
      throw new Error("Branch not found.");
    }

    const existing = await tx.dailyClosing.findFirst({
      where: {
        branchId: branch.id,
        date: {
          gte: startOfDay(parsedDate),
          lte: endOfDay(parsedDate),
        },
      },
    });

    // Compute live book numbers (excluding prior adjustments on this same closing record)
    const computed = await computeBranchDayNumbers(
      tx,
      {
        id: branch.id,
        currentBirdStock: lockedBranch.currentBirdStock,
        currentWeightStock: lockedBranch.currentWeightStock,
      },
      input.closingDate,
      existing?.id
    );

    const closingWeight = round2(input.closingWeight);
    const closingBirdCount =
      input.closingBirdCount !== undefined
        ? input.closingBirdCount
        : Math.max(0, computed.stock.expectedClosingBirdCount);

    const weightDifference = round2(
      closingWeight - computed.stock.expectedClosingWeight
    );
    const birdDifference =
      closingBirdCount - computed.stock.expectedClosingBirdCount;

    const openingCashBalance = round2(input.openingCashBalance);
    const cashDeposited = round2(input.cashDeposited);
    const closingCashBalance = round2(input.closingCashBalance);
    const expectedCashBalance = round2(
      openingCashBalance +
        computed.cash.totalCashReceived -
        computed.cash.cashExpensesAmount -
        cashDeposited
    );
    const cashDifference = round2(closingCashBalance - expectedCashBalance);

    // Reverse any prior closing stock adjustment before applying the new one
    let prevAdjustWeight = 0;
    let prevAdjustBirds = 0;
    if (existing) {
      const priorMovements = await tx.stockMovement.findMany({
        where: {
          referenceId: existing.id,
          referenceType: "DailyClosing",
        },
        select: { weight: true, birdCount: true },
      });
      for (const pm of priorMovements) {
        prevAdjustWeight += Number(pm.weight);
        prevAdjustBirds += pm.birdCount;
      }
      if (priorMovements.length > 0) {
        await tx.stockMovement.deleteMany({
          where: {
            referenceId: existing.id,
            referenceType: "DailyClosing",
          },
        });
      }
    }

    const netApplyWeight = input.reconcileStock
      ? round2(weightDifference - prevAdjustWeight)
      : round2(-prevAdjustWeight);
    const netApplyBirds = input.reconcileStock
      ? birdDifference - prevAdjustBirds
      : -prevAdjustBirds;

    const resultingWeight = round2(
      Number(lockedBranch.currentWeightStock) + netApplyWeight
    );
    const resultingBirds = lockedBranch.currentBirdStock + netApplyBirds;

    if (
      !branch.business.allowNegativeStock &&
      (resultingWeight < 0 || resultingBirds < 0)
    ) {
      throw new Error(
        `Stock reconciliation would make ${branch.name} negative (${resultingBirds} birds, ${resultingWeight.toFixed(2)} kg).`
      );
    }

    if (netApplyWeight !== 0 || netApplyBirds !== 0) {
      await tx.branch.update({
        where: { id: branch.id },
        data: {
          currentWeightStock: { increment: new Prisma.Decimal(netApplyWeight) },
          currentBirdStock: { increment: netApplyBirds },
        },
      });
    }

    const closingPayload = {
      openingBirdCount: computed.stock.openingBirdCount,
      birdsReceived: computed.stock.birdsReceived,
      birdsSold: computed.stock.birdsSold,
      birdsDeadOrDamaged: 0,
      otherBirdAdjustments: computed.stock.otherBirdAdjustments,
      expectedClosingBirdCount: computed.stock.expectedClosingBirdCount,
      closingBirdCount,
      birdDifference,
      openingWeight: new Prisma.Decimal(computed.stock.openingWeight),
      weightReceived: new Prisma.Decimal(computed.stock.weightReceived),
      weightSold: new Prisma.Decimal(computed.stock.weightSold),
      otherWeightAdjustments: new Prisma.Decimal(
        computed.stock.otherWeightAdjustments
      ),
      expectedClosingWeight: new Prisma.Decimal(
        computed.stock.expectedClosingWeight
      ),
      closingWeight: new Prisma.Decimal(closingWeight),
      weightDifference: new Prisma.Decimal(weightDifference),
      openingCashBalance: new Prisma.Decimal(openingCashBalance),
      totalSalesAmount: new Prisma.Decimal(computed.cash.totalSalesAmount),
      totalExpensesAmount: new Prisma.Decimal(
        computed.cash.totalExpensesAmount
      ),
      totalCashReceived: new Prisma.Decimal(computed.cash.totalCashReceived),
      totalUpiReceived: new Prisma.Decimal(0),
      totalOtherPayment: new Prisma.Decimal(0),
      cashDeposited: new Prisma.Decimal(cashDeposited),
      expectedCashBalance: new Prisma.Decimal(expectedCashBalance),
      closingCashBalance: new Prisma.Decimal(closingCashBalance),
      cashDifference: new Prisma.Decimal(cashDifference),
      isClosed: true,
      closedById: actor.id,
      closedAt: new Date(),
      notes: input.notes ?? null,
    };

    const row = existing
      ? await tx.dailyClosing.update({
          where: { id: existing.id },
          data: closingPayload,
          include: closingInclude,
        })
      : await tx.dailyClosing.create({
          data: {
            date: parsedDate,
            branchId: branch.id,
            ...closingPayload,
          },
          include: closingInclude,
        });

    if (input.reconcileStock && (weightDifference !== 0 || birdDifference !== 0)) {
      await tx.stockMovement.create({
        data: {
          date: parsedDate,
          branchId: branch.id,
          movementType: MovementType.ADJUSTMENT,
          birdCount: birdDifference,
          weight: new Prisma.Decimal(weightDifference),
          referenceId: row.id,
          referenceType: "DailyClosing",
          notes: `Daily closing reconciliation for ${input.closingDate} (${weightDifference.toFixed(2)} kg, ${birdDifference} birds)`,
          createdById: actor.id,
        },
      });
    }

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: branch.id,
      action: existing ? "UPDATE_DAILY_CLOSING" : "CREATE_DAILY_CLOSING",
      entityType: "DailyClosing",
      entityId: row.id,
      newValues: {
        date: input.closingDate,
        closingWeight,
        weightDifference,
        closingBirdCount,
        birdDifference,
        closingCashBalance,
        cashDifference,
      },
    });

    return row;
  });

  return mapClosingToDTO(saved);
}

export async function reopenDailyClosing(
  input: ReopenDailyClosingValues,
  actor: AuthActor
): Promise<DailyClosingDTO> {
  if (!canPerformDailyClosing(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can reopen a daily closing."
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyClosing.findFirst({
      where: {
        id: input.id,
        branch: { businessId: actor.businessId },
      },
      include: {
        branch: {
          include: { business: { select: { allowNegativeStock: true } } },
        },
      },
    });

    if (!existing) {
      throw new Error("Daily closing record not found.");
    }

    if (!canAccessBranch(actor, existing.branchId)) {
      throw new Error("Forbidden: You do not have access to this branch.");
    }

    const lockedRows = await tx.$queryRaw<
      { currentBirdStock: number; currentWeightStock: Prisma.Decimal }[]
    >`SELECT "currentBirdStock", "currentWeightStock" FROM "Branch" WHERE "id" = ${existing.branchId} FOR UPDATE`;

    const lockedBranch = lockedRows[0];
    if (!lockedBranch) {
      throw new Error("Branch not found.");
    }

    const priorMovements = await tx.stockMovement.findMany({
      where: {
        referenceId: existing.id,
        referenceType: "DailyClosing",
      },
      select: { weight: true, birdCount: true },
    });

    let reverseWeight = 0;
    let reverseBirds = 0;
    for (const m of priorMovements) {
      reverseWeight -= Number(m.weight);
      reverseBirds -= m.birdCount;
    }

    if (
      !existing.branch.business.allowNegativeStock &&
      (Number(lockedBranch.currentWeightStock) + reverseWeight < 0 ||
        lockedBranch.currentBirdStock + reverseBirds < 0)
    ) {
      throw new Error(
        "Cannot reverse stock reconciliation because stock has already been used after closing."
      );
    }

    if (priorMovements.length > 0) {
      await tx.stockMovement.deleteMany({
        where: {
          referenceId: existing.id,
          referenceType: "DailyClosing",
        },
      });
      await tx.branch.update({
        where: { id: existing.branchId },
        data: {
          currentWeightStock: { increment: new Prisma.Decimal(reverseWeight) },
          currentBirdStock: { increment: reverseBirds },
        },
      });
    }

    const row = await tx.dailyClosing.update({
      where: { id: existing.id },
      data: {
        isClosed: false,
      },
      include: closingInclude,
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: existing.branchId,
      action: "REOPEN_DAILY_CLOSING",
      entityType: "DailyClosing",
      entityId: existing.id,
      oldValues: { isClosed: true },
      newValues: { isClosed: false, reason: input.reason },
    });

    return row;
  });

  return mapClosingToDTO(updated);
}
