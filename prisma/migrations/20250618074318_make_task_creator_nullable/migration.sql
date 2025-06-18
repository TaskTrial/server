-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_createdBy_fkey";

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
