-- CreateEnum
CREATE TYPE "QuotationTextCategory" AS ENUM ('INCLUDE', 'EXCLUDE', 'REMARK');

-- CreateTable
CREATE TABLE "quotation_texts" (
    "id" TEXT NOT NULL,
    "text_en" TEXT NOT NULL,
    "text_mn" TEXT NOT NULL,
    "text_ru" TEXT NOT NULL,
    "category" "QuotationTextCategory" NOT NULL,
    "incotermIds" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_texts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_texts_category_idx" ON "quotation_texts"("category");

-- CreateIndex
CREATE INDEX "quotation_texts_isActive_idx" ON "quotation_texts"("isActive");

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN "include" JSONB,
ADD COLUMN "exclude" JSONB,
ADD COLUMN "remark" JSONB;

