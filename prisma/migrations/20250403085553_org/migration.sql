/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationOTP" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");
