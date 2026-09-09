-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "aiResolutionReply" TEXT,
ALTER COLUMN "status" SET DEFAULT 'new';
