-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "legalName" TEXT,
    "registrationNumber" TEXT,
    "vatNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profile_translations" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "address" TEXT,
    "tagline" TEXT,
    "description" TEXT,
    "mission" TEXT,
    "vision" TEXT,
    "additionalInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_profile_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_profile_translations_companyProfileId_locale_key"
  ON "company_profile_translations"("companyProfileId", "locale");

-- AddForeignKey
ALTER TABLE "company_profile_translations"
  ADD CONSTRAINT "company_profile_translations_companyProfileId_fkey" FOREIGN KEY ("companyProfileId")
  REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
