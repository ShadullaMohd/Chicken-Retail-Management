import { startOfDay, endOfDay } from "date-fns";
import { MovementType, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { AuthActor } from "@/lib/permissions";
import { canAccessAllBranches, canAccessBranch } from "@/lib/permissions";
import type {
  SaleFormValues,
  UpdateSaleValues,
  VoidSaleValues,
} from "@/lib/validations/sale";
import { recordAuditLog } from "./audit.service";

export interface SaleDTO {
  id: string;
  saleNumber: string;
  saleDate: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  totalWeightSold: number;
  numberOfBirdsSold: number;
  tokensIssued: number;
  closingStockKg: number | null;
  mortalityWeightKg: number;
  weightLossKg: number | null;
  totalWeightDeducted: number;
  retailedSaleCash: number;
  avgRatePerKg: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleFilterParams {
  search?: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
  referenceDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TodaySalesSummary {
  retailedSaleCash: number;
  retailSaleKg: number;
  birdsSold: number;
  tokensIssued: number;
  avgRatePerKg: number;
  mortalityWeightKg: number;
  latestClosingStockKg: number | null;
}

export interface SalesListResult {
  items: SaleDTO[];
  total: number;
  page: number;
  pageSize: number;
  todaySummary: TodaySalesSummary;
  filteredSummary: {
    count: number;
    totalCash: number;
    totalWeightKg: number;
    totalBirds: number;
    totalMortalityKg: number;
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function computeSaleMetrics(input: {
  totalWeightSold: number;
  cashReceived: number;
  mortalityWeightKg: number;
  closingStockKg?: number;
}) {
  const weightSold = round2(input.totalWeightSold);
  const retailedSaleCash = round2(input.cashReceived);
  const mortalityWeightKg = round2(input.mortalityWeightKg);
  const closingStockKg =
    typeof input.closingStockKg === "number"
      ? round2(input.closingStockKg)
      : null;

  const avgRatePerKg =
    weightSold > 0 ? round2(retailedSaleCash / weightSold) : 0;

  return {
    weightSold,
    retailedSaleCash,
    mortalityWeightKg,
    closingStockKg,
    avgRatePerKg,
  };
}

async function generateSaleNumber(
  tx: Prisma.TransactionClient,
  dateStr: string
): Promise<string> {
  const compactDate = dateStr.replace(/-/g, "").slice(2);
  const prefix = `SAL-${compactDate}-`;

  const existing = await tx.retailSale.count({
    where: {
      saleNumber: { startsWith: prefix },
    },
  });

  const seq = String(existing + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

const saleInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  createdBy: {
    select: { name: true },
  },
} satisfies Prisma.RetailSaleInclude;

type SaleRow = Prisma.RetailSaleGetPayload<{
  include: typeof saleInclude;
}>;

function mapSaleToDTO(
  row: SaleRow,
  recordedTotalOut?: number
): SaleDTO {
  const sold = Number(row.totalWeightSold);
  const mortality = Number(row.mortalityWeightKg);
  const closing =
    row.closingStockKg !== null ? Number(row.closingStockKg) : null;
  const fallbackOut = round2(sold + mortality);
  const totalWeightDeducted =
    recordedTotalOut !== undefined ? round2(recordedTotalOut) : fallbackOut;
  const weightLossKg =
    closing !== null ? round2(totalWeightDeducted - sold - mortality) : null;

  return {
    id: row.id,
    saleNumber: row.saleNumber,
    saleDate: row.saleDate.toISOString(),
    branchId: row.branchId,
    branchName: row.branch.name,
    branchCode: row.branch.code,
    totalWeightSold: sold,
    numberOfBirdsSold: row.numberOfBirdsSold,
    tokensIssued: row.tokensIssued,
    closingStockKg: closing,
    mortalityWeightKg: mortality,
    weightLossKg,
    totalWeightDeducted,
    retailedSaleCash: Number(row.salesAmount),
    avgRatePerKg: Number(row.sellingPricePerKg),
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getRecordedSaleWeightOut(
  tx: Prisma.TransactionClient,
  saleId: string,
  branchId: string,
  fallbackOut: number
): Promise<{ totalWeightOut: number; lastMovementAt: Date | null }> {
  const movements = await tx.stockMovement.findMany({
    where: { referenceId: saleId, branchId },
    select: { weight: true, createdAt: true },
  });

  if (movements.length === 0) {
    return { totalWeightOut: round2(fallbackOut), lastMovementAt: null };
  }

  let weightSum = 0;
  let lastMovementAt = movements[0].createdAt;
  for (const m of movements) {
    weightSum += Number(m.weight);
    if (m.createdAt > lastMovementAt) {
      lastMovementAt = m.createdAt;
    }
  }

  return {
    totalWeightOut: round2(-weightSum),
    lastMovementAt,
  };
}

async function getPoolBeforeSale(
  tx: Prisma.TransactionClient,
  existing: {
    id: string;
    branchId: string;
    closingStockKg: Prisma.Decimal | null;
  },
  oldTotalOut: number,
  currentBranchWeight: number,
  lastMovementAt: Date | null
): Promise<number> {
  if (existing.closingStockKg !== null) {
    return round2(oldTotalOut + Number(existing.closingStockKg));
  }

  const laterMovements = await tx.stockMovement.aggregate({
    where: {
      branchId: existing.branchId,
      ...(lastMovementAt ? { createdAt: { gt: lastMovementAt } } : {}),
      OR: [{ referenceId: null }, { referenceId: { not: existing.id } }],
    },
    _sum: { weight: true },
  });

  const laterNet = Number(laterMovements._sum.weight ?? 0);
  return round2(currentBranchWeight - laterNet + oldTotalOut);
}

export async function getSales(
  actor: AuthActor,
  filters: SaleFilterParams = {}
): Promise<SalesListResult> {
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
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      todaySummary: {
        retailedSaleCash: 0,
        retailSaleKg: 0,
        birdsSold: 0,
        tokensIssued: 0,
        avgRatePerKg: 0,
        mortalityWeightKg: 0,
        latestClosingStockKg: null,
      },
      filteredSummary: {
        count: 0,
        totalCash: 0,
        totalWeightKg: 0,
        totalBirds: 0,
        totalMortalityKg: 0,
      },
    };
  }

  const where: Prisma.RetailSaleWhereInput = {
    deletedAt: null,
    branchId: { in: scopedBranchIds },
  };

  if (filters.startDate || filters.endDate) {
    where.saleDate = {
      ...(filters.startDate
        ? { gte: startOfDay(parseLocalDate(filters.startDate)) }
        : {}),
      ...(filters.endDate
        ? { lte: endOfDay(parseLocalDate(filters.endDate)) }
        : {}),
    };
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { saleNumber: { contains: q, mode: "insensitive" } },
      { branch: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const todayRef = filters.referenceDate
    ? parseLocalDate(filters.referenceDate)
    : new Date();
  const validToday = Number.isNaN(todayRef.getTime()) ? new Date() : todayRef;

  const [total, rows, filteredAgg, todayAgg, latestTodayClosing] =
    await Promise.all([
      prisma.retailSale.count({ where }),
      prisma.retailSale.findMany({
        where,
        include: saleInclude,
        orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.retailSale.aggregate({
        where,
        _count: { id: true },
        _sum: {
          salesAmount: true,
          totalWeightSold: true,
          numberOfBirdsSold: true,
          mortalityWeightKg: true,
        },
      }),
      prisma.retailSale.aggregate({
        where: {
          deletedAt: null,
          branchId: { in: scopedBranchIds },
          saleDate: {
            gte: startOfDay(validToday),
            lte: endOfDay(validToday),
          },
        },
        _sum: {
          salesAmount: true,
          totalWeightSold: true,
          numberOfBirdsSold: true,
          tokensIssued: true,
          mortalityWeightKg: true,
        },
      }),
      prisma.retailSale.findFirst({
        where: {
          deletedAt: null,
          branchId: { in: scopedBranchIds },
          closingStockKg: { not: null },
          saleDate: {
            gte: startOfDay(validToday),
            lte: endOfDay(validToday),
          },
        },
        orderBy: { createdAt: "desc" },
        select: { closingStockKg: true },
      }),
    ]);

  const rowIds = rows.map((r) => r.id);
  const movementRows =
    rowIds.length > 0
      ? await prisma.stockMovement.findMany({
          where: { referenceId: { in: rowIds } },
          select: { referenceId: true, branchId: true, weight: true },
        })
      : [];

  const recordedOutMap = new Map<string, number>();
  for (const m of movementRows) {
    if (!m.referenceId) continue;
    const key = `${m.referenceId}:${m.branchId}`;
    recordedOutMap.set(key, (recordedOutMap.get(key) ?? 0) + -Number(m.weight));
  }

  const todayCash = Number(todayAgg._sum.salesAmount ?? 0);
  const todayWeight = Number(todayAgg._sum.totalWeightSold ?? 0);

  return {
    items: rows.map((row) =>
      mapSaleToDTO(row, recordedOutMap.get(`${row.id}:${row.branchId}`))
    ),
    total,
    page,
    pageSize,
    todaySummary: {
      retailedSaleCash: todayCash,
      retailSaleKg: todayWeight,
      birdsSold: Number(todayAgg._sum.numberOfBirdsSold ?? 0),
      tokensIssued: Number(todayAgg._sum.tokensIssued ?? 0),
      avgRatePerKg: todayWeight > 0 ? round2(todayCash / todayWeight) : 0,
      mortalityWeightKg: Number(todayAgg._sum.mortalityWeightKg ?? 0),
      latestClosingStockKg:
        latestTodayClosing?.closingStockKg !== null &&
        latestTodayClosing?.closingStockKg !== undefined
          ? Number(latestTodayClosing.closingStockKg)
          : null,
    },
    filteredSummary: {
      count: filteredAgg._count.id,
      totalCash: Number(filteredAgg._sum.salesAmount ?? 0),
      totalWeightKg: Number(filteredAgg._sum.totalWeightSold ?? 0),
      totalBirds: Number(filteredAgg._sum.numberOfBirdsSold ?? 0),
      totalMortalityKg: Number(filteredAgg._sum.mortalityWeightKg ?? 0),
    },
  };
}

export async function createSale(
  input: SaleFormValues,
  actor: AuthActor
): Promise<SaleDTO> {
  if (!canAccessBranch(actor, input.branchId)) {
    throw new Error("Forbidden: You do not have access to this branch.");
  }

  const {
    weightSold,
    retailedSaleCash,
    mortalityWeightKg,
    closingStockKg,
    avgRatePerKg,
  } = computeSaleMetrics(input);

  const baseWeightOut = round2(weightSold + mortalityWeightKg);
  const hasClosingStock =
    closingStockKg !== undefined && closingStockKg !== null;
  const saleDate = parseLocalDate(input.saleDate);

  const created = await prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.retailSale.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: saleInclude,
      });
      if (existing) {
        const { totalWeightOut } = await getRecordedSaleWeightOut(
          tx,
          existing.id,
          existing.branchId,
          Number(existing.totalWeightSold) + Number(existing.mortalityWeightKg)
        );
        return { row: existing, totalWeightDeducted: totalWeightOut };
      }
    }

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

    const availBirds = lockedBranch.currentBirdStock;
    const availWeight = Number(lockedBranch.currentWeightStock);

    if (
      !branch.business.allowNegativeStock &&
      ((input.numberOfBirdsSold > 0 && availBirds < input.numberOfBirdsSold) ||
        availWeight < baseWeightOut)
    ) {
      throw new Error(
        `Insufficient stock in ${branch.name}. Available: ${availBirds} birds (${availWeight.toFixed(2)} kg).`
      );
    }

    const bookLeftover = round2(availWeight - baseWeightOut);
    const weightLossKg = hasClosingStock
      ? round2(bookLeftover - closingStockKg)
      : 0;
    const totalWeightDeducted = hasClosingStock
      ? round2(availWeight - closingStockKg)
      : baseWeightOut;

    const saleNumber = await generateSaleNumber(tx, input.saleDate);

    const row = await tx.retailSale.create({
      data: {
        saleNumber,
        saleDate,
        branchId: branch.id,
        sellingPricePerKg: new Prisma.Decimal(avgRatePerKg),
        totalWeightSold: new Prisma.Decimal(weightSold),
        numberOfBirdsSold: input.numberOfBirdsSold,
        tokensIssued: input.tokensIssued,
        closingStockKg: hasClosingStock
          ? new Prisma.Decimal(closingStockKg)
          : null,
        mortalityWeightKg: new Prisma.Decimal(mortalityWeightKg),
        salesAmount: new Prisma.Decimal(retailedSaleCash),
        cashReceived: new Prisma.Decimal(retailedSaleCash),
        upiReceived: new Prisma.Decimal(0),
        otherPayment: new Prisma.Decimal(0),
        totalPaymentReceived: new Prisma.Decimal(retailedSaleCash),
        difference: new Prisma.Decimal(0),
        notes: null,
        idempotencyKey: input.idempotencyKey || null,
        createdById: actor.id,
      },
      include: saleInclude,
    });

    await tx.branch.update({
      where: { id: branch.id },
      data: {
        ...(input.numberOfBirdsSold > 0
          ? { currentBirdStock: { decrement: input.numberOfBirdsSold } }
          : {}),
        currentWeightStock: hasClosingStock
          ? new Prisma.Decimal(closingStockKg)
          : {
              decrement: new Prisma.Decimal(totalWeightDeducted),
            },
      },
    });

    await tx.stockMovement.create({
      data: {
        date: saleDate,
        branchId: branch.id,
        movementType: MovementType.SALE_OUT,
        birdCount: -input.numberOfBirdsSold,
        weight: new Prisma.Decimal(-weightSold),
        referenceId: row.id,
        referenceType: "RetailSale",
        notes: `Retail sale ${row.saleNumber} (${weightSold.toFixed(2)} kg)`,
        createdById: actor.id,
      },
    });

    if (mortalityWeightKg > 0) {
      await tx.stockMovement.create({
        data: {
          date: saleDate,
          branchId: branch.id,
          movementType: MovementType.DEAD_DAMAGED,
          birdCount: 0,
          weight: new Prisma.Decimal(-mortalityWeightKg),
          referenceId: row.id,
          referenceType: "RetailSaleMortality",
          notes: `Mortality weight on sale ${row.saleNumber} (${mortalityWeightKg.toFixed(2)} kg)`,
          createdById: actor.id,
        },
      });
    }

    if (hasClosingStock && weightLossKg !== 0) {
      await tx.stockMovement.create({
        data: {
          date: saleDate,
          branchId: branch.id,
          movementType: MovementType.ADJUSTMENT,
          birdCount: 0,
          weight: new Prisma.Decimal(-weightLossKg),
          referenceId: row.id,
          referenceType: "RetailSaleLoss",
          notes: `Weight loss on sale ${row.saleNumber} (${weightLossKg.toFixed(2)} kg)`,
          createdById: actor.id,
        },
      });
    }

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: branch.id,
      action: "CREATE_SALE",
      entityType: "RetailSale",
      entityId: row.id,
      newValues: {
        saleNumber: row.saleNumber,
        branchId: row.branchId,
        retailSaleKg: weightSold,
        numberOfBirdsSold: row.numberOfBirdsSold,
        tokensIssued: row.tokensIssued,
        retailedSaleCash,
        mortalityWeightKg,
        closingStockKg,
        weightLossKg: hasClosingStock ? weightLossKg : null,
        totalWeightDeducted,
      },
    });

    return { row, totalWeightDeducted };
  });

  return mapSaleToDTO(created.row, created.totalWeightDeducted);
}

/**
 * Corrects an existing Retail Sale entry atomically with stock adjustment and audit trail.
 */
export async function updateSale(
  input: UpdateSaleValues,
  actor: AuthActor
): Promise<SaleDTO> {
  if (actor.role !== "OWNER" && actor.role !== "BRANCH_MANAGER") {
    throw new Error("Forbidden: Only Managers or Owners can correct sales.");
  }

  const {
    weightSold,
    retailedSaleCash,
    mortalityWeightKg,
    closingStockKg,
    avgRatePerKg,
  } = computeSaleMetrics(input);

  const saleDate = parseLocalDate(input.saleDate);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.retailSale.findFirst({
      where: {
        id: input.id,
        deletedAt: null,
        branch: { businessId: actor.businessId },
      },
      include: {
        branch: {
          include: {
            business: { select: { allowNegativeStock: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Sale record not found.");
    }

    if (
      !canAccessBranch(actor, existing.branchId) ||
      !canAccessBranch(actor, input.branchId)
    ) {
      throw new Error("Forbidden: You do not have access to this branch.");
    }

    const fallbackOldOut = round2(
      Number(existing.totalWeightSold) + Number(existing.mortalityWeightKg)
    );
    const { totalWeightOut: oldWeightOut, lastMovementAt } =
      await getRecordedSaleWeightOut(
        tx,
        existing.id,
        existing.branchId,
        fallbackOldOut
      );
    const baseNewOut = round2(weightSold + mortalityWeightKg);
    const hasClosingStock =
      closingStockKg !== undefined && closingStockKg !== null;
    const oldBirds = existing.numberOfBirdsSold;
    let finalWeightOut = baseNewOut;

    if (existing.branchId === input.branchId) {
      const lockedRows = await tx.$queryRaw<
        { currentBirdStock: number; currentWeightStock: Prisma.Decimal }[]
      >`SELECT "currentBirdStock", "currentWeightStock" FROM "Branch" WHERE "id" = ${existing.branchId} FOR UPDATE`;

      const availBirds = lockedRows[0]?.currentBirdStock ?? 0;
      const availWeight = Number(lockedRows[0]?.currentWeightStock ?? 0);

      let poolBeforeExisting = round2(availWeight + oldWeightOut);
      if (hasClosingStock) {
        poolBeforeExisting = await getPoolBeforeSale(
          tx,
          existing,
          oldWeightOut,
          availWeight,
          lastMovementAt
        );
        finalWeightOut = round2(poolBeforeExisting - closingStockKg);
      }

      const birdDelta = input.numberOfBirdsSold - oldBirds;
      const weightDelta = round2(finalWeightOut - oldWeightOut);

      if (
        !existing.branch.business.allowNegativeStock &&
        ((birdDelta > 0 && availBirds < birdDelta) ||
          availWeight - weightDelta < 0 ||
          (hasClosingStock && poolBeforeExisting < baseNewOut))
      ) {
        throw new Error(
          `Insufficient stock in ${existing.branch.name} for this correction. Available: ${availBirds} birds (${availWeight.toFixed(2)} kg).`
        );
      }

      if (birdDelta !== 0 || weightDelta !== 0) {
        await tx.branch.update({
          where: { id: existing.branchId },
          data: {
            currentBirdStock: { decrement: birdDelta },
            currentWeightStock: { decrement: new Prisma.Decimal(weightDelta) },
          },
        });

        await tx.stockMovement.create({
          data: {
            date: saleDate,
            branchId: existing.branchId,
            movementType: MovementType.ADJUSTMENT,
            birdCount: -birdDelta,
            weight: new Prisma.Decimal(-weightDelta),
            referenceId: existing.id,
            referenceType: "RetailSaleCorrection",
            notes: `Sale ${existing.saleNumber} corrected: ${input.correctionReason}`,
            createdById: actor.id,
          },
        });
      }
    } else {
      const targetBranch = await tx.branch.findFirst({
        where: {
          id: input.branchId,
          businessId: actor.businessId,
          isActive: true,
        },
      });
      if (!targetBranch) {
        throw new Error("Target branch is invalid or inactive.");
      }

      const lockedTarget = await tx.$queryRaw<
        { currentBirdStock: number; currentWeightStock: Prisma.Decimal }[]
      >`SELECT "currentBirdStock", "currentWeightStock" FROM "Branch" WHERE "id" = ${targetBranch.id} FOR UPDATE`;

      const availBirds = lockedTarget[0]?.currentBirdStock ?? 0;
      const availWeight = Number(lockedTarget[0]?.currentWeightStock ?? 0);

      if (
        !existing.branch.business.allowNegativeStock &&
        ((input.numberOfBirdsSold > 0 && availBirds < input.numberOfBirdsSold) ||
          availWeight < baseNewOut)
      ) {
        throw new Error(
          `Insufficient stock in ${targetBranch.name} for this transfer.`
        );
      }

      const transferLossKg = hasClosingStock
        ? round2(availWeight - baseNewOut - closingStockKg)
        : 0;
      finalWeightOut = hasClosingStock
        ? round2(availWeight - closingStockKg)
        : baseNewOut;

      await tx.branch.update({
        where: { id: existing.branchId },
        data: {
          currentBirdStock: { increment: oldBirds },
          currentWeightStock: { increment: new Prisma.Decimal(oldWeightOut) },
        },
      });
      await tx.stockMovement.create({
        data: {
          date: saleDate,
          branchId: existing.branchId,
          movementType: MovementType.ADJUSTMENT,
          birdCount: oldBirds,
          weight: new Prisma.Decimal(oldWeightOut),
          referenceId: existing.id,
          referenceType: "RetailSaleCorrection",
          notes: `Sale ${existing.saleNumber} moved: ${input.correctionReason}`,
          createdById: actor.id,
        },
      });

      await tx.branch.update({
        where: { id: targetBranch.id },
        data: {
          currentBirdStock: { decrement: input.numberOfBirdsSold },
          currentWeightStock: hasClosingStock
            ? new Prisma.Decimal(closingStockKg)
            : { decrement: new Prisma.Decimal(finalWeightOut) },
        },
      });
      await tx.stockMovement.create({
        data: {
          date: saleDate,
          branchId: targetBranch.id,
          movementType: MovementType.SALE_OUT,
          birdCount: -input.numberOfBirdsSold,
          weight: new Prisma.Decimal(-weightSold),
          referenceId: existing.id,
          referenceType: "RetailSaleCorrection",
          notes: `Sale ${existing.saleNumber} transferred here: ${input.correctionReason}`,
          createdById: actor.id,
        },
      });
      if (mortalityWeightKg > 0) {
        await tx.stockMovement.create({
          data: {
            date: saleDate,
            branchId: targetBranch.id,
            movementType: MovementType.DEAD_DAMAGED,
            birdCount: 0,
            weight: new Prisma.Decimal(-mortalityWeightKg),
            referenceId: existing.id,
            referenceType: "RetailSaleMortality",
            notes: `Mortality weight on sale ${existing.saleNumber} (${mortalityWeightKg.toFixed(2)} kg)`,
            createdById: actor.id,
          },
        });
      }
      if (hasClosingStock && transferLossKg !== 0) {
        await tx.stockMovement.create({
          data: {
            date: saleDate,
            branchId: targetBranch.id,
            movementType: MovementType.ADJUSTMENT,
            birdCount: 0,
            weight: new Prisma.Decimal(-transferLossKg),
            referenceId: existing.id,
            referenceType: "RetailSaleLoss",
            notes: `Weight loss on sale ${existing.saleNumber} (${transferLossKg.toFixed(2)} kg)`,
            createdById: actor.id,
          },
        });
      }
    }

    const row = await tx.retailSale.update({
      where: { id: existing.id },
      data: {
        saleDate,
        branchId: input.branchId,
        sellingPricePerKg: new Prisma.Decimal(avgRatePerKg),
        totalWeightSold: new Prisma.Decimal(weightSold),
        numberOfBirdsSold: input.numberOfBirdsSold,
        tokensIssued: input.tokensIssued,
        closingStockKg: hasClosingStock
          ? new Prisma.Decimal(closingStockKg)
          : null,
        mortalityWeightKg: new Prisma.Decimal(mortalityWeightKg),
        salesAmount: new Prisma.Decimal(retailedSaleCash),
        cashReceived: new Prisma.Decimal(retailedSaleCash),
        upiReceived: new Prisma.Decimal(0),
        otherPayment: new Prisma.Decimal(0),
        totalPaymentReceived: new Prisma.Decimal(retailedSaleCash),
        difference: new Prisma.Decimal(0),
      },
      include: saleInclude,
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: row.branchId,
      action: "UPDATE_SALE",
      entityType: "RetailSale",
      entityId: row.id,
      oldValues: {
        branchId: existing.branchId,
        retailSaleKg: Number(existing.totalWeightSold),
        numberOfBirdsSold: oldBirds,
        mortalityWeightKg: Number(existing.mortalityWeightKg),
        closingStockKg:
          existing.closingStockKg !== null
            ? Number(existing.closingStockKg)
            : null,
        totalWeightDeducted: oldWeightOut,
        retailedSaleCash: Number(existing.salesAmount),
      },
      newValues: {
        reason: input.correctionReason,
        branchId: row.branchId,
        retailSaleKg: weightSold,
        numberOfBirdsSold: row.numberOfBirdsSold,
        mortalityWeightKg,
        closingStockKg,
        totalWeightDeducted: finalWeightOut,
        retailedSaleCash,
      },
    });

    return { row, totalWeightDeducted: finalWeightOut };
  });

  return mapSaleToDTO(updated.row, updated.totalWeightDeducted);
}

/**
 * Soft-deletes (voids) an erroneous sale entry, restores stock, and records an audit log.
 */
export async function voidSale(
  input: VoidSaleValues,
  actor: AuthActor
): Promise<void> {
  if (actor.role !== "OWNER" && actor.role !== "BRANCH_MANAGER") {
    throw new Error("Forbidden: Only Managers or Owners can void sales.");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.retailSale.findFirst({
      where: {
        id: input.id,
        deletedAt: null,
        branch: { businessId: actor.businessId },
      },
    });

    if (!existing) {
      throw new Error("Sale record not found.");
    }

    if (!canAccessBranch(actor, existing.branchId)) {
      throw new Error("Forbidden: You do not have access to this branch.");
    }

    const fallbackRestored = round2(
      Number(existing.totalWeightSold) + Number(existing.mortalityWeightKg)
    );
    const { totalWeightOut: totalWeightRestored } =
      await getRecordedSaleWeightOut(
        tx,
        existing.id,
        existing.branchId,
        fallbackRestored
      );

    await tx.retailSale.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await tx.branch.update({
      where: { id: existing.branchId },
      data: {
        ...(existing.numberOfBirdsSold > 0
          ? { currentBirdStock: { increment: existing.numberOfBirdsSold } }
          : {}),
        currentWeightStock: {
          increment: new Prisma.Decimal(totalWeightRestored),
        },
      },
    });

    await tx.stockMovement.create({
      data: {
        date: new Date(),
        branchId: existing.branchId,
        movementType: MovementType.ADJUSTMENT,
        birdCount: existing.numberOfBirdsSold,
        weight: new Prisma.Decimal(totalWeightRestored),
        referenceId: existing.id,
        referenceType: "RetailSaleVoid",
        notes: `Sale ${existing.saleNumber} voided: ${input.reason}`,
        createdById: actor.id,
      },
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: existing.branchId,
      action: "VOID_SALE",
      entityType: "RetailSale",
      entityId: existing.id,
      oldValues: {
        saleNumber: existing.saleNumber,
        retailedSaleCash: Number(existing.salesAmount),
        numberOfBirdsSold: existing.numberOfBirdsSold,
        totalWeightRestored,
      },
      newValues: {
        voided: true,
        reason: input.reason,
      },
    });
  });
}
