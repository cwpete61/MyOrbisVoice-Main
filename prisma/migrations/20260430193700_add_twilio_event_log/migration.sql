CREATE TABLE "TwilioEventLog" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "callSid"      TEXT,
    "direction"    TEXT NOT NULL,
    "eventType"    TEXT NOT NULL,
    "callStatus"   TEXT,
    "answeredBy"   TEXT,
    "fromNumber"   TEXT,
    "toNumber"     TEXT,
    "durationSecs" INTEGER,
    "outcomeCode"  TEXT,
    "errorMessage" TEXT,
    "metaJson"     JSONB,
    "occurredAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwilioEventLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TwilioEventLog" ADD CONSTRAINT "TwilioEventLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TwilioEventLog_tenantId_occurredAt_idx" ON "TwilioEventLog"("tenantId", "occurredAt" DESC);
CREATE INDEX "TwilioEventLog_tenantId_callSid_idx" ON "TwilioEventLog"("tenantId", "callSid");
