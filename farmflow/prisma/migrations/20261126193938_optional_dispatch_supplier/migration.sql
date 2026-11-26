-- DropForeignKey
ALTER TABLE "HenDispatch" DROP CONSTRAINT "HenDispatch_supplierId_fkey";

-- AlterTable
ALTER TABLE "HenDispatch" ALTER COLUMN "supplierId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "HenDispatch" ADD CONSTRAINT "HenDispatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
