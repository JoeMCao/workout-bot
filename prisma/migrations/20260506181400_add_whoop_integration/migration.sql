CREATE TABLE "WhoopConnection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'whoop',
    "whoopUserId" INTEGER,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "tokenType" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhoopWorkoutMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "whoopWorkoutId" TEXT NOT NULL,
    "whoopUpdatedAt" TIMESTAMP(3),
    "activitySessionId" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopWorkoutMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhoopConnection_provider_key" ON "WhoopConnection"("provider");
CREATE INDEX "WhoopConnection_expiresAt_idx" ON "WhoopConnection"("expiresAt");
CREATE UNIQUE INDEX "WhoopWorkoutMapping_whoopWorkoutId_key" ON "WhoopWorkoutMapping"("whoopWorkoutId");
CREATE INDEX "WhoopWorkoutMapping_connectionId_idx" ON "WhoopWorkoutMapping"("connectionId");
CREATE INDEX "WhoopWorkoutMapping_activitySessionId_idx" ON "WhoopWorkoutMapping"("activitySessionId");

ALTER TABLE "WhoopWorkoutMapping" ADD CONSTRAINT "WhoopWorkoutMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WhoopConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhoopWorkoutMapping" ADD CONSTRAINT "WhoopWorkoutMapping_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
