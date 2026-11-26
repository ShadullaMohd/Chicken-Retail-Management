import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface AuditLogInput {
  userId: string;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

/**
 * Persists an audit trail entry using the supplied Prisma client or active transaction.
 */
export async function recordAuditLog(
  db: DbClient,
  input: AuditLogInput
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      branchId: input.branchId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValues: input.oldValues,
      newValues: input.newValues,
    },
  });
}
