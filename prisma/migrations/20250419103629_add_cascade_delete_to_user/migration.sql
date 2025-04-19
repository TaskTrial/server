-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'VERIFIED';
ALTER TYPE "ActionType" ADD VALUE 'LOGO_UPDATED';
ALTER TYPE "ActionType" ADD VALUE 'SETTINGS_CHANGED';
ALTER TYPE "ActionType" ADD VALUE 'SUBSCRIPTION_CHANGED';
ALTER TYPE "ActionType" ADD VALUE 'TEAM_CREATED';
ALTER TYPE "ActionType" ADD VALUE 'TEAM_DELETED';
ALTER TYPE "ActionType" ADD VALUE 'DEPARTMENT_CREATED';
ALTER TYPE "ActionType" ADD VALUE 'DEPARTMENT_DELETED';
ALTER TYPE "ActionType" ADD VALUE 'OWNER_ADDED';
ALTER TYPE "ActionType" ADD VALUE 'OWNER_REMOVED';

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_userId_fkey";

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
