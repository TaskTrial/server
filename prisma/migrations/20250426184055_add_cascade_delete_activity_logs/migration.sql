-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activitylog_user_fkey";

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activitylog_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
