-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_createdBy_fkey";

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
