-- CreateEnum
CREATE TYPE "MasterCategory" AS ENUM ('TYPE', 'OWNERSHIP', 'CUSTOMER', 'AGENT', 'COUNTRY', 'PORT', 'AREA', 'EXCHANGE', 'SALES', 'MANAGER');

-- CreateEnum
CREATE TYPE "MasterSource" AS ENUM ('EXTERNAL', 'INTERNAL');

-- CreateTable
CREATE TABLE "master_options" (
    "id" TEXT NOT NULL,
    "category" "MasterCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "source" "MasterSource" NOT NULL DEFAULT 'EXTERNAL',
    "code" TEXT,
    "meta" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_options_externalId_key" ON "master_options"("externalId");

-- CreateIndex
CREATE INDEX "master_options_category_idx" ON "master_options"("category");

-- CreateIndex
CREATE INDEX "master_options_category_name_idx" ON "master_options"("category", "name");
