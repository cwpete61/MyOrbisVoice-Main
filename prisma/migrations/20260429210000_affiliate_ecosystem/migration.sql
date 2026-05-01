-- AffiliateSettings singleton
CREATE TABLE "AffiliateSettings" (
  "id"                   TEXT NOT NULL DEFAULT 'singleton',
  "cookieDurationDays"   INTEGER NOT NULL DEFAULT 30,
  "commissionRatePct"    DOUBLE PRECISION NOT NULL DEFAULT 20,
  "commissionType"       TEXT NOT NULL DEFAULT 'PERCENTAGE',
  "minPayoutCents"       INTEGER NOT NULL DEFAULT 5000,
  "autoApproveAfterDays" INTEGER NOT NULL DEFAULT 30,
  "programName"          TEXT NOT NULL DEFAULT 'Affiliate Program',
  "programDescription"   TEXT NOT NULL DEFAULT 'Earn commission by referring new customers.',
  "termsUrl"             TEXT,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "AffiliateSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AffiliateSettings" ("id", "updatedAt") VALUES ('singleton', NOW()) ON CONFLICT DO NOTHING;

-- Payout request tracking on AffiliateAccount
ALTER TABLE "AffiliateAccount"
  ADD COLUMN IF NOT EXISTS "payoutRequestedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "totalEarnedCents"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalPaidCents"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "approvedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes"              TEXT;

-- AffiliatePayoutRequest
CREATE TABLE "AffiliatePayoutRequest" (
  "id"                  TEXT NOT NULL,
  "affiliateAccountId"  TEXT NOT NULL,
  "amountCents"         INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'usd',
  "status"              TEXT NOT NULL DEFAULT 'PENDING',
  "requestedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "processedAt"         TIMESTAMP(3),
  "payoutRef"           TEXT,
  "notes"               TEXT,
  CONSTRAINT "AffiliatePayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AffiliatePayoutRequest_affiliateAccountId_status_idx" ON "AffiliatePayoutRequest"("affiliateAccountId", "status");

ALTER TABLE "AffiliatePayoutRequest"
  ADD CONSTRAINT "AffiliatePayoutRequest_affiliateAccountId_fkey"
  FOREIGN KEY ("affiliateAccountId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Referral attribution on Tenant
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "referredByCode" TEXT,
  ADD COLUMN IF NOT EXISTS "attributedAt"   TIMESTAMP(3);
