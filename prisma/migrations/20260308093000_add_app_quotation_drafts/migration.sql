-- CreateTable
CREATE TABLE IF NOT EXISTS "app_quotation_drafts" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdById" TEXT,
  "createdByEmail" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "app_quotation_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_quotation_drafts_createdById_idx" ON "app_quotation_drafts"("createdById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_quotation_drafts_createdByEmail_idx" ON "app_quotation_drafts"("createdByEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "app_quotation_drafts_updatedAt_idx" ON "app_quotation_drafts"("updatedAt");
