-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "departmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phoneNumber" SET DATA TYPE VARCHAR(255);
