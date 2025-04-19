/*
  Warnings:

  - The values [ORGANIZATION,DEPARTMENT,TEAM,PROJECT,TASK] on the enum `ReportType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `updatedAt` to the `reports` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- AlterEnum
BEGIN;
CREATE TYPE "ReportType_new" AS ENUM ('ORGANIZATION_SUMMARY', 'ORGANIZATION_ACTIVITY', 'DEPARTMENT_PERFORMANCE', 'TEAM_PRODUCTIVITY', 'PROJECT_STATUS', 'PROJECT_TIMELINE', 'TASK_COMPLETION', 'USER_PERFORMANCE', 'USER_ACTIVITY', 'SPRINT_BURNDOWN', 'CUSTOM');
ALTER TABLE "reports" ALTER COLUMN "reportType" TYPE "ReportType_new" USING ("reportType"::text::"ReportType_new");
ALTER TYPE "ReportType" RENAME TO "ReportType_old";
ALTER TYPE "ReportType_new" RENAME TO "ReportType";
DROP TYPE "ReportType_old";
COMMIT;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN     "scheduleId" UUID,
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tags" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "cronExpression" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_notifications" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "report_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_notifications_reportId_userId_key" ON "report_notifications"("reportId", "userId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "report_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_notifications" ADD CONSTRAINT "report_notifications_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_notifications" ADD CONSTRAINT "report_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
