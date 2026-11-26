import { startOfDay, endOfDay } from "date-fns";
import { PaymentMethod, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { AuthActor } from "@/lib/permissions";
import {
  canAccessAllBranches,
  canAccessBranch,
  canManageExpenses,
} from "@/lib/permissions";
import type {
  CreateExpenseCategoryValues,
  CreateExpensesBulkValues,
  DeleteExpenseValues,
  ToggleExpenseCategoryValues,
  UpdateExpenseValues,
} from "@/lib/validations/expense";
import { recordAuditLog } from "./audit.service";

export interface ExpenseCategoryDTO {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  expenseCount: number;
}

export interface ExpenseDTO {
  id: string;
  expenseDate: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFilterParams {
  search?: string;
  branchId?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod | "ALL";
  startDate?: string;
  endDate?: string;
  referenceDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TodayExpenseSummary {
  totalAmount: number;
  count: number;
  cashTotal: number;
  upiTotal: number;
  bankTransferTotal: number;
  otherTotal: number;
}

export interface ExpenseListResult {
  items: ExpenseDTO[];
  total: number;
  page: number;
  pageSize: number;
  todaySummary: TodayExpenseSummary;
  filteredSummary: {
    totalAmount: number;
    count: number;
  };
}

export interface BulkCreateExpensesResult {
  createdCount: number;
  totalAmount: number;
  items: ExpenseDTO[];
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseLocalDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parsed = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const expenseInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.ExpenseInclude;

type ExpenseRow = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

function mapExpenseToDTO(row: ExpenseRow): ExpenseDTO {
  return {
    id: row.id,
    expenseDate: row.expenseDate.toISOString(),
    branchId: row.branchId,
    branchName: row.branch.name,
    branchCode: row.branch.code,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    amount: Number(row.amount),
    paymentMethod: row.paymentMethod,
    description: row.description,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getExpenseCategories(
  actor: AuthActor,
  options?: { activeOnly?: boolean }
): Promise<ExpenseCategoryDTO[]> {
  if (!canManageExpenses(actor.role)) {
    throw new Error("Forbidden: You do not have permission to view expenses.");
  }

  const categories = await prisma.expenseCategory.findMany({
    where: {
      businessId: actor.businessId,
      ...(options?.activeOnly ? { isActive: true } : {}),
    },
    include: {
      _count: {
        select: {
          expenses: {
            where: { deletedAt: null },
          },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { name: "asc" }],
  });

  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    isDefault: cat.isDefault,
    isActive: cat.isActive,
    expenseCount: cat._count.expenses,
  }));
}

export async function createExpenseCategory(
  input: CreateExpenseCategoryValues,
  actor: AuthActor
): Promise<ExpenseCategoryDTO> {
  if (!canManageExpenses(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can create expense categories."
    );
  }

  const existing = await prisma.expenseCategory.findFirst({
    where: {
      businessId: actor.businessId,
      name: { equals: input.name, mode: "insensitive" },
    },
  });

  if (existing) {
    if (!existing.isActive) {
      const reactivated = await prisma.expenseCategory.update({
        where: { id: existing.id },
        data: { isActive: true },
        include: {
          _count: {
            select: { expenses: { where: { deletedAt: null } } },
          },
        },
      });
      return {
        id: reactivated.id,
        name: reactivated.name,
        isDefault: reactivated.isDefault,
        isActive: reactivated.isActive,
        expenseCount: reactivated._count.expenses,
      };
    }
    throw new Error(`Category "${existing.name}" already exists.`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const cat = await tx.expenseCategory.create({
      data: {
        businessId: actor.businessId,
        name: input.name,
        isDefault: false,
        isActive: true,
      },
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      action: "CREATE_EXPENSE_CATEGORY",
      entityType: "ExpenseCategory",
      entityId: cat.id,
      newValues: { name: cat.name },
    });

    return cat;
  });

  return {
    id: created.id,
    name: created.name,
    isDefault: created.isDefault,
    isActive: created.isActive,
    expenseCount: 0,
  };
}

export async function toggleExpenseCategoryStatus(
  input: ToggleExpenseCategoryValues,
  actor: AuthActor
): Promise<ExpenseCategoryDTO> {
  if (!canManageExpenses(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can update categories."
    );
  }

  const existing = await prisma.expenseCategory.findFirst({
    where: {
      id: input.id,
      businessId: actor.businessId,
    },
    include: {
      _count: {
        select: { expenses: { where: { deletedAt: null } } },
      },
    },
  });

  if (!existing) {
    throw new Error("Expense category not found.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.expenseCategory.update({
      where: { id: existing.id },
      data: { isActive: input.isActive },
      include: {
        _count: {
          select: { expenses: { where: { deletedAt: null } } },
        },
      },
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      action: "TOGGLE_EXPENSE_CATEGORY",
      entityType: "ExpenseCategory",
      entityId: row.id,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive: row.isActive },
    });

    return row;
  });

  return {
    id: updated.id,
    name: updated.name,
    isDefault: updated.isDefault,
    isActive: updated.isActive,
    expenseCount: updated._count.expenses,
  };
}

export async function getExpenses(
  actor: AuthActor,
  filters: ExpenseFilterParams = {}
): Promise<ExpenseListResult> {
  if (!canManageExpenses(actor.role)) {
    throw new Error("Forbidden: You do not have permission to view expenses.");
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
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      todaySummary: {
        totalAmount: 0,
        count: 0,
        cashTotal: 0,
        upiTotal: 0,
        bankTransferTotal: 0,
        otherTotal: 0,
      },
      filteredSummary: {
        totalAmount: 0,
        count: 0,
      },
    };
  }

  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    branchId: { in: scopedBranchIds },
  };

  if (filters.categoryId && filters.categoryId !== "ALL") {
    where.categoryId = filters.categoryId;
  }

  if (filters.paymentMethod && filters.paymentMethod !== "ALL") {
    where.paymentMethod = filters.paymentMethod;
  }

  const parsedStart = filters.startDate
    ? parseLocalDate(filters.startDate)
    : null;
  const parsedEnd = filters.endDate ? parseLocalDate(filters.endDate) : null;

  if (parsedStart || parsedEnd) {
    where.expenseDate = {
      ...(parsedStart ? { gte: startOfDay(parsedStart) } : {}),
      ...(parsedEnd ? { lte: endOfDay(parsedEnd) } : {}),
    };
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { branch: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const todayRef =
    (filters.referenceDate ? parseLocalDate(filters.referenceDate) : null) ??
    new Date();

  const [total, rows, filteredAgg, todayByMethod] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.aggregate({
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["paymentMethod"],
      where: {
        deletedAt: null,
        branchId: { in: scopedBranchIds },
        expenseDate: {
          gte: startOfDay(todayRef),
          lte: endOfDay(todayRef),
        },
      },
      _count: { id: true },
      _sum: { amount: true },
    }),
  ]);

  let cashTotal = 0;
  let upiTotal = 0;
  let bankTransferTotal = 0;
  let otherTotal = 0;
  let todayCount = 0;

  for (const group of todayByMethod) {
    const sum = Number(group._sum.amount ?? 0);
    todayCount += group._count.id;
    switch (group.paymentMethod) {
      case "CASH":
        cashTotal = sum;
        break;
      case "UPI":
        upiTotal = sum;
        break;
      case "BANK_TRANSFER":
        bankTransferTotal = sum;
        break;
      case "OTHER":
        otherTotal = sum;
        break;
    }
  }

  const todayTotal = round2(
    cashTotal + upiTotal + bankTransferTotal + otherTotal
  );

  return {
    items: rows.map(mapExpenseToDTO),
    total,
    page,
    pageSize,
    todaySummary: {
      totalAmount: todayTotal,
      count: todayCount,
      cashTotal: round2(cashTotal),
      upiTotal: round2(upiTotal),
      bankTransferTotal: round2(bankTransferTotal),
      otherTotal: round2(otherTotal),
    },
    filteredSummary: {
      totalAmount: round2(Number(filteredAgg._sum.amount ?? 0)),
      count: filteredAgg._count.id,
    },
  };
}

