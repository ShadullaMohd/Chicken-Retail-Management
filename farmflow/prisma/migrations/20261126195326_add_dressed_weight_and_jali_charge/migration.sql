-- AlterTable
ALTER TABLE "HenDispatch" ADD COLUMN     "dressedWeight" DECIMAL(10,2),
ADD COLUMN     "jaliCharge" DECIMAL(10,2) NOT NULL DEFAULT 0;
