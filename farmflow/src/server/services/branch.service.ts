import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { AuthActor } from "@/lib/permissions";
import { canAccessAllBranches, canAccessBranch } from "@/lib/permissions";
import type {
  BranchFormValues,
  ToggleBranchStatusInput,
  UpdateBranchInput,
} from "@/lib/validations/branch";
import { recordAuditLog } from "./audit.service";

export interface BranchDTO {
  id: string;
  name: string;
  code: string;
  address: string | null;
  contactNumber: string | null;
  managerId: string | null;
  managerName: string | null;
  managerEmail: string | null;
  currentBirdStock: number;
  currentWeightStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    henDispatches: number;
    retailSales: number;
    expenses: number;
  };
}

export interface ManagerOptionDTO {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface BranchDetailDTO extends BranchDTO {
  assignedStaff: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
  }[];
  counts: {
    dispatches: number;
    sales: number;
    expenses: number;
    dailyClosings: number;
  };
}

function mapBranchToDTO(
  branch: Prisma.BranchGetPayload<{
    include: {
      manager: { select: { id: true; name: true; email: true } };
      _count: {
        select: { henDispatches: true; retailSales: true; expenses: true };
      };
    };
  }>
): BranchDTO {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    contactNumber: branch.contactNumber,
    managerId: branch.managerId,
    managerName: branch.manager?.name ?? null,
    managerEmail: branch.manager?.email ?? null,
    currentBirdStock: branch.currentBirdStock,
    currentWeightStock: Number(branch.currentWeightStock),
    isActive: branch.isActive,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
    _count: branch._count,
  };
}

/**
 * Returns branches authorized for the current user, ordered by creation date.
 */
export async function getAuthorizedBranches(
  actor: AuthActor,
  options?: { activeOnly?: boolean }
): Promise<BranchDTO[]> {
  const where: Prisma.BranchWhereInput = {
    businessId: actor.businessId,
    ...(options?.activeOnly ? { isActive: true } : {}),
  };

  if (!canAccessAllBranches(actor.role)) {
    where.id = { in: actor.branchIds.length > 0 ? actor.branchIds : ["__none__"] };
  }

  const branches = await prisma.branch.findMany({
    where,
    include: {
      manager: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: {
          henDispatches: true,
          retailSales: true,
          expenses: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return branches.map(mapBranchToDTO);
}

/**
 * Returns full details for a single branch if the actor is authorized to view it.
 */
export async function getBranchDetail(
  branchId: string,
  actor: AuthActor
): Promise<BranchDetailDTO | null> {
  if (!canAccessBranch(actor, branchId)) {
    return null;
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      businessId: actor.businessId,
    },
    include: {
      manager: {
        select: { id: true, name: true, email: true },
      },
      userBranches: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              phone: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          henDispatches: true,
          retailSales: true,
          expenses: true,
          dailyClosings: true,
        },
      },
    },
  });

  if (!branch) {
    return null;
  }

  const dto = mapBranchToDTO(branch);

  return {
    ...dto,
    assignedStaff: branch.userBranches
      .filter((ub) => ub.user.isActive)
      .map((ub) => ({
        id: ub.user.id,
        name: ub.user.name,
        email: ub.user.email,
        role: ub.user.role,
        phone: ub.user.phone,
      })),
    counts: {
      dispatches: branch._count.henDispatches,
      sales: branch._count.retailSales,
      expenses: branch._count.expenses,
      dailyClosings: branch._count.dailyClosings,
    },
  };
}

/**
 * Lists active users eligible to manage a branch.
 */