export async function createExpensesBulk(
  input: CreateExpensesBulkValues,
  actor: AuthActor
): Promise<BulkCreateExpensesResult> {
  if (!canManageExpenses(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can record expenses."
    );
  }

  if (!canAccessBranch(actor, input.branchId)) {
    throw new Error("Forbidden: You do not have access to this branch.");
  }

  const expenseDate = parseLocalDate(input.expenseDate);
  if (!expenseDate) {
    throw new Error("Please select a valid expense date.");
  }

  const result = await prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existingBatch = await tx.expense.findMany({
        where: {
          idempotencyKey: { startsWith: `${input.idempotencyKey}:` },
          deletedAt: null,
        },
        include: expenseInclude,
        orderBy: { createdAt: "asc" },
      });

      if (existingBatch.length > 0) {
        return existingBatch;
      }
    }

    const branch = await tx.branch.findFirst({
      where: {
        id: input.branchId,
        businessId: actor.businessId,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (!branch) {
      throw new Error("Selected branch is invalid or inactive.");
    }

    const uniqueCategoryIds = Array.from(
      new Set(input.rows.map((r) => r.categoryId))
    );
    const categories = await tx.expenseCategory.findMany({
      where: {
        id: { in: uniqueCategoryIds },
        businessId: actor.businessId,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (categories.length !== uniqueCategoryIds.length) {
      throw new Error(
        "One or more selected expense categories are invalid or inactive."
      );
    }

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const createdRows: ExpenseRow[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const item = input.rows[i];
      const amount = round2(item.amount);
      const rowKey = input.idempotencyKey
        ? `${input.idempotencyKey}:${i}`
        : null;

      const created = await tx.expense.create({
        data: {
          expenseDate,
          branchId: branch.id,
          categoryId: item.categoryId,
          amount: new Prisma.Decimal(amount),
          paymentMethod: item.paymentMethod,
          description: item.description ?? null,
          idempotencyKey: rowKey,
          createdById: actor.id,
        },
        include: expenseInclude,
      });

      await recordAuditLog(tx, {
        userId: actor.id,
        branchId: branch.id,
        action: "CREATE_EXPENSE",
        entityType: "Expense",
        entityId: created.id,
        newValues: {
          branchId: branch.id,
          categoryId: item.categoryId,
          categoryName: categoryMap.get(item.categoryId) ?? "",
          amount,
          paymentMethod: item.paymentMethod,
          description: item.description ?? null,
          expenseDate: input.expenseDate,
        },
      });

      createdRows.push(created);
    }

    return createdRows;
  });

  const items = result.map(mapExpenseToDTO);
  const totalAmount = round2(items.reduce((sum, item) => sum + item.amount, 0));

  return {
    createdCount: items.length,
    totalAmount,
    items,
  };
}

export async function updateExpense(
  input: UpdateExpenseValues,
  actor: AuthActor
): Promise<ExpenseDTO> {
  if (!canManageExpenses(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can update expenses."
    );
  }

  const expenseDate = parseLocalDate(input.expenseDate);
  if (!expenseDate) {
    throw new Error("Please select a valid expense date.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({
      where: {
        id: input.id,
        deletedAt: null,
        branch: { businessId: actor.businessId },
      },
      include: expenseInclude,
    });

    if (!existing) {
      throw new Error("Expense record not found.");
    }

    if (
      !canAccessBranch(actor, existing.branchId) ||
      !canAccessBranch(actor, input.branchId)
    ) {
      throw new Error("Forbidden: You do not have access to this branch.");
    }

    const [targetBranch, category] = await Promise.all([
      tx.branch.findFirst({
        where: {
          id: input.branchId,
          businessId: actor.businessId,
          isActive: true,
        },
        select: { id: true },
      }),
      tx.expenseCategory.findFirst({
        where: {
          id: input.categoryId,
          businessId: actor.businessId,
        },
        select: { id: true, name: true, isActive: true },
      }),
    ]);

    if (!targetBranch) {
      throw new Error("Selected branch is invalid or inactive.");
    }

    if (!category || (!category.isActive && category.id !== existing.categoryId)) {
      throw new Error("Selected expense category is invalid or inactive.");
    }

    const amount = round2(input.amount);

    const row = await tx.expense.update({
      where: { id: existing.id },
      data: {
        expenseDate,
        branchId: input.branchId,
        categoryId: input.categoryId,
        amount: new Prisma.Decimal(amount),
        paymentMethod: input.paymentMethod,
        description: input.description ?? null,
      },
      include: expenseInclude,
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: row.branchId,
      action: "UPDATE_EXPENSE",
      entityType: "Expense",
      entityId: row.id,
      oldValues: {
        branchId: existing.branchId,
        categoryId: existing.categoryId,
        categoryName: existing.category.name,
        amount: Number(existing.amount),
        paymentMethod: existing.paymentMethod,
        description: existing.description,
      },
      newValues: {
        reason: input.correctionReason,
        branchId: row.branchId,
        categoryId: row.categoryId,
        categoryName: category.name,
        amount,
        paymentMethod: row.paymentMethod,
        description: row.description,
      },
    });

    return row;
  });

  return mapExpenseToDTO(updated);
}

export async function deleteExpense(
  input: DeleteExpenseValues,
  actor: AuthActor
): Promise<void> {
  if (!canManageExpenses(actor.role)) {
    throw new Error(
      "Forbidden: Only Owners or Branch Managers can remove expenses."
    );
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({
      where: {
        id: input.id,
        deletedAt: null,
        branch: { businessId: actor.businessId },
      },
      include: {
        category: { select: { name: true } },
      },
    });

    if (!existing) {
      throw new Error("Expense record not found.");
    }

    if (!canAccessBranch(actor, existing.branchId)) {
      throw new Error("Forbidden: You do not have access to this branch.");
    }

    await tx.expense.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: existing.branchId,
      action: "DELETE_EXPENSE",
      entityType: "Expense",
      entityId: existing.id,
      oldValues: {
        categoryId: existing.categoryId,
        categoryName: existing.category.name,
        amount: Number(existing.amount),
        paymentMethod: existing.paymentMethod,
        description: existing.description,
      },
      newValues: {
        deleted: true,
        reason: input.reason,
      },
    });
  });
}
