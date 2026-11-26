-- AlterTable
ALTER TABLE "RetailSale" ADD COLUMN     "closingStockKg" DECIMAL(10,2),
ADD COLUMN     "mortalityWeightKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
ALTER COLUMN "numberOfBirdsSold" SET DEFAULT 0;
