import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaModelCount?: string;
};

// Track schema field fingerprint in dev so schema changes never reuse a stale global client
const currentSchemaSignature = Prisma.dmmf.datamodel.models
  .map((m) => `${m.name}:${m.fields.length}`)
  .join("|");

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export const prisma =
  globalForPrisma.prisma &&
  globalForPrisma.prismaModelCount === currentSchemaSignature
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaModelCount = currentSchemaSignature;
}

export default prisma;
