-- CreateEnum
CREATE TYPE "WidgetSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "WidgetSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "token" TEXT NOT NULL,
    "status" "WidgetSessionStatus" NOT NULL DEFAULT 'PENDING',
    "channelConfigId" TEXT,
    "promptSnapshotJson" JSONB,
    "businessDNASnapshotJson" JSONB,
    "conversationId" TEXT,
    "remoteIp" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WidgetSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WidgetSession_token_key" ON "WidgetSession"("token");

-- CreateIndex
CREATE INDEX "WidgetSession_tenantId_status_idx" ON "WidgetSession"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WidgetSession_token_idx" ON "WidgetSession"("token");

-- AddForeignKey
ALTER TABLE "WidgetSession" ADD CONSTRAINT "WidgetSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
