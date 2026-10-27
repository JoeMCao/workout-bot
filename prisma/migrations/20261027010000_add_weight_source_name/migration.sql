-- Legacy uploads did not contain the originating app. Preserve that uncertainty;
-- a retry with sourceName can enrich the same record without creating a duplicate.
ALTER TABLE "BodyWeight" ADD COLUMN "sourceName" TEXT;
