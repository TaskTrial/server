/*
  Warnings:

  - A unique constraint covering the columns `[joinCode]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "joinCode" VARCHAR(8);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_joinCode_key" ON "organizations"("joinCode");
