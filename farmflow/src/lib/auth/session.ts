import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth/auth";
import { canAccessBranch, type AuthActor } from "@/lib/permissions";

/**
 * Loads the current authenticated and active user directly from PostgreSQL,
 * resolving live role and branch assignments per request.
 */
export const getCurrentUser = cache(async (): Promise<AuthActor | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      businessId: true,
      isActive: true,
      userBranches: {
        select: { branchId: true },
      },
      managedBranches: {
        select: { id: true },
      },
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  let branchIds: string[];
  if (user.role === "OWNER") {
    const allBranches = await prisma.branch.findMany({
      where: { businessId: user.businessId },
      select: { id: true },
    });
    branchIds = allBranches.map((b) => b.id);
  } else {
    const assigned = new Set<string>([
      ...user.userBranches.map((ub) => ub.branchId),
      ...user.managedBranches.map((b) => b.id),
    ]);
    branchIds = Array.from(assigned);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
    branchIds,
  };
});

/**
 * Ensures an active authenticated user in Server Components (redirects to /login).
 */
export async function requireCurrentUser(): Promise<AuthActor> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Ensures an active authenticated user inside Server Actions and Route Handlers.
 */
export async function requireActionUser(): Promise<AuthActor> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: Please sign in to continue.");
  }
  return user;
}

/**
 * Ensures the active user holds one of the permitted roles.
 */
export async function requireRole(allowedRoles: Role[]): Promise<AuthActor> {
  const user = await requireActionUser();
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden: You do not have permission for this action.");
  }
  return user;
}

/**
 * Verifies that the active user belongs to the branch's business and has access to branchId.
 */
export async function requireBranchAccess(
  branchId: string,
  actor?: AuthActor
): Promise<AuthActor> {
  const user = actor ?? (await requireActionUser());

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      businessId: user.businessId,
    },
    select: { id: true },
  });

  if (!branch) {
    throw new Error("Branch not found.");
  }

  if (!canAccessBranch(user, branch.id)) {
    throw new Error("Forbidden: You do not have access to this branch.");
  }

  return user;
}
