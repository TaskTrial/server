/*
  Warnings:

  - You are about to drop the column `entityId` on the `reports` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `reports` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,name]` on the table `departments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,userId]` on the table `organization_owners` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId,name]` on the table `sprints` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[taskId,dependentTaskId]` on the table `task_dependencies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teamId,userId]` on the table `team_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,name]` on the table `teams` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `storageKey` to the `reports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storageKey` to the `task_attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'PROJECT';
ALTER TYPE "EntityType" ADD VALUE 'TASK';
ALTER TYPE "EntityType" ADD VALUE 'USER';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'REVIEW';

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_organization_entityId_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_team_entityId_fkey";

-- DropIndex
DROP INDEX "reports_entityId_idx";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "entityId" UUID,
ADD COLUMN     "entityType" VARCHAR(50);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactEmail" VARCHAR(255),
ADD COLUMN     "contactPhone" VARCHAR(50);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "budget" DOUBLE PRECISION,
ADD COLUMN     "lastModifiedBy" UUID,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "progress" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "reports" DROP COLUMN "entityId",
DROP COLUMN "entityType",
ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "organizationId" UUID,
ADD COLUMN     "projectId" UUID,
ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "storageProvider" VARCHAR(50),
ADD COLUMN     "teamId" UUID,
ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "sprints" ADD COLUMN     "goal" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "task_attachments" ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "storageProvider" VARCHAR(50);

-- AlterTable
ALTER TABLE "task_dependencies" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "actualTime" DOUBLE PRECISION,
ADD COLUMN     "estimatedTime" DOUBLE PRECISION,
ADD COLUMN     "labels" TEXT[],
ADD COLUMN     "lastModifiedBy" UUID,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentId" UUID;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "avatar" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "jobTitle" VARCHAR(100),
ADD COLUMN     "phoneNumber" VARCHAR(50),
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "timezone" VARCHAR(50);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL,
    "estimatedTime" DOUBLE PRECISION,
    "organizationId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "checklist" JSONB,
    "labels" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_entityId_entityType_idx" ON "activity_logs"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "task_templates_organizationId_idx" ON "task_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_organizationId_name_key" ON "task_templates"("organizationId", "name");

-- CreateIndex
CREATE INDEX "permissions_entityId_entityType_idx" ON "permissions"("entityId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_userId_entityType_entityId_key" ON "permissions"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organizationId_name_key" ON "departments"("organizationId", "name");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_entityId_entityType_idx" ON "notifications"("entityId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "organization_owners_organizationId_userId_key" ON "organization_owners"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organizationId_name_key" ON "projects"("organizationId", "name");

-- CreateIndex
CREATE INDEX "reports_organizationId_idx" ON "reports"("organizationId");

-- CreateIndex
CREATE INDEX "reports_teamId_idx" ON "reports"("teamId");

-- CreateIndex
CREATE INDEX "reports_projectId_idx" ON "reports"("projectId");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "sprints_status_idx" ON "sprints"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sprints_projectId_name_key" ON "sprints"("projectId", "name");

-- CreateIndex
CREATE INDEX "task_attachments_fileType_idx" ON "task_attachments"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_taskId_dependentTaskId_key" ON "task_dependencies"("taskId", "dependentTaskId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organizationId_name_key" ON "teams"("organizationId", "name");

-- CreateIndex
CREATE INDEX "timelogs_startTime_endTime_idx" ON "timelogs"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_organization_fkey" FOREIGN KEY ("entityId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_project_fkey" FOREIGN KEY ("entityId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_team_fkey" FOREIGN KEY ("entityId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_task_fkey" FOREIGN KEY ("entityId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_lastModifiedBy_fkey" FOREIGN KEY ("lastModifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lastModifiedBy_fkey" FOREIGN KEY ("lastModifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
