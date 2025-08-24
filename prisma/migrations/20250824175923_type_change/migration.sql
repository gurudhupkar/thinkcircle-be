/*
  Warnings:

  - The `resettokenExpiry` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "resettoken" DROP NOT NULL,
DROP COLUMN "resettokenExpiry",
ADD COLUMN     "resettokenExpiry" TIMESTAMP(3);
