/*
  Warnings:

  - You are about to drop the column `cityId` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `countryId` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `cityId` on the `ports` table. All the data in the column will be lost.
  - You are about to drop the column `countryId` on the `ports` table. All the data in the column will be lost.
  - You are about to drop the column `inquiryId` on the `quotations` table. All the data in the column will be lost.
  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `countries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_communications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inquiries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inquiry_attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inquiry_communications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inquiry_extras` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inquiry_offers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inquiry_rates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inquiry_sizes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipment_tracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "cities" DROP CONSTRAINT "cities_countryId_fkey";

-- DropForeignKey
ALTER TABLE "customer_communications" DROP CONSTRAINT "customer_communications_customerId_fkey";

-- DropForeignKey
ALTER TABLE "customer_communications" DROP CONSTRAINT "customer_communications_userId_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_cityId_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_countryId_fkey";

-- DropForeignKey
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_createdById_fkey";

-- DropForeignKey
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_customerId_fkey";

-- DropForeignKey
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_customsAgentId_fkey";

-- DropForeignKey
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_operatorId_fkey";

-- DropForeignKey
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_salesPersonId_fkey";

-- DropForeignKey
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_attachments" DROP CONSTRAINT "inquiry_attachments_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_attachments" DROP CONSTRAINT "inquiry_attachments_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_communications" DROP CONSTRAINT "inquiry_communications_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_communications" DROP CONSTRAINT "inquiry_communications_senderId_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_extras" DROP CONSTRAINT "inquiry_extras_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_offers" DROP CONSTRAINT "inquiry_offers_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_rates" DROP CONSTRAINT "inquiry_rates_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "inquiry_sizes" DROP CONSTRAINT "inquiry_sizes_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "ports" DROP CONSTRAINT "ports_cityId_fkey";

-- DropForeignKey
ALTER TABLE "ports" DROP CONSTRAINT "ports_countryId_fkey";

-- DropForeignKey
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_inquiryId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "shipment_tracking" DROP CONSTRAINT "shipment_tracking_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "shipment_tracking" DROP CONSTRAINT "shipment_tracking_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_customerId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_quotationId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_userId_fkey";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "cityId",
DROP COLUMN "countryId";

-- AlterTable
ALTER TABLE "ports" DROP COLUMN "cityId",
DROP COLUMN "countryId";

-- AlterTable
ALTER TABLE "quotations" DROP COLUMN "inquiryId";

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "cities";

-- DropTable
DROP TABLE "countries";

-- DropTable
DROP TABLE "customer_communications";

-- DropTable
DROP TABLE "inquiries";

-- DropTable
DROP TABLE "inquiry_attachments";

-- DropTable
DROP TABLE "inquiry_communications";

-- DropTable
DROP TABLE "inquiry_extras";

-- DropTable
DROP TABLE "inquiry_offers";

-- DropTable
DROP TABLE "inquiry_rates";

-- DropTable
DROP TABLE "inquiry_sizes";

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "shipment_tracking";

-- DropTable
DROP TABLE "shipments";

-- DropTable
DROP TABLE "system_settings";

-- DropTable
DROP TABLE "verification_tokens";

-- DropEnum
DROP TYPE "AttachmentType";

-- DropEnum
DROP TYPE "CommunicationDirection";

-- DropEnum
DROP TYPE "CommunicationStatus";

-- DropEnum
DROP TYPE "CommunicationType";

-- DropEnum
DROP TYPE "CustomerCommunicationType";

-- DropEnum
DROP TYPE "Incoterm";

-- DropEnum
DROP TYPE "InquiryStatus";

-- DropEnum
DROP TYPE "OfferStatus";

-- DropEnum
DROP TYPE "Priority";

-- DropEnum
DROP TYPE "RateType";

-- DropEnum
DROP TYPE "ShipmentStatus";

-- DropEnum
DROP TYPE "TransportMode";
