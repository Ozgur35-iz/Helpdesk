-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- Best-effort backfill for tickets resolved before this column existed.
-- updatedAt is only an approximation of the real resolution time.
UPDATE "ticket" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('resolved', 'closed');
