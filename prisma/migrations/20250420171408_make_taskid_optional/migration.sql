-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activitylog_task_fkey";

-- AlterTable
ALTER TABLE "activity_logs" ALTER COLUMN "taskId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_task_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
