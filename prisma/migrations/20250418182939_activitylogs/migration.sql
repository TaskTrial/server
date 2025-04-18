/*
  Warnings:

  - You are about to drop the column `entityId` on the `activity_logs` table. All the data in the column will be lost.
  - Added the required column `taskId` to the `activity_logs` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `entityType` on the `activity_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `action` on the `activity_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'COMMENTED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'MEMBER_ROLE_CHANGED', 'SPRINT_STARTED', 'SPRINT_COMPLETED', 'TASK_MOVED', 'LOGGED_TIME');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'DEPARTMENT';
ALTER TYPE "EntityType" ADD VALUE 'SPRINT';
ALTER TYPE "EntityType" ADD VALUE 'TASK_ATTACHMENT';
ALTER TYPE "EntityType" ADD VALUE 'TASK_DEPENDENCY';
ALTER TYPE "EntityType" ADD VALUE 'TASK_TEMPLATE';
ALTER TYPE "EntityType" ADD VALUE 'COMMENT';

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activitylog_organization_fkey";

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activitylog_project_fkey";

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activitylog_task_fkey";

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activitylog_team_fkey";

-- DropIndex
DROP INDEX "activity_logs_entityId_entityType_idx";

-- AlterTable
ALTER TABLE "activity_logs" DROP COLUMN "entityId",
ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "organizationId" UUID,
ADD COLUMN     "projectId" UUID,
ADD COLUMN     "sprintId" UUID,
ADD COLUMN     "taskId" UUID NOT NULL,
ADD COLUMN     "teamId" UUID,
DROP COLUMN "entityType",
ADD COLUMN     "entityType" "EntityType" NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "ActionType" NOT NULL;

-- CreateIndex
CREATE INDEX "activity_logs_organizationId_idx" ON "activity_logs"("organizationId");

-- CreateIndex
CREATE INDEX "activity_logs_departmentId_idx" ON "activity_logs"("departmentId");

-- CreateIndex
CREATE INDEX "activity_logs_projectId_idx" ON "activity_logs"("projectId");

-- CreateIndex
CREATE INDEX "activity_logs_teamId_idx" ON "activity_logs"("teamId");

-- CreateIndex
CREATE INDEX "activity_logs_sprintId_idx" ON "activity_logs"("sprintId");

-- CreateIndex
CREATE INDEX "activity_logs_taskId_idx" ON "activity_logs"("taskId");

-- RenameForeignKey
ALTER TABLE "activity_logs" RENAME CONSTRAINT "activity_logs_userId_fkey" TO "activitylog_user_fkey";

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_dept_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_project_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_team_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_sprint_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_task_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
