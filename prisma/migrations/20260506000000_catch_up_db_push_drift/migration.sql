-- CreateEnum
CREATE TYPE "IndustryVertical" AS ENUM ('GENERAL', 'LEGAL', 'DENTAL', 'MEDICAL', 'FINANCIAL', 'HOME_SERVICES', 'AUTO_REPAIR', 'REAL_ESTATE', 'FITNESS', 'BEAUTY', 'EDUCATION', 'HOSPITALITY', 'VETERINARY', 'CHILDCARE', 'ACCOUNTING', 'INSURANCE', 'PROPERTY_MANAGEMENT');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('FOLLOWUP_CUSTOMER_SERVICE', 'FOLLOWUP_QUALITY_CONTROL', 'FOLLOWUP_TESTIMONIAL', 'FOLLOWUP_POST_PURCHASE', 'FOLLOWUP_REENGAGEMENT', 'FOLLOWUP_QUOTE', 'FOLLOWUP_REFERRAL', 'FOLLOWUP_COMPLAINT', 'FOLLOWUP_POST_SURGERY', 'FOLLOWUP_WELLNESS', 'FOLLOWUP_COURSE_COMPLETION', 'FOLLOWUP_POST_STAY', 'FOLLOWUP_POST_OFFER', 'FOLLOWUP_FLEET', 'CONFIRM_APPOINTMENT', 'CONFIRM_REMINDER', 'CONFIRM_RESCHEDULE', 'CONFIRM_CANCELLATION', 'CONFIRM_PAYMENT', 'CONFIRM_BOOKING', 'CONFIRM_PRE_ARRIVAL', 'RECALL_PATIENT', 'RECALL_SERVICE_DUE', 'RECALL_ANNUAL_REVIEW', 'RECALL_INACTIVE', 'RECALL_ALUMNI', 'RECALL_LAPSED_SUBSCRIPTION', 'LEAD_WARMUP', 'ONBOARDING_WELCOME', 'ABANDONED_INQUIRY', 'NEW_LISTING_ALERT', 'OPEN_HOUSE_INVITE', 'WAITLIST_UPDATE', 'DOCUMENT_REQUEST', 'PRESCRIPTION_REMINDER', 'LAB_RESULTS_READY', 'POLICY_RENEWAL', 'PAYMENT_REMINDER', 'CONTRACT_RENEWAL', 'LEASE_RENEWAL', 'INSPECTION_REMINDER', 'ARREARS_REMINDER', 'CLAIM_FOLLOWUP', 'VACCINATION_REMINDER', 'CHRONIC_CHECKIN', 'WIN_BACK', 'NPS_SURVEY', 'UPSELL_CROSSSELL', 'VIP_CHECKIN', 'EVENT_INVITATION', 'REFERRAL_THANKYOU', 'BIRTHDAY_ANNIVERSARY', 'LOYALTY_REWARD', 'SEASONAL_PROMOTION', 'PACKAGE_EXPIRY', 'STORM_OUTREACH', 'MARKET_UPDATE', 'VEHICLE_BIRTHDAY', 'ATTENDANCE_CHECKIN', 'NO_SHOW_WINBACK');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OPTED_OUT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TwilioSubaccountStatus" AS ENUM ('ACTIVE', 'PENDING_CLOSURE', 'CLOSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "A2PApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "A2POperatorNoteCategory" AS ENUM ('CLARIFICATION_NEEDED', 'DATA_GAP', 'FORMAT_ERROR', 'USE_CASE_MISMATCH', 'COMPLIANCE_CONCERN', 'OTHER');

-- CreateEnum
CREATE TYPE "EnrollmentChannel" AS ENUM ('VOICE', 'SMS', 'EMAIL', 'WHATSAPP');

-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'GEMINI';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageChannel" ADD VALUE 'MMS';
ALTER TYPE "MessageChannel" ADD VALUE 'WHATSAPP';

-- AlterEnum
ALTER TYPE "PlanInterval" ADD VALUE 'ONE_TIME';

-- AlterTable
ALTER TABLE "AffiliateAccount" ADD COLUMN     "stripeConnectAccountId" TEXT;

-- AlterTable
ALTER TABLE "AffiliateClick" ADD COLUMN     "customLinkId" TEXT;

