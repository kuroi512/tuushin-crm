-- AlterTable
ALTER TABLE "quotation_offers" ADD COLUMN     "borderPort" TEXT,
ADD COLUMN     "carrierRates" JSONB,
ADD COLUMN     "customerRates" JSONB,
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "exclude" TEXT,
ADD COLUMN     "extraServices" JSONB,
ADD COLUMN     "include" TEXT,
ADD COLUMN     "incoterm" TEXT,
ADD COLUMN     "profit" JSONB,
ADD COLUMN     "remark" TEXT,
ADD COLUMN     "shipper" TEXT,
ADD COLUMN     "terminal" TEXT;
