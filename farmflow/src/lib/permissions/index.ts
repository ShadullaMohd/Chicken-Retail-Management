import type { Role } from "@prisma/client";

export interface AuthActor {
  id: string;
  name: string;
  email: string;
  role: Role;
  businessId: string;
  branchIds: string[];
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  BRANCH_MANAGER: "Branch Manager",
  SALES_EMPLOYEE: "Sales Employee",
};

export function canAccessAllBranches(role: Role): boolean {
  return role === "OWNER";
}

export function canManageBranches(role: Role): boolean {
  return role === "OWNER";
}

export function canManageUsers(role: Role): boolean {
  return role === "OWNER";
}

export function canManageSettings(role: Role): boolean {
  return role === "OWNER";
}

export function canManageDispatches(role: Role): boolean {
  return role === "OWNER" || role === "BRANCH_MANAGER";
}

export function canRecordSales(role: Role): boolean {
  return (
    role === "OWNER" ||
    role === "BRANCH_MANAGER" ||
    role === "SALES_EMPLOYEE"
  );
}

export function canManageExpenses(role: Role): boolean {
  return role === "OWNER" || role === "BRANCH_MANAGER";
}

export function canViewReports(role: Role): boolean {
  return role === "OWNER" || role === "BRANCH_MANAGER";
}

export function canPerformDailyClosing(role: Role): boolean {
  return role === "OWNER" || role === "BRANCH_MANAGER";
}

export function canAccessBranch(actor: AuthActor, branchId: string): boolean {
  if (actor.role === "OWNER") {
    return true;
  }
  return actor.branchIds.includes(branchId);
}