-- AlterTable
ALTER TABLE "AffiliateCommission" ADD COLUMN     "eligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scheduledPayoutDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AffiliateSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "staffMemberId" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "agentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "emailStatus" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "optedOutEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optedOutEmailAt" TIMESTAMP(3),
ADD COLUMN     "optedOutSms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optedOutSmsAt" TIMESTAMP(3),
ADD COLUMN     "optedOutVoice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optedOutVoiceAt" TIMESTAMP(3),
ADD COLUMN     "optedOutWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "optedOutWhatsappAt" TIMESTAMP(3),
ADD COLUMN     "phoneStatus" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "recordingBunnyPath" TEXT,
ADD COLUMN     "recordingDurationSecs" INTEGER,
ADD COLUMN     "recordingRef" TEXT,
ADD COLUMN     "recordingSizeBytes" BIGINT,
ADD COLUMN     "recordingStatus" TEXT,
ADD COLUMN     "transcriptJson" JSONB;

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "billedCents" INTEGER,
ADD COLUMN     "bodyText" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "enrollmentId" TEXT,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "mediaCount" INTEGER,
ADD COLUMN     "optOutDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "segmentCount" INTEGER,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "twilioCostCents" INTEGER;

-- AlterTable
ALTER TABLE "OutboundCallAttempt" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "enrollmentId" TEXT;

-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "monthlyPriceCents" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "releaseScheduledAt" TIMESTAMP(3),
ADD COLUMN     "twilioSubaccountSid" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "priceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeRecurringPriceId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "industryVertical" "IndustryVertical" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "recordingBehavior" TEXT NOT NULL DEFAULT 'stop',
ADD COLUMN     "recordingRetentionDays" INTEGER,
ADD COLUMN     "storageGracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "storagePreviousQuotaBytes" BIGINT,
ADD COLUMN     "storageQuotaBytes" BIGINT,
ADD COLUMN     "storageTier" TEXT,
ADD COLUMN     "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "storageWarningAckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TwilioConnectionDetail" ADD COLUMN     "encryptedAuthToken" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredLocale" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "WidgetSession" ADD COLUMN     "metadataJson" JSONB;

-- CreateTable
CREATE TABLE "TenantTwilioSubaccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "twilioSubaccountSid" TEXT NOT NULL,
    "encryptedSubaccountAuthToken" TEXT NOT NULL,
    "status" "TwilioSubaccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancellationGraceUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantTwilioSubaccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantA2PApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "legalName" TEXT NOT NULL,
    "ein" TEXT,
    "businessType" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "sampleMessagesJson" JSONB NOT NULL,
    "twilioCustomerProfileSid" TEXT,
    "twilioBrandSid" TEXT,
    "twilioCampaignSid" TEXT,
    "status" "A2PApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantA2PApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "A2POperatorNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "category" "A2POperatorNoteCategory" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "A2POperatorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "timezone" TEXT,
    "phoneExtension" TEXT,
    "availabilityJson" JSONB,
    "integrationConnectionId" TEXT,
    "calendarId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCustomLink" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCustomLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageTierConfig" (
    "tier" TEXT NOT NULL,
    "quotaBytes" BIGINT NOT NULL,
    "retentionDays" INTEGER,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "StorageTierConfig_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "CampaignTemplate" (
    "id" TEXT NOT NULL,
    "vertical" "IndustryVertical" NOT NULL,
    "campaignType" "CampaignType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultPrompt" TEXT NOT NULL,
    "defaultTriggerTag" TEXT NOT NULL,
    "defaultDelayHours" INTEGER NOT NULL DEFAULT 1,
    "defaultMaxRetries" INTEGER NOT NULL DEFAULT 2,
    "defaultRetryIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "suggestedTagsJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT,
    "campaignType" "CampaignType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "triggerTag" TEXT NOT NULL,
    "delayHours" INTEGER NOT NULL DEFAULT 1,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "retryIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "exitOnReply" BOOLEAN NOT NULL DEFAULT true,
    "exitOnOptOut" BOOLEAN NOT NULL DEFAULT true,
    "enableVoice" BOOLEAN NOT NULL DEFAULT true,
    "enableSms" BOOLEAN NOT NULL DEFAULT false,
    "enableEmail" BOOLEAN NOT NULL DEFAULT false,
    "enableWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "smsBody" TEXT,
    "whatsappBody" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEnrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "EnrollmentChannel" NOT NULL DEFAULT 'VOICE',
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "triggerTag" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledCallAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "exitReason" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptOutLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "optedOut" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptOutLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkPath" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantTwilioSubaccount_tenantId_key" ON "TenantTwilioSubaccount"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantTwilioSubaccount_twilioSubaccountSid_key" ON "TenantTwilioSubaccount"("twilioSubaccountSid");

