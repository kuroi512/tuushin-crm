/*
  Warnings:

  - The values [PLANNED,IN_PROGRESS,COMPLETED,CANCELLED] on the enum `AppSalesTaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AppSalesTaskStatus_new" AS ENUM ('MEET', 'CONTACT_BY_PHONE', 'MEETING_DATE', 'GIVE_INFO', 'CONTRACT');
ALTER TABLE "app_sales_tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "app_sales_tasks" ALTER COLUMN "status" TYPE "AppSalesTaskStatus_new" USING ("status"::text::"AppSalesTaskStatus_new");
ALTER TABLE "app_sales_task_status_logs" ALTER COLUMN "status" TYPE "AppSalesTaskStatus_new" USING ("status"::text::"AppSalesTaskStatus_new");
ALTER TYPE "AppSalesTaskStatus" RENAME TO "AppSalesTaskStatus_old";
ALTER TYPE "AppSalesTaskStatus_new" RENAME TO "AppSalesTaskStatus";
DROP TYPE "AppSalesTaskStatus_old";
ALTER TABLE "app_sales_tasks" ALTER COLUMN "status" SET DEFAULT 'MEET';
COMMIT;

-- AlterTable
ALTER TABLE "app_sales_task_status_logs" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "app_sales_tasks" ADD COLUMN     "progress" JSONB,
ALTER COLUMN "status" SET DEFAULT 'MEET';
