-- CreateTable
CREATE TABLE "sales_kpi_measurements" (
    "id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "salesName" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "plannedRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_kpi_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_kpi_measurements_month_idx" ON "sales_kpi_measurements"("month");

-- CreateIndex
CREATE UNIQUE INDEX "sales_kpi_measurements_month_matchKey_key" ON "sales_kpi_measurements"("month", "matchKey");
