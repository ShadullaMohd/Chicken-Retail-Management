import { startOfDay, endOfDay } from "date-fns";
import { DispatchStatus, MovementType, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { AuthActor } from "@/lib/permissions";
import { canAccessAllBranches, canAccessBranch } from "@/lib/permissions";
import type {
  CancelDispatchInput,
  DispatchFormValues,
  ReceiveDispatchValues,
  UpdateDispatchValues,
  UpdateDressedWeightValues,
} from "@/lib/validations/dispatch";
import { recordAuditLog } from "./audit.service";

export const JALI_CHARGE_PER_JALI = 10;

export interface DispatchDTO {
  id: string;
  dispatchNumber: string;
  dispatchDate: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  branchAddress: string | null;
  branchContact: string | null;
  numberOfJalis: number;
  jaliCharge: number;
  totalBirdCount: number;
  liveWeight: number;
  dressedWeight: number | null;
  effectiveStockWeight: number;
  purchaseRatePerKg: number;
  totalPurchaseAmount: number;
  status: DispatchStatus;
  receivedAt: string | null;
  receivedByName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdByName: string;
  createdAt: string;
}

export interface DispatchFilterParams {
  search?: string;
  branchId?: string;
  status?: "ALL" | DispatchStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface DispatchListResult {
  items: DispatchDTO[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalDispatches: number;
    totalBirds: number;
    totalLiveWeightKg: number;
    totalDressedWeightKg: number;
    totalPurchaseCost: number;
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function computeDispatchTotals(input: {
  liveWeight: number;
  dressedWeight?: number;
  numberOfJalis: number;
  purchaseRatePerKg: number;
}) {
  const liveWeight = round2(input.liveWeight);
  if (liveWeight <= 0) {
    throw new Error("Live weight must be greater than zero.");
  }

  const dressedWeight =
    typeof input.dressedWeight === "number" && input.dressedWeight > 0
      ? round2(input.dressedWeight)
      : null;

  if (dressedWeight !== null && dressedWeight > liveWeight) {
    throw new Error("Weight after dressing cannot exceed live weight.");
  }

  const rate = round2(input.purchaseRatePerKg);
  const jaliCharge = round2(input.numberOfJalis * JALI_CHARGE_PER_JALI);
  const totalPurchaseAmount = round2(liveWeight * rate + jaliCharge);
  const effectiveStockWeight = dressedWeight ?? liveWeight;

  return {
    liveWeight,
    dressedWeight,
    rate,
    jaliCharge,
    totalPurchaseAmount,
    effectiveStockWeight,
  };
}

async function generateDispatchNumber(
  tx: Prisma.TransactionClient,
  dateStr: string
): Promise<string> {
  const compactDate = dateStr.replace(/-/g, "").slice(2);
  const prefix = `DSP-${compactDate}-`;

  const existing = await tx.henDispatch.count({
    where: {
      dispatchNumber: { startsWith: prefix },
    },
  });

  const seq = String(existing + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

const dispatchInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      contactNumber: true,
    },
  },
  createdBy: {
    select: { name: true },
  },
  receivedBy: {
    select: { name: true },
  },
} satisfies Prisma.HenDispatchInclude;

type DispatchRow = Prisma.HenDispatchGetPayload<{
  include: typeof dispatchInclude;
}>;

function mapDispatchToDTO(d: DispatchRow): DispatchDTO {
  const liveWeight = Number(d.netWeight);
  const dressedWeight = d.dressedWeight !== null ? Number(d.dressedWeight) : null;
  const jaliCharge = Number(d.jaliCharge);

  return {
    id: d.id,
    dispatchNumber: d.dispatchNumber,
    dispatchDate: d.dispatchDate.toISOString(),
    branchId: d.branchId,
    branchName: d.branch.name,
    branchCode: d.branch.code,
    branchAddress: d.branch.address,
    branchContact: d.branch.contactNumber,
    numberOfJalis: d.numberOfJalis,
    jaliCharge,
    totalBirdCount: d.totalBirdCount,
    liveWeight,
    dressedWeight,
    effectiveStockWeight: dressedWeight ?? liveWeight,
    purchaseRatePerKg: Number(d.purchaseRatePerKg),
    totalPurchaseAmount: Number(d.totalPurchaseAmount),
    status: d.status,
    receivedAt: d.receivedAt ? d.receivedAt.toISOString() : null,
    receivedByName: d.receivedBy?.name ?? null,
    cancelledAt: d.cancelledAt ? d.cancelledAt.toISOString() : null,
    cancelReason: d.cancelReason,
    notes: d.notes,
    createdByName: d.createdBy.name,
    createdAt: d.createdAt.toISOString(),
  };
}

async function applyReceivedStock(
  tx: Prisma.TransactionClient,
  params: {
    dispatchId: string;
    dispatchNumber: string;
    dispatchDate: Date;
    branchId: string;
    birdCount: number;
    stockWeight: number;
    actorId: string;
  }
): Promise<void> {
  await tx.branch.update({
    where: { id: params.branchId },
    data: {
      currentBirdStock: { increment: params.birdCount },
      currentWeightStock: {
        increment: new Prisma.Decimal(params.stockWeight),
      },
    },
  });

  await tx.stockMovement.create({
    data: {
      date: params.dispatchDate,
      branchId: params.branchId,
      movementType: MovementType.DISPATCH_IN,
      birdCount: params.birdCount,
      weight: new Prisma.Decimal(params.stockWeight),
      referenceId: params.dispatchId,
      referenceType: "HenDispatch",
      notes: `Hen dispatch ${params.dispatchNumber} received`,
      createdById: params.actorId,
    },
  });
}

export async function getDispatches(
  actor: AuthActor,
  filters: DispatchFilterParams = {}
): Promise<DispatchListResult> {
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
      summary: {
        totalDispatches: 0,
        totalBirds: 0,
        totalLiveWeightKg: 0,
        totalDressedWeightKg: 0,
        totalPurchaseCost: 0,
      },
    };
  }

  const where: Prisma.HenDispatchWhereInput = {
    deletedAt: null,
    branchId: { in: scopedBranchIds },
    ...(filters.status && filters.status !== "ALL"
      ? { status: filters.status }
      : {}),
  };

  if (filters.startDate || filters.endDate) {
    where.dispatchDate = {
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
      { dispatchNumber: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { branch: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows, agg] = await Promise.all([
    prisma.henDispatch.count({ where }),
    prisma.henDispatch.findMany({
      where,
      include: dispatchInclude,
      orderBy: [{ dispatchDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.henDispatch.aggregate({
      where: {
        ...where,
        status: filters.status === "CANCELLED" ? "CANCELLED" : { not: "CANCELLED" },
      },
      _count: { id: true },
      _sum: {
        totalBirdCount: true,
        netWeight: true,
        dressedWeight: true,
        totalPurchaseAmount: true,
      },
    }),
  ]);

  return {
    items: rows.map(mapDispatchToDTO),
    total,
    page,
    pageSize,
    summary: {
      totalDispatches: agg._count.id,
      totalBirds: Number(agg._sum.totalBirdCount ?? 0),
      totalLiveWeightKg: Number(agg._sum.netWeight ?? 0),
      totalDressedWeightKg: Number(agg._sum.dressedWeight ?? 0),
      totalPurchaseCost: Number(agg._sum.totalPurchaseAmount ?? 0),
    },
  };
}

export async function getDispatchById(
  id: string,
  actor: AuthActor
): Promise<{
  dispatch: DispatchDTO;
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
} | null> {
  const row = await prisma.henDispatch.findFirst({
    where: {
      id,
      deletedAt: null,
      branch: { businessId: actor.businessId },
    },
    include: {
      ...dispatchInclude,
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          contactNumber: true,
          business: {
            select: {
              name: true,
              address: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!row || !canAccessBranch(actor, row.branchId)) {
    return null;
  }

  return {
    dispatch: mapDispatchToDTO(row),
    businessName: row.branch.business.name,
    businessAddress: row.branch.business.address,
    businessPhone: row.branch.business.phone,
  };
}

export async function createDispatch(
  input: DispatchFormValues,
  actor: AuthActor
): Promise<DispatchDTO> {
  if (!canAccessBranch(actor, input.branchId)) {
    throw new Error("Forbidden: You do not have access to this branch.");
  }

  const {
    liveWeight,
    dressedWeight,
    rate,
    jaliCharge,
    totalPurchaseAmount,
    effectiveStockWeight,
  } = computeDispatchTotals(input);

  const dispatchDate = parseLocalDate(input.dispatchDate);

  const created = await prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.henDispatch.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: dispatchInclude,
      });
      if (existing) {
        return existing;
      }
    }

    const branch = await tx.branch.findFirst({
      where: {
        id: input.branchId,
        businessId: actor.businessId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!branch) {
      throw new Error("Destination branch is invalid or inactive.");
    }

    const dispatchNumber = await generateDispatchNumber(tx, input.dispatchDate);
    const status = input.markAsReceived
      ? DispatchStatus.RECEIVED
      : DispatchStatus.PENDING;

    const row = await tx.henDispatch.create({
      data: {
        dispatchNumber,
        dispatchDate,
        supplierId: null,
        branchId: branch.id,
        vehicleNumber: null,
        numberOfJalis: input.numberOfJalis,
        birdsPerJali: null,
        totalBirdCount: input.totalBirdCount,
        grossWeight: new Prisma.Decimal(liveWeight),
        emptyJaliWeight: new Prisma.Decimal(0),
        netWeight: new Prisma.Decimal(liveWeight),
        dressedWeight:
          dressedWeight !== null ? new Prisma.Decimal(dressedWeight) : null,
        jaliCharge: new Prisma.Decimal(jaliCharge),
        purchaseRatePerKg: new Prisma.Decimal(rate),
        totalPurchaseAmount: new Prisma.Decimal(totalPurchaseAmount),
        status,
        receivedAt: input.markAsReceived ? new Date() : null,
        receivedById: input.markAsReceived ? actor.id : null,
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey || null,
        createdById: actor.id,
      },
      include: dispatchInclude,
    });

    if (input.markAsReceived) {
      await applyReceivedStock(tx, {
        dispatchId: row.id,
        dispatchNumber: row.dispatchNumber,
        dispatchDate,
        branchId: row.branchId,
        birdCount: row.totalBirdCount,
        stockWeight: effectiveStockWeight,
        actorId: actor.id,
      });
    }

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: row.branchId,
      action: input.markAsReceived
        ? "CREATE_AND_RECEIVE_DISPATCH"
        : "CREATE_DISPATCH",
      entityType: "HenDispatch",
      entityId: row.id,
      newValues: {
        dispatchNumber: row.dispatchNumber,
        branchId: row.branchId,
        numberOfJalis: row.numberOfJalis,
        jaliCharge,
        totalBirdCount: row.totalBirdCount,
        liveWeight,
        dressedWeight,
        totalPurchaseAmount,
        status: row.status,
      },
    });

    return row;
  });

  return mapDispatchToDTO(created);
}

export async function updateDispatch(
  input: UpdateDispatchValues,
  actor: AuthActor
): Promise<DispatchDTO> {
  const { liveWeight, dressedWeight, rate, jaliCharge, totalPurchaseAmount } =
    computeDispatchTotals(input);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.henDispatch.findFirst({
      where: {
        id: input.id,
        deletedAt: null,
        branch: { businessId: actor.businessId },
      },
    });

    if (!existing) {
      throw new Error("Dispatch record not found.");
    }

    if (!canAccessBranch(actor, existing.branchId)) {
      throw new Error("Forbidden: You do not have access to this dispatch.");
    }

    if (existing.status !== DispatchStatus.PENDING) {
      throw new Error(
        "Only Pending dispatches can be edited. Use 'Dressed Wt' to update dressed weight on received dispatches."
      );
    }

    if (!canAccessBranch(actor, input.branchId)) {
      throw new Error("Forbidden: You cannot move dispatch to this branch.");
    }

    const branch = await tx.branch.findFirst({
      where: {
        id: input.branchId,
        businessId: actor.businessId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!branch) {
      throw new Error("Destination branch is invalid or inactive.");
    }

    const row = await tx.henDispatch.update({
      where: { id: existing.id },
      data: {
        dispatchDate: parseLocalDate(input.dispatchDate),
        branchId: branch.id,
        numberOfJalis: input.numberOfJalis,
        totalBirdCount: input.totalBirdCount,
        grossWeight: new Prisma.Decimal(liveWeight),
        emptyJaliWeight: new Prisma.Decimal(0),
        netWeight: new Prisma.Decimal(liveWeight),
        dressedWeight:
          dressedWeight !== null ? new Prisma.Decimal(dressedWeight) : null,
        jaliCharge: new Prisma.Decimal(jaliCharge),
        purchaseRatePerKg: new Prisma.Decimal(rate),
        totalPurchaseAmount: new Prisma.Decimal(totalPurchaseAmount),
        notes: input.notes || null,
      },
      include: dispatchInclude,
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: row.branchId,
      action: "UPDATE_DISPATCH",
      entityType: "HenDispatch",
      entityId: row.id,
      oldValues: {
        branchId: existing.branchId,
        totalBirdCount: existing.totalBirdCount,
        liveWeight: Number(existing.netWeight),
        dressedWeight:
          existing.dressedWeight !== null
            ? Number(existing.dressedWeight)
            : null,
        totalPurchaseAmount: Number(existing.totalPurchaseAmount),
      },
      newValues: {
        branchId: row.branchId,
        totalBirdCount: row.totalBirdCount,
        liveWeight,
        dressedWeight,
        totalPurchaseAmount,
      },
    });

    return row;
  });

  return mapDispatchToDTO(updated);
}

export async function receiveDispatch(
  input: ReceiveDispatchValues,
  actor: AuthActor
): Promise<DispatchDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.henDispatch.findFirst({
      where: {
        id: input.id,
        deletedAt: null,
        branch: { businessId: actor.businessId },
      },
    });

    if (!existing) {
      throw new Error("Dispatch record not found.");
    }

    if (!canAccessBranch(actor, existing.branchId)) {
      throw new Error("Forbidden: You do not have access to this branch.");
    }

    const liveWeight = Number(existing.netWeight);
    const nextDressedWeight =
      typeof input.dressedWeight === "number" && input.dressedWeight > 0
        ? round2(input.dressedWeight)
        : existing.dressedWeight !== null
        ? Number(existing.dressedWeight)
        : null;

    if (nextDressedWeight !== null && nextDressedWeight > liveWeight) {
      throw new Error("Weight after dressing cannot exceed live weight.");
    }

    const stockWeight = nextDressedWeight ?? liveWeight;

    const claim = await tx.henDispatch.updateMany({
      where: {
        id: existing.id,
        status: DispatchStatus.PENDING,
      },
      data: {
        status: DispatchStatus.RECEIVED,
        dressedWeight:
          nextDressedWeight !== null
            ? new Prisma.Decimal(nextDressedWeight)
            : null,
        receivedAt: new Date(),
        receivedById: actor.id,
      },
    });

    if (claim.count !== 1) {
      throw new Error("Dispatch is no longer pending and cannot be received.");
    }

    await applyReceivedStock(tx, {
      dispatchId: existing.id,
      dispatchNumber: existing.dispatchNumber,
      dispatchDate: existing.dispatchDate,
      branchId: existing.branchId,
      birdCount: existing.totalBirdCount,
      stockWeight,
      actorId: actor.id,
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: existing.branchId,
      action: "RECEIVE_DISPATCH",
      entityType: "HenDispatch",
      entityId: existing.id,
      oldValues: { status: "PENDING" },
      newValues: {
        status: "RECEIVED",
        birdsAdded: existing.totalBirdCount,
        liveWeight,
        dressedWeight: nextDressedWeight,
        stockWeightAdded: stockWeight,
      },
    });

    return tx.henDispatch.findUniqueOrThrow({
      where: { id: existing.id },
      include: dispatchInclude,
    });
  });

  return mapDispatchToDTO(updated);
}

/**
 * Updates Weight After Dressing on an already-received dispatch and adjusts branch weight stock atomically.
 */
export async function updateReceivedDressedWeight(
  input: UpdateDressedWeightValues,
  actor: AuthActor
): Promise<DispatchDTO> {
  const nextDressedWeight = round2(input.dressedWeight);

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.henDispatch.findFirst({
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
      throw new Error("Dispatch record not found.");
    }

    if (!canAccessBranch(actor, existing.branchId)) {
      throw new Error("Forbidden: You do not have access to this dispatch.");
    }

    if (existing.status !== DispatchStatus.RECEIVED) {
      throw new Error("Dressed weight adjustment is only for Received dispatches.");
    }

    const liveWeight = Number(existing.netWeight);
    if (nextDressedWeight > liveWeight) {
      throw new Error("Weight after dressing cannot exceed live weight.");
    }

    const previousStockWeight =
      existing.dressedWeight !== null
        ? Number(existing.dressedWeight)
        : liveWeight;
    const weightDelta = round2(nextDressedWeight - previousStockWeight);

    if (weightDelta !== 0) {
      const lockedRows = await tx.$queryRaw<
        { currentWeightStock: Prisma.Decimal }[]
      >`SELECT "currentWeightStock" FROM "Branch" WHERE "id" = ${existing.branchId} FOR UPDATE`;

      const currentStockWeight = Number(
        lockedRows[0]?.currentWeightStock ?? 0
      );

      if (
        !existing.branch.business.allowNegativeStock &&
        currentStockWeight + weightDelta < 0
      ) {
        throw new Error(
          "Cannot reduce dressed weight below current remaining branch weight stock."
        );
      }

      await tx.branch.update({
        where: { id: existing.branchId },
        data: {
          currentWeightStock: { increment: new Prisma.Decimal(weightDelta) },
        },
      });

      await tx.stockMovement.create({
        data: {
          date: new Date(),
          branchId: existing.branchId,
          movementType: MovementType.ADJUSTMENT,
          birdCount: 0,
          weight: new Prisma.Decimal(weightDelta),
          referenceId: existing.id,
          referenceType: "HenDispatchDressedWeight",
          notes: `Dressed weight updated for ${existing.dispatchNumber}: ${previousStockWeight.toFixed(2)} kg -> ${nextDressedWeight.toFixed(2)} kg`,
          createdById: actor.id,
        },
      });
    }

    const row = await tx.henDispatch.update({
      where: { id: existing.id },
      data: {
        dressedWeight: new Prisma.Decimal(nextDressedWeight),
      },
      include: dispatchInclude,
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: existing.branchId,
      action: "UPDATE_DRESSED_WEIGHT",
      entityType: "HenDispatch",
      entityId: existing.id,
      oldValues: {
        dressedWeight:
          existing.dressedWeight !== null
            ? Number(existing.dressedWeight)
            : null,
        effectiveStockWeight: previousStockWeight,
      },
      newValues: {
        dressedWeight: nextDressedWeight,
        effectiveStockWeight: nextDressedWeight,
        stockDelta: weightDelta,
      },
    });

    return row;
  });

  return mapDispatchToDTO(updated);
}

export async function cancelDispatch(
  input: CancelDispatchInput,
  actor: AuthActor
): Promise<DispatchDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.henDispatch.findFirst({
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
      throw new Error("Dispatch record not found.");
    }

    if (!canAccessBranch(actor, existing.branchId)) {
      throw new Error("Forbidden: You do not have access to this branch.");
    }

    if (existing.status === DispatchStatus.CANCELLED) {
      throw new Error("Dispatch is already cancelled.");
    }

    if (existing.status === DispatchStatus.RECEIVED) {
      if (actor.role !== "OWNER") {
        throw new Error(
          "Only the Owner can cancel a dispatch that has already been received into stock."
        );
      }

      const lockedRows = await tx.$queryRaw<
        { currentBirdStock: number; currentWeightStock: Prisma.Decimal }[]
      >`SELECT "currentBirdStock", "currentWeightStock" FROM "Branch" WHERE "id" = ${existing.branchId} FOR UPDATE`;

      const branchRow = lockedRows[0];
      if (!branchRow) {
        throw new Error("Branch not found.");
      }

      const currentBirds = branchRow.currentBirdStock;
      const currentWeight = Number(branchRow.currentWeightStock);
      const stockWeight =
        existing.dressedWeight !== null
          ? Number(existing.dressedWeight)
          : Number(existing.netWeight);

      if (
        !existing.branch.business.allowNegativeStock &&
        (currentBirds < existing.totalBirdCount || currentWeight < stockWeight)
      ) {
        throw new Error(
          "Cannot cancel this received dispatch because some of its stock has already been sold."
        );
      }

      await tx.branch.update({
        where: { id: existing.branchId },
        data: {
          currentBirdStock: { decrement: existing.totalBirdCount },
          currentWeightStock: { decrement: new Prisma.Decimal(stockWeight) },
        },
      });

      await tx.stockMovement.create({
        data: {
          date: new Date(),
          branchId: existing.branchId,
          movementType: MovementType.ADJUSTMENT,
          birdCount: -existing.totalBirdCount,
          weight: new Prisma.Decimal(-stockWeight),
          referenceId: existing.id,
          referenceType: "HenDispatchCancel",
          notes: `Reversed received dispatch ${existing.dispatchNumber}: ${input.reason}`,
          createdById: actor.id,
        },
      });
    }

    const row = await tx.henDispatch.update({
      where: { id: existing.id },
      data: {
        status: DispatchStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
      include: dispatchInclude,
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: existing.branchId,
      action: "CANCEL_DISPATCH",
      entityType: "HenDispatch",
      entityId: existing.id,
      oldValues: { status: existing.status },
      newValues: { status: "CANCELLED", reason: input.reason },
    });

    return row;
  });

  return mapDispatchToDTO(updated);
}
