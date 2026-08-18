-- CreateTable
CREATE TABLE "WriteEvent" (
    "id" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WriteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WriteEvent_clientEventId_key" ON "WriteEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "WriteEvent_entityType_entityId_idx" ON "WriteEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "WriteEvent_source_createdAt_idx" ON "WriteEvent"("source", "createdAt");
