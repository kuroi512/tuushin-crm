-- CreateEnum
CREATE TYPE "QuotationRuleType" AS ENUM ('INCLUDE', 'EXCLUDE', 'REMARK');

-- CreateTable
CREATE TABLE "quotation_rule_snippets" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "QuotationRuleType" NOT NULL,
    "incoterm" TEXT,
    "transportMode" TEXT,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotation_rule_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_rule_defaults" (
    "id" TEXT NOT NULL,
    "incoterm" TEXT,
    "transportMode" TEXT,
    "type" "QuotationRuleType" NOT NULL,
    "snippetIds" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotation_rule_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_rule_snippets_type_idx" ON "quotation_rule_snippets"("type");
CREATE INDEX "quotation_rule_snippets_incoterm_idx" ON "quotation_rule_snippets"("incoterm");
CREATE INDEX "quotation_rule_snippets_transportMode_idx" ON "quotation_rule_snippets"("transportMode");
CREATE INDEX "quotation_rule_snippets_incoterm_transportMode_type_idx" ON "quotation_rule_snippets"("incoterm", "transportMode", "type");

CREATE UNIQUE INDEX "quotation_rule_defaults_incoterm_transportMode_type_key" ON "quotation_rule_defaults"("incoterm", "transportMode", "type");
CREATE INDEX "quotation_rule_defaults_type_idx" ON "quotation_rule_defaults"("type");
CREATE INDEX "quotation_rule_defaults_incoterm_idx" ON "quotation_rule_defaults"("incoterm");
CREATE INDEX "quotation_rule_defaults_transportMode_idx" ON "quotation_rule_defaults"("transportMode");

-- AddForeignKey
ALTER TABLE "quotation_rule_snippets"
  ADD CONSTRAINT "quotation_rule_snippets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotation_rule_snippets"
  ADD CONSTRAINT "quotation_rule_snippets_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotation_rule_defaults"
  ADD CONSTRAINT "quotation_rule_defaults_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
