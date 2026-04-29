CREATE TABLE "SystemConfig" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "isSecret"  BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);
