/*
  Warnings:

  - Added the required column `resettoken` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resettokenExpiry` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "resettoken" TEXT NOT NULL,
ADD COLUMN     "resettokenExpiry" INTEGER NOT NULL;
