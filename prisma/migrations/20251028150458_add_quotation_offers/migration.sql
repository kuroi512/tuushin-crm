-- CreateTable
CREATE TABLE "quotation_offers" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "title" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "offerNumber" TEXT,
    "transportMode" TEXT,
    "routeSummary" TEXT,
    "shipmentCondition" TEXT,
    "transitTime" TEXT,
    "rate" DOUBLE PRECISION,
    "rateCurrency" TEXT,
    "grossWeight" DOUBLE PRECISION,
    "dimensionsCbm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_offers_quotationId_order_idx" ON "quotation_offers"("quotationId", "order");

-- AddForeignKey
ALTER TABLE "quotation_offers" ADD CONSTRAINT "quotation_offers_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
