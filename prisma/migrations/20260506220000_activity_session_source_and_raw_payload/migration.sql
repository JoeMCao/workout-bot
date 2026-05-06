-- AlterTable
ALTER TABLE "ActivitySession" ADD COLUMN "sourceActivityType" TEXT,
ADD COLUMN "rawPayloadJson" JSONB;