-- CreateIndex
CREATE UNIQUE INDEX "TenantA2PApplication_tenantId_key" ON "TenantA2PApplication"("tenantId");

-- CreateIndex
CREATE INDEX "A2POperatorNote_applicationId_createdAt_idx" ON "A2POperatorNote"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "A2POperatorNote_category_idx" ON "A2POperatorNote"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_userId_idx" ON "PushSubscription"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_integrationConnectionId_key" ON "StaffMember"("integrationConnectionId");

-- CreateIndex
CREATE INDEX "StaffMember_tenantId_idx" ON "StaffMember"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCustomLink_slug_key" ON "AffiliateCustomLink"("slug");

-- CreateIndex
CREATE INDEX "AffiliateCustomLink_affiliateAccountId_archivedAt_idx" ON "AffiliateCustomLink"("affiliateAccountId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "CampaignTemplate_vertical_idx" ON "CampaignTemplate"("vertical");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTemplate_vertical_campaignType_key" ON "CampaignTemplate"("vertical", "campaignType");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_isActive_idx" ON "Campaign"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Campaign_tenantId_triggerTag_idx" ON "Campaign"("tenantId", "triggerTag");

-- CreateIndex
CREATE INDEX "CampaignEnrollment_tenantId_status_idx" ON "CampaignEnrollment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CampaignEnrollment_tenantId_scheduledCallAt_idx" ON "CampaignEnrollment"("tenantId", "scheduledCallAt");

-- CreateIndex
CREATE INDEX "CampaignEnrollment_status_scheduledCallAt_idx" ON "CampaignEnrollment"("status", "scheduledCallAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEnrollment_campaignId_contactId_channel_key" ON "CampaignEnrollment"("campaignId", "contactId", "channel");

-- CreateIndex
CREATE INDEX "OptOutLog_tenantId_contactId_idx" ON "OptOutLog"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "OptOutLog_tenantId_channel_createdAt_idx" ON "OptOutLog"("tenantId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_readAt_createdAt_idx" ON "Notification"("tenantId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_type_idx" ON "Notification"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_stripeConnectAccountId_key" ON "AffiliateAccount"("stripeConnectAccountId");

-- CreateIndex
CREATE INDEX "AffiliateClick_customLinkId_createdAt_idx" ON "AffiliateClick"("customLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateCommission_scheduledPayoutDate_status_idx" ON "AffiliateCommission"("scheduledPayoutDate", "status");

-- CreateIndex
CREATE INDEX "MessageLog_tenantId_channel_direction_createdAt_idx" ON "MessageLog"("tenantId", "channel", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_tenantId_contactId_idx" ON "MessageLog"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "MessageLog_providerMessageId_idx" ON "MessageLog"("providerMessageId");

-- CreateIndex
CREATE INDEX "OutboundCallAttempt_enrollmentId_idx" ON "OutboundCallAttempt"("enrollmentId");

-- AddForeignKey
ALTER TABLE "TenantTwilioSubaccount" ADD CONSTRAINT "TenantTwilioSubaccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantA2PApplication" ADD CONSTRAINT "TenantA2PApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2POperatorNote" ADD CONSTRAINT "A2POperatorNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TenantA2PApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "A2POperatorNote" ADD CONSTRAINT "A2POperatorNote_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCustomLink" ADD CONSTRAINT "AffiliateCustomLink_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_customLinkId_fkey" FOREIGN KEY ("customLinkId") REFERENCES "AffiliateCustomLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundCallAttempt" ADD CONSTRAINT "OutboundCallAttempt_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundCallAttempt" ADD CONSTRAINT "OutboundCallAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CampaignEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CampaignTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptOutLog" ADD CONSTRAINT "OptOutLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptOutLog" ADD CONSTRAINT "OptOutLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