export async function getAvailableManagers(
  businessId: string
): Promise<ManagerOptionDTO[]> {
  return prisma.user.findMany({
    where: {
      businessId,
      isActive: true,
      role: { in: ["OWNER", "BRANCH_MANAGER"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });
}

async function validateManagerInBusiness(
  tx: Prisma.TransactionClient,
  managerId: string | null,
  businessId: string
): Promise<void> {
  if (!managerId) return;

  const manager = await tx.user.findFirst({
    where: {
      id: managerId,
      businessId,
      isActive: true,
      role: { in: ["OWNER", "BRANCH_MANAGER"] },
    },
    select: { id: true },
  });

  if (!manager) {
    throw new Error("Selected branch manager is invalid or inactive.");
  }
}

export async function createBranch(
  input: BranchFormValues,
  actor: AuthActor
): Promise<BranchDTO> {
  const normalizedManagerId =
    input.managerId && input.managerId !== "none" ? input.managerId : null;

  const created = await prisma.$transaction(async (tx) => {
    await validateManagerInBusiness(tx, normalizedManagerId, actor.businessId);

    const existingCode = await tx.branch.findUnique({
      where: { code: input.code },
      select: { id: true },
    });
    if (existingCode) {
      throw new Error(`Branch code "${input.code}" is already in use.`);
    }

    const branch = await tx.branch.create({
      data: {
        businessId: actor.businessId,
        name: input.name,
        code: input.code,
        address: input.address || null,
        contactNumber: input.contactNumber || null,
        managerId: normalizedManagerId,
        isActive: input.isActive,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: {
          select: { henDispatches: true, retailSales: true, expenses: true },
        },
      },
    });

    if (normalizedManagerId) {
      await tx.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: normalizedManagerId,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: normalizedManagerId,
          branchId: branch.id,
        },
      });
    }

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: branch.id,
      action: "CREATE_BRANCH",
      entityType: "Branch",
      entityId: branch.id,
      newValues: {
        name: branch.name,
        code: branch.code,
        managerId: branch.managerId,
        isActive: branch.isActive,
      },
    });

    return branch;
  });

  return mapBranchToDTO(created);
}

export async function updateBranch(
  input: UpdateBranchInput,
  actor: AuthActor
): Promise<BranchDTO> {
  const normalizedManagerId =
    input.managerId && input.managerId !== "none" ? input.managerId : null;

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.branch.findFirst({
      where: {
        id: input.id,
        businessId: actor.businessId,
      },
    });

    if (!existing) {
      throw new Error("Branch not found.");
    }

    await validateManagerInBusiness(tx, normalizedManagerId, actor.businessId);

    if (input.code !== existing.code) {
      const duplicateCode = await tx.branch.findUnique({
        where: { code: input.code },
        select: { id: true },
      });
      if (duplicateCode) {
        throw new Error(`Branch code "${input.code}" is already in use.`);
      }
    }

    const branch = await tx.branch.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        code: input.code,
        address: input.address || null,
        contactNumber: input.contactNumber || null,
        managerId: normalizedManagerId,
        isActive: input.isActive,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: {
          select: { henDispatches: true, retailSales: true, expenses: true },
        },
      },
    });

    if (normalizedManagerId) {
      await tx.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: normalizedManagerId,
            branchId: branch.id,
          },
        },
        update: {},
        create: {
          userId: normalizedManagerId,
          branchId: branch.id,
        },
      });
    }

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: branch.id,
      action: "UPDATE_BRANCH",
      entityType: "Branch",
      entityId: branch.id,
      oldValues: {
        name: existing.name,
        code: existing.code,
        address: existing.address,
        contactNumber: existing.contactNumber,
        managerId: existing.managerId,
        isActive: existing.isActive,
      },
      newValues: {
        name: branch.name,
        code: branch.code,
        address: branch.address,
        contactNumber: branch.contactNumber,
        managerId: branch.managerId,
        isActive: branch.isActive,
      },
    });

    return branch;
  });

  return mapBranchToDTO(updated);
}

export async function toggleBranchStatus(
  input: ToggleBranchStatusInput,
  actor: AuthActor
): Promise<BranchDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.branch.findFirst({
      where: {
        id: input.id,
        businessId: actor.businessId,
      },
    });

    if (!existing) {
      throw new Error("Branch not found.");
    }

    const branch = await tx.branch.update({
      where: { id: existing.id },
      data: { isActive: input.isActive },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: {
          select: { henDispatches: true, retailSales: true, expenses: true },
        },
      },
    });

    await recordAuditLog(tx, {
      userId: actor.id,
      branchId: branch.id,
      action: input.isActive ? "ACTIVATE_BRANCH" : "DEACTIVATE_BRANCH",
      entityType: "Branch",
      entityId: branch.id,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive: branch.isActive },
    });

    return branch;
  });

  return mapBranchToDTO(updated);
}
