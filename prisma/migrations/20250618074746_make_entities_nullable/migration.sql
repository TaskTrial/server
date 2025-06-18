-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_senderId_fkey";

-- DropForeignKey
ALTER TABLE "pinned_messages" DROP CONSTRAINT "pinned_messages_pinnedBy_fkey";

-- DropForeignKey
ALTER TABLE "video_conference_sessions" DROP CONSTRAINT "video_conference_sessions_hostId_fkey";

-- DropForeignKey
ALTER TABLE "video_participants" DROP CONSTRAINT "video_participants_userId_fkey";

-- DropForeignKey
ALTER TABLE "video_recordings" DROP CONSTRAINT "video_recordings_recordedBy_fkey";

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pinned_messages" ADD CONSTRAINT "pinned_messages_pinnedBy_fkey" FOREIGN KEY ("pinnedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_conference_sessions" ADD CONSTRAINT "video_conference_sessions_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_participants" ADD CONSTRAINT "video_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_recordings" ADD CONSTRAINT "video_recordings_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
