-- CreateEnum
CREATE TYPE "ExternalShipmentCategory" AS ENUM ('IMPORT', 'TRANSIT', 'EXPORT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AppSalesTaskStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "quotation_rule_defaults" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quotation_rule_snippets" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "external_shipments" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "category" "ExternalShipmentCategory" NOT NULL,
    "filterType" INTEGER,
    "syncLogId" TEXT,
    "number" INTEGER,
    "containerNumber" TEXT,
    "customerName" TEXT,
    "registeredAt" TIMESTAMP(3),
    "arrivalAt" TIMESTAMP(3),
    "transitEntryAt" TIMESTAMP(3),
    "currencyCode" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "profitMnt" DOUBLE PRECISION,
    "profitCurrency" DOUBLE PRECISION,
    "paymentType" TEXT,
    "salesManager" TEXT,
    "manager" TEXT,
    "note" TEXT,
    "extraServices" JSONB,
    "otherServices" JSONB,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_shipment_sync_logs" (
    "id" TEXT NOT NULL,
    "category" "ExternalShipmentCategory" NOT NULL,
    "filterType" INTEGER,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION DEFAULT 0,
    "totalProfitMnt" DOUBLE PRECISION DEFAULT 0,
    "totalProfitCur" DOUBLE PRECISION DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'SUCCESS',
    "message" TEXT,

    CONSTRAINT "external_shipment_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sales_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "meetingDate" TIMESTAMP(3),
    "clientName" TEXT NOT NULL,
    "salesManagerId" TEXT,
    "salesManagerName" TEXT,
    "originCountry" TEXT,
    "destinationCountry" TEXT,
    "commodity" TEXT,
    "mainComment" TEXT,
    "status" "AppSalesTaskStatus" NOT NULL DEFAULT 'PLANNED',
    "payload" JSONB,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_sales_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sales_task_status_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "AppSalesTaskStatus" NOT NULL,
    "comment" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_sales_task_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_shipments_externalId_category_key" ON "external_shipments"("externalId", "category");

-- CreateIndex
CREATE INDEX "app_sales_tasks_status_idx" ON "app_sales_tasks"("status");

-- CreateIndex
CREATE INDEX "app_sales_tasks_salesManagerId_idx" ON "app_sales_tasks"("salesManagerId");

-- CreateIndex
CREATE INDEX "app_sales_tasks_createdById_idx" ON "app_sales_tasks"("createdById");

-- CreateIndex
CREATE INDEX "app_sales_task_status_logs_taskId_idx" ON "app_sales_task_status_logs"("taskId");

-- CreateIndex
CREATE INDEX "app_sales_task_status_logs_createdAt_idx" ON "app_sales_task_status_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "external_shipments" ADD CONSTRAINT "external_shipments_syncLogId_fkey" FOREIGN KEY ("syncLogId") REFERENCES "external_shipment_sync_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sales_tasks" ADD CONSTRAINT "app_sales_tasks_salesManagerId_fkey" FOREIGN KEY ("salesManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sales_tasks" ADD CONSTRAINT "app_sales_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sales_task_status_logs" ADD CONSTRAINT "app_sales_task_status_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "app_sales_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_sales_task_status_logs" ADD CONSTRAINT "app_sales_task_status_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
