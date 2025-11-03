-- DropForeignKey
ALTER TABLE "public"."MessageRead" DROP CONSTRAINT "MessageRead_messageId_fkey";

-- AddForeignKey
ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
