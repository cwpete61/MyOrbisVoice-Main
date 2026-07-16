-- CreateEnum
CREATE TYPE "ConversationAttentionLevel" AS ENUM ('NONE', 'WATCH', 'ALERT');

-- CreateEnum
CREATE TYPE "KbFileStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PartnerSmsCreditEvent" AS ENUM ('PURCHASE', 'CONSUME', 'REFUND', 'ADJUST');

-- CreateEnum
CREATE TYPE "PartnerSmsCreditChannel" AS ENUM ('SMS', 'SMS_LONG', 'MMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "PartnerVoiceDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "PartnerVoiceNumberType" AS ENUM ('LOCAL', 'TOLLFREE');

-- CreateEnum
CREATE TYPE "PhoneNumberPurchaseStatus" AS ENUM ('PENDING', 'APPROVED', 'PURCHASED', 'REJECTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PartnerNumberTier" AS ENUM ('VOICE', 'VOICE_SMS', 'TOLLFREE');

-- CreateEnum
CREATE TYPE "A2pStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_QUEUE', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadSearchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadReviewStatus" AS ENUM ('NEW', 'SAVED', 'REJECTED', 'PROMOTED');

-- CreateEnum
CREATE TYPE "SendingDomainStatus" AS ENUM ('PENDING_PAYMENT', 'REGISTERING', 'DNS_PENDING', 'VERIFYING', 'WARMING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "ColdEmailSendStatus" AS ENUM ('QUEUED', 'SENT', 'SUPPRESSED', 'INVALID', 'BLOCKED', 'FAILED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "ColdEmailCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ColdEmailCampaignLeadStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'REPLIED', 'BOOKED', 'COMPLETED', 'STOPPED');

-- CreateEnum
CREATE TYPE "EventSubcategory" AS ENUM ('HOLIDAY', 'SALES_EVENT', 'SPECIAL_EVENT');

-- CreateEnum
CREATE TYPE "EmailSuppressionReason" AS ENUM ('HARD_BOUNCE', 'COMPLAINT', 'UNSUBSCRIBE', 'MANUAL', 'SOFT_BOUNCE_REPEATED');

-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EmailCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebinarListStatus" AS ENUM ('DRAFT', 'DISCOVERING', 'EXTRACTING', 'VERIFYING', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WebinarSearchStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "WebinarUrlStatus" AS ENUM ('PENDING', 'CRAWLED', 'SKIPPED_ROBOTS', 'SKIPPED_RATE_LIMIT', 'FAILED');

-- CreateEnum
CREATE TYPE "WebinarEmailType" AS ENUM ('BUSINESS_DOMAIN', 'ROLE_BASED_BUSINESS', 'PERSONAL_FREE_MAIL', 'NO_REPLY_OR_SUPPRESSED', 'INVALID_FORMAT', 'DISPOSABLE_DOMAIN', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "WebinarClassificationStatus" AS ENUM ('PENDING', 'CLASSIFIED', 'QUARANTINED', 'REJECTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "WebinarVerificationStatus" AS ENUM ('DELIVERABLE', 'UNDELIVERABLE', 'RISKY', 'UNKNOWN', 'PENDING');

-- CreateEnum
CREATE TYPE "WebinarConsentStatus" AS ENUM ('OPTED_IN', 'EXISTING_CUSTOMER', 'MANUAL_LAWFUL_BASIS_REVIEWED', 'NOT_APPROVED');

-- CreateEnum
CREATE TYPE "WebinarVerificationMode" AS ENUM ('SYNTAX_DNS_ONLY', 'EXTERNAL_PROVIDER');

-- CreateEnum
CREATE TYPE "CallReviewStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('ACCURACY', 'COMPLIANCE', 'COMPLETENESS', 'UX', 'BOOKING', 'BILINGUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FindingDisposition" AS ENUM ('CONFIRMED', 'REFUTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "FindingReviewStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "PromptRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "WebinarStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WebinarSessionKind" AS ENUM ('EVERGREEN', 'JUST_IN_TIME', 'SCHEDULED', 'LIVE');

-- CreateEnum
CREATE TYPE "WebinarSessionStatus" AS ENUM ('DRAFT', 'OPEN', 'ENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InteractionEventType" AS ENUM ('REGISTERED', 'JOINED', 'WATCHED', 'POLL_ANSWERED', 'QUESTION_ASKED', 'CTA_CLICKED', 'DOWNLOADED', 'BOOKED', 'CALLED', 'PURCHASED', 'REVIEWED', 'REPLAY_WATCHED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "InteractionEventSource" AS ENUM ('WEBINAR', 'VOICE', 'BIZ', 'REVIEWS');

-- CreateEnum
CREATE TYPE "EngagementTemp" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "DemoKind" AS ENUM ('SANDBOX', 'AGENT');

-- CreateEnum
CREATE TYPE "AgentDemoStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'SENT', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'COMING_SOON', 'PENDING', 'SOLD', 'RENTED', 'POCKET', 'OFF_MARKET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "A2PApplicationStatus" ADD VALUE 'VALIDATING';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'VALIDATION_FAILED';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'READY_TO_SUBMIT';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'PROFILE_PENDING';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'BRAND_PENDING';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'BRAND_FAILED';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'BRAND_APPROVED';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'CAMPAIGN_PENDING';
ALTER TYPE "A2PApplicationStatus" ADD VALUE 'SUSPENDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IndustryVertical" ADD VALUE 'TRAVEL';
ALTER TYPE "IndustryVertical" ADD VALUE 'EVENTS';
ALTER TYPE "IndustryVertical" ADD VALUE 'APPLIANCE_REPAIR';
ALTER TYPE "IndustryVertical" ADD VALUE 'ARCHITECTURE';
ALTER TYPE "IndustryVertical" ADD VALUE 'ASSISTED_LIVING';
ALTER TYPE "IndustryVertical" ADD VALUE 'AUTO_DEALERSHIP';
ALTER TYPE "IndustryVertical" ADD VALUE 'BOOKKEEPING';
ALTER TYPE "IndustryVertical" ADD VALUE 'CAFE';
ALTER TYPE "IndustryVertical" ADD VALUE 'CHIROPRACTIC';
ALTER TYPE "IndustryVertical" ADD VALUE 'CLEANING_SERVICE';
ALTER TYPE "IndustryVertical" ADD VALUE 'COACHING';
ALTER TYPE "IndustryVertical" ADD VALUE 'CONSTRUCTION';
ALTER TYPE "IndustryVertical" ADD VALUE 'CONSULTING';
ALTER TYPE "IndustryVertical" ADD VALUE 'COURIER';
ALTER TYPE "IndustryVertical" ADD VALUE 'CUSTOMER_SUPPORT_CENTER';
ALTER TYPE "IndustryVertical" ADD VALUE 'ECOMMERCE';
ALTER TYPE "IndustryVertical" ADD VALUE 'ELECTRICIAN';
ALTER TYPE "IndustryVertical" ADD VALUE 'EVENT_PLANNING';
ALTER TYPE "IndustryVertical" ADD VALUE 'FINANCIAL_ADVISORY';
ALTER TYPE "IndustryVertical" ADD VALUE 'FOOD_SERVICE_GROUP';
ALTER TYPE "IndustryVertical" ADD VALUE 'FUNERAL_HOME';
ALTER TYPE "IndustryVertical" ADD VALUE 'HEALTHCARE_CLINICS';
ALTER TYPE "IndustryVertical" ADD VALUE 'HOTEL';
ALTER TYPE "IndustryVertical" ADD VALUE 'HVAC';
ALTER TYPE "IndustryVertical" ADD VALUE 'IT_SERVICES';
ALTER TYPE "IndustryVertical" ADD VALUE 'LANDSCAPING';
ALTER TYPE "IndustryVertical" ADD VALUE 'LEASING_OFFICE';
ALTER TYPE "IndustryVertical" ADD VALUE 'LOGISTICS';
ALTER TYPE "IndustryVertical" ADD VALUE 'MANUFACTURING';
ALTER TYPE "IndustryVertical" ADD VALUE 'MARKETING_AGENCY';
ALTER TYPE "IndustryVertical" ADD VALUE 'MENTAL_HEALTH';
ALTER TYPE "IndustryVertical" ADD VALUE 'MORTGAGE_LENDING';
ALTER TYPE "IndustryVertical" ADD VALUE 'MOTEL';
ALTER TYPE "IndustryVertical" ADD VALUE 'NONPROFIT';
ALTER TYPE "IndustryVertical" ADD VALUE 'NURSING_HOME';
ALTER TYPE "IndustryVertical" ADD VALUE 'OPTOMETRY';
ALTER TYPE "IndustryVertical" ADD VALUE 'ORAL_SURGERY';
ALTER TYPE "IndustryVertical" ADD VALUE 'ORTHODONTICS';
ALTER TYPE "IndustryVertical" ADD VALUE 'PERSONAL_TRAINER';
ALTER TYPE "IndustryVertical" ADD VALUE 'PEST_CONTROL';
ALTER TYPE "IndustryVertical" ADD VALUE 'PET_GROOMING';
ALTER TYPE "IndustryVertical" ADD VALUE 'PHARMACY';
ALTER TYPE "IndustryVertical" ADD VALUE 'PHOTOGRAPHY';
ALTER TYPE "IndustryVertical" ADD VALUE 'PHYSICAL_THERAPY';
ALTER TYPE "IndustryVertical" ADD VALUE 'PLUMBING';
ALTER TYPE "IndustryVertical" ADD VALUE 'REALTOR';
ALTER TYPE "IndustryVertical" ADD VALUE 'RESORT';
ALTER TYPE "IndustryVertical" ADD VALUE 'RESTAURANT';
ALTER TYPE "IndustryVertical" ADD VALUE 'RESTORATION';
ALTER TYPE "IndustryVertical" ADD VALUE 'RETAIL';
ALTER TYPE "IndustryVertical" ADD VALUE 'ROOFING';
ALTER TYPE "IndustryVertical" ADD VALUE 'SALON';
ALTER TYPE "IndustryVertical" ADD VALUE 'SCHOOL';
ALTER TYPE "IndustryVertical" ADD VALUE 'SENIOR_LIVING';
ALTER TYPE "IndustryVertical" ADD VALUE 'SOFTWARE_TECH';
ALTER TYPE "IndustryVertical" ADD VALUE 'SPA';
ALTER TYPE "IndustryVertical" ADD VALUE 'TAX_PREPARATION';
ALTER TYPE "IndustryVertical" ADD VALUE 'TIRE_SHOP';
ALTER TYPE "IndustryVertical" ADD VALUE 'TOWING';
ALTER TYPE "IndustryVertical" ADD VALUE 'TRADES_OTHER';
ALTER TYPE "IndustryVertical" ADD VALUE 'TRAINING_CENTER';
ALTER TYPE "IndustryVertical" ADD VALUE 'TRAVEL_AGENCY';
ALTER TYPE "IndustryVertical" ADD VALUE 'TRUCKING';
ALTER TYPE "IndustryVertical" ADD VALUE 'TUTORING';
ALTER TYPE "IndustryVertical" ADD VALUE 'WAREHOUSING';
ALTER TYPE "IndustryVertical" ADD VALUE 'WELLNESS_CLINIC';

-- DropIndex
DROP INDEX "CampaignTemplate_vertical_campaignType_key";

-- DropIndex
DROP INDEX "PhoneNumber_e164Number_key";

-- AlterTable
ALTER TABLE "AffiliateAccount" ADD COLUMN     "aggressionTier" TEXT NOT NULL DEFAULT 'balanced',
ADD COLUMN     "agreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "agreementIpHash" TEXT,
ADD COLUMN     "agreementSignerName" TEXT,
ADD COLUMN     "agreementVersion" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "bookingBufferAfterMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bookingBufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bookingHoursJson" JSONB,
ADD COLUMN     "bookingMaxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "bookingMinNoticeMin" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "bookingSlotDurationMin" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "bookingTimezone" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "calendarId" TEXT,
ADD COLUMN     "commissionLockedAt" TIMESTAMP(3),
ADD COLUMN     "commissionRatePct" DOUBLE PRECISION,
ADD COLUMN     "commissionTierId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "emailBulkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailBulkSuspendedAt" TIMESTAMP(3),
ADD COLUMN     "emailBulkSuspendedReason" TEXT,
ADD COLUMN     "emailDailyCap" INTEGER,
ADD COLUMN     "emailDripIntervalSecs" INTEGER,
ADD COLUMN     "emailLastBulkWarningAt" TIMESTAMP(3),
ADD COLUMN     "emailSendWindowEndHour" INTEGER,
ADD COLUMN     "emailSendWindowStartHour" INTEGER,
ADD COLUMN     "emailSignature" TEXT,
ADD COLUMN     "forwardPlatformEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "integrationConnectionId" TEXT,
ADD COLUMN     "leadSearchCredits" INTEGER NOT NULL DEFAULT 250,
ADD COLUMN     "notifyAppointmentsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboardingMarkedDone" JSONB,
ADD COLUMN     "partnerCity" TEXT,
ADD COLUMN     "partnerPageActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partnerPhone" TEXT,
ADD COLUMN     "partnerPostalCode" TEXT,
ADD COLUMN     "partnerReminderEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "partnerReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "partnerReminderOffsetsMin" INTEGER[] DEFAULT ARRAY[1440, 60]::INTEGER[],
ADD COLUMN     "partnerReminderSmsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "partnerState" TEXT,
ADD COLUMN     "partnerStreet" TEXT,
ADD COLUMN     "partnerUnit" TEXT,
ADD COLUMN     "showOnboardingWizard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "smsCreditBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "smsCreditLowNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AgentProfile" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "partnerId" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "smsConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "aggressionTier" TEXT NOT NULL DEFAULT 'balanced',
ADD COLUMN     "bookingBufferAfterMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bookingBufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bookingMaxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "bookingMinNoticeMin" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "bookingSlotDurationMin" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "reminderEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderEmailIntro" VARCHAR(1000),
ADD COLUMN     "reminderEmailSubject" VARCHAR(200),
ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderOffsetsMin" INTEGER[] DEFAULT ARRAY[1440, 60]::INTEGER[],
ADD COLUMN     "reminderSmsBody" VARCHAR(320),
ADD COLUMN     "reminderSmsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "aggressionTier" TEXT;

-- AlterTable
ALTER TABLE "CampaignTemplate" ADD COLUMN     "subcategory" "EventSubcategory";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "anniversary" TIMESTAMP(3),
ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "customerSince" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "hobbies" TEXT,
ADD COLUMN     "importantDatesJson" JSONB,
ADD COLUMN     "kidsInfoJson" JSONB,
ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "personalNotes" TEXT,
ADD COLUMN     "petsInfoJson" JSONB,
ADD COLUMN     "pipelineStageId" TEXT,
ADD COLUMN     "preferredContactTime" TEXT,
ADD COLUMN     "spouseName" TEXT,
ADD COLUMN     "stageUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "attentionLevel" "ConversationAttentionLevel" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "attentionReason" TEXT,
ADD COLUMN     "demoSessionId" TEXT,
ADD COLUMN     "featuredAt" TIMESTAMP(3),
ADD COLUMN     "featuredById" TEXT,
ADD COLUMN     "featuredCategory" TEXT,
ADD COLUMN     "featuredSortOrder" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "featuredSummary" TEXT,
ADD COLUMN     "featuredTitle" TEXT,
ADD COLUMN     "featuredTranscript" JSONB,
ADD COLUMN     "featuredViewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isFeaturedDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listingId" TEXT,
ADD COLUMN     "partnerId" TEXT;

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "bounceReason" TEXT,
ADD COLUMN     "bounceType" TEXT,
ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "complainedAt" TIMESTAMP(3),
ADD COLUMN     "partnerId" TEXT;

-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "a2pStatus" "A2pStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "agentProfileId" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "listingId" TEXT,
ADD COLUMN     "partnerCapabilityTier" "PartnerNumberTier",
ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "purchaseStatus" "PhoneNumberPurchaseStatus" NOT NULL DEFAULT 'PURCHASED',
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedByUserId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "stripeBuyLinkUrl" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "demoKind" "DemoKind",
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kbStorageUsedBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "onboardingEmailsSent" JSONB,
ADD COLUMN     "onboardingMarkedDone" JSONB,
ADD COLUMN     "orbyDepositCents" INTEGER,
ADD COLUMN     "orbyPaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showOnboardingWizard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeConnectAccountId" TEXT,
ADD COLUMN     "stripeConnectOnboardedAt" TIMESTAMP(3),
ADD COLUMN     "stripeConnectStatusJson" JSONB;

-- AlterTable
ALTER TABLE "TenantA2PApplication" ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "authorizedByUserId" TEXT,
ADD COLUMN     "lastTwilioSyncAt" TIMESTAMP(3),
ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "submissionMode" TEXT NOT NULL DEFAULT 'mock',
ADD COLUMN     "twilioMessagingServiceSid" TEXT,
ADD COLUMN     "twilioTrustProductSid" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validationReportJson" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferredTimezone" TEXT,
ADD COLUMN     "smsConsentAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "KnowledgeBaseFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bunnyStorageKey" TEXT NOT NULL,
    "extractedText" TEXT,
    "extractionStatus" "KbFileStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "appointmentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "stripeCheckoutId" TEXT,
    "stripePaymentIntentId" TEXT,
    "checkoutUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerStripeCustomerRef" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerStripeCustomerRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSmsCreditLedger" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "eventType" "PartnerSmsCreditEvent" NOT NULL,
    "creditsDelta" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "channel" "PartnerSmsCreditChannel",
    "packId" TEXT,
    "usdAmountCents" INTEGER,
    "twilioCostCents" DECIMAL(10,4),
    "stripePaymentIntentId" TEXT,
    "stripeSessionId" TEXT,
    "messageLogId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSmsCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerVoiceUsageLedger" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "direction" "PartnerVoiceDirection" NOT NULL,
    "numberType" "PartnerVoiceNumberType" NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "billableMinutes" INTEGER NOT NULL,
    "ratePerMinuteCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "twilioCostCents" DECIMAL(10,4),
    "stripeInvoiceItemId" TEXT,
    "billedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerVoiceUsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "PartnerTwilioSubaccount" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "twilioSubaccountSid" TEXT NOT NULL,
    "encryptedSubaccountAuthToken" TEXT NOT NULL,
    "status" "TwilioSubaccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancellationGraceUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerTwilioSubaccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOptIn" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "consentText" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnerId" TEXT,
    "name" VARCHAR(80) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "color" VARCHAR(40),
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnerId" TEXT,
    "contactId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "offsetMin" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerScript" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'call',
    "bodyHtml" TEXT NOT NULL,
    "sourceDefaultId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionTier" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "recurringPct" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmbEvaluation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "website" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB NOT NULL,
    "rawPayload" JSONB,
    "deletedAt" TIMESTAMP(3),
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmbEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSearch" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "status" "LeadSearchStatus" NOT NULL DEFAULT 'PENDING',
    "externalJobId" TEXT,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "mapRank" INTEGER,
    "category" TEXT,
    "socialsJson" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reviewStatus" "LeadReviewStatus" NOT NULL DEFAULT 'NEW',
    "promotedContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSendingDomain" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "SendingDomainStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "priceCents" INTEGER,
    "cloudflareZoneId" TEXT,
    "registrarOrderRef" TEXT,
    "dnsConfiguredAt" TIMESTAMP(3),
    "sesDkimTokensJson" JSONB,
    "sesVerifiedAt" TIMESTAMP(3),
    "warmupStartedAt" TIMESTAMP(3),
    "warmupDayCap" INTEGER NOT NULL DEFAULT 5,
    "warmupCompletedAt" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSendingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdEmailSend" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "sendingDomainId" TEXT NOT NULL,
    "campaignLeadId" TEXT,
    "toEmail" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ColdEmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "unsubscribeToken" TEXT NOT NULL,
    "sesMessageId" TEXT,
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdEmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdEmailCampaign" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ColdEmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdEmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdEmailCampaignTouch" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "touchNumber" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdEmailCampaignTouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColdEmailCampaignLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "ColdEmailCampaignLeadStatus" NOT NULL DEFAULT 'ENROLLED',
    "currentTouch" INTEGER NOT NULL DEFAULT 0,
    "nextTouchAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColdEmailCampaignLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "threadId" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" JSONB NOT NULL,
    "ccAddresses" JSONB,
    "bccAddresses" JSONB,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT,
    "textBody" TEXT,
    "attachmentsJson" JSONB,
    "deliveryStatus" TEXT,
    "readAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "partnerId" TEXT,
    "email" VARCHAR(320) NOT NULL,
    "reason" "EmailSuppressionReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnerId" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "fromName" TEXT,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedReason" TEXT,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "bouncedCount" INTEGER NOT NULL DEFAULT 0,
    "complainedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(200),
    "status" "EmailCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "messageLogId" TEXT,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingKitVideo" (
    "id" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleEs" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionEs" TEXT NOT NULL,
    "filename" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "aspectRatio" TEXT NOT NULL DEFAULT 'horizontal',
    "comingSoon" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mediaType" TEXT NOT NULL DEFAULT 'video',
    "mimeType" TEXT,
    "secondaryFilenames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "captionsJson" JSONB,
    "track" TEXT,
    "brand" TEXT NOT NULL DEFAULT 'VOICE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MarketingKitVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingKitSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "columnsDesktop" INTEGER NOT NULL DEFAULT 3,
    "columnsTablet" INTEGER NOT NULL DEFAULT 2,
    "columnsMobile" INTEGER NOT NULL DEFAULT 1,
    "defaultSort" TEXT NOT NULL DEFAULT 'manual',
    "defaultTab" TEXT NOT NULL DEFAULT 'all',
    "hiddenTabs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingKitSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarLeadList" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "optionalEmailDomainFilter" TEXT,
    "searchEngines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxResultsPerQuery" INTEGER NOT NULL DEFAULT 100,
    "maxPagesPerDomain" INTEGER NOT NULL DEFAULT 5,
    "verificationMode" "WebinarVerificationMode" NOT NULL DEFAULT 'EXTERNAL_PROVIDER',
    "allowedEmailTypes" TEXT[] DEFAULT ARRAY['business_domain_only', 'role_based_business']::TEXT[],
    "status" "WebinarListStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WebinarLeadList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarSearchQuery" (
    "id" TEXT NOT NULL,
    "leadListId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "WebinarSearchStatus" NOT NULL DEFAULT 'PENDING',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WebinarSearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarDiscoveredUrl" (
    "id" TEXT NOT NULL,
    "leadListId" TEXT NOT NULL,
    "searchQueryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "provider" TEXT NOT NULL,
    "status" "WebinarUrlStatus" NOT NULL DEFAULT 'PENDING',
    "robotsCheck" TEXT,
    "errorMessage" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "crawledAt" TIMESTAMP(3),

    CONSTRAINT "WebinarDiscoveredUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarExtractedEmail" (
    "id" TEXT NOT NULL,
    "leadListId" TEXT NOT NULL,
    "discoveredUrlId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourcePageTitle" TEXT,
    "rawContextSnippet" TEXT,
    "emailType" "WebinarEmailType",
    "classificationStatus" "WebinarClassificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebinarExtractedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarEmailVerification" (
    "id" TEXT NOT NULL,
    "extractedEmailId" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "syntaxValid" BOOLEAN NOT NULL,
    "mxValid" BOOLEAN NOT NULL,
    "disposable" BOOLEAN NOT NULL DEFAULT false,
    "providerStatus" TEXT NOT NULL,
    "providerConfidence" DOUBLE PRECISION,
    "providerReason" TEXT,
    "provider" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebinarEmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarInviteContact" (
    "id" TEXT NOT NULL,
    "leadListId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "businessName" TEXT,
    "niche" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "consentStatus" "WebinarConsentStatus" NOT NULL,
    "lawfulBasisNotes" TEXT,
    "verificationStatus" "WebinarVerificationStatus" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInvitedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "WebinarInviteContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarSuppression" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebinarSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarAuditLog" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebinarAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallReview" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "CallReviewStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "confidence" INTEGER,
    "modelsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "panelJson" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CallReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallReviewFinding" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "quote" TEXT,
    "disposition" "FindingDisposition" NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "votesJson" JSONB,
    "proposedFix" TEXT,
    "reviewStatus" "FindingReviewStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,

    CONSTRAINT "CallReviewFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPromptRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "category" "FindingCategory" NOT NULL,
    "text" TEXT NOT NULL,
    "status" "PromptRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceFindingId" TEXT,
    "sourceConversationId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "retiredAt" TIMESTAMP(3),
    "retiredBy" TEXT,
    "supersedesId" TEXT,

    CONSTRAINT "AgentPromptRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarPerson" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "fullName" TEXT,
    "contactId" TEXT,
    "ambiguousFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebinarPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webinar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEs" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "vertical" TEXT,
    "status" "WebinarStatus" NOT NULL DEFAULT 'DRAFT',
    "coverImageUrl" TEXT,
    "videoAssetRef" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webinar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebinarSession" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "WebinarSessionKind" NOT NULL DEFAULT 'EVERGREEN',
    "status" "WebinarSessionStatus" NOT NULL DEFAULT 'OPEN',
    "startsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebinarSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registrant" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tenantId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "joinToken" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendedAt" TIMESTAMP(3),
    "watchSeconds" INTEGER NOT NULL DEFAULT 0,
    "remindersSent" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Registrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionEvent" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "webinarId" TEXT,
    "sessionId" TEXT,
    "type" "InteractionEventType" NOT NULL,
    "source" "InteractionEventSource" NOT NULL DEFAULT 'WEBINAR',
    "traceId" TEXT,
    "metaJson" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementScore" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "intent" INTEGER NOT NULL DEFAULT 0,
    "attention" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "temp" "EngagementTemp" NOT NULL DEFAULT 'COLD',
    "stage" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDailyActivityProgress" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "PartnerDailyActivityProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerGroup" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "niche" TEXT,
    "memberCount" INTEGER,
    "promoRule" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerGroupPost" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "keyword" TEXT,
    "optinCount" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerGroupPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProspect" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "brokerage" TEXT,
    "market" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "salesLast12" INTEGER,
    "totalSales" INTEGER,
    "isTeam" BOOLEAN NOT NULL DEFAULT false,
    "teamSize" TEXT,
    "avgPriceUsd" INTEGER,
    "priceRange" TEXT,
    "yearsExp" INTEGER,
    "reviews" INTEGER,
    "premierAgent" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'C',
    "recommendedTier" TEXT,
    "pitchAngle" TEXT,
    "redFlags" TEXT,
    "rawText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TARGET',
    "demoSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoLead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phoneE164" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'demo_widget',
    "capturedTenantId" TEXT,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "browserRef" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "label" TEXT,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastCallAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDemo" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "brokerage" TEXT,
    "market" TEXT NOT NULL,
    "agentEmail" TEXT NOT NULL,
    "agentPhone" TEXT,
    "tenantId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "micrositeSlug" TEXT NOT NULL,
    "recommendedTier" TEXT NOT NULL,
    "status" "AgentDemoStatus" NOT NULL DEFAULT 'DRAFT',
    "videoUrl" TEXT,
    "videoStatus" TEXT DEFAULT 'NONE',
    "videoJoggId" TEXT,
    "enrichedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT NOT NULL,
    "headline" TEXT,
    "priceUsd" INTEGER,
    "beds" DOUBLE PRECISION,
    "baths" DOUBLE PRECISION,
    "sqft" INTEGER,
    "propertyType" TEXT,
    "description" TEXT,
    "highlights" TEXT[],
    "rawText" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "enrichmentJson" JSONB,
    "enrichedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseFile_bunnyStorageKey_key" ON "KnowledgeBaseFile"("bunnyStorageKey");

-- CreateIndex
CREATE INDEX "KnowledgeBaseFile_tenantId_extractionStatus_idx" ON "KnowledgeBaseFile"("tenantId", "extractionStatus");

-- CreateIndex
CREATE INDEX "KnowledgeBaseFile_tenantId_uploadedAt_idx" ON "KnowledgeBaseFile"("tenantId", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPayment_stripeCheckoutId_key" ON "TenantPayment"("stripeCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPayment_stripePaymentIntentId_key" ON "TenantPayment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "TenantPayment_tenantId_status_idx" ON "TenantPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantPayment_tenantId_createdAt_idx" ON "TenantPayment"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStripeCustomerRef_partnerId_key" ON "PartnerStripeCustomerRef"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStripeCustomerRef_stripeCustomerId_key" ON "PartnerStripeCustomerRef"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSmsCreditLedger_stripePaymentIntentId_key" ON "PartnerSmsCreditLedger"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSmsCreditLedger_stripeSessionId_key" ON "PartnerSmsCreditLedger"("stripeSessionId");

-- CreateIndex
CREATE INDEX "PartnerSmsCreditLedger_partnerId_createdAt_idx" ON "PartnerSmsCreditLedger"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerSmsCreditLedger_eventType_idx" ON "PartnerSmsCreditLedger"("eventType");

-- CreateIndex
CREATE INDEX "PartnerSmsCreditLedger_messageLogId_idx" ON "PartnerSmsCreditLedger"("messageLogId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerVoiceUsageLedger_callSid_key" ON "PartnerVoiceUsageLedger"("callSid");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerVoiceUsageLedger_stripeInvoiceItemId_key" ON "PartnerVoiceUsageLedger"("stripeInvoiceItemId");

-- CreateIndex
CREATE INDEX "PartnerVoiceUsageLedger_partnerId_createdAt_idx" ON "PartnerVoiceUsageLedger"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerVoiceUsageLedger_phoneNumberId_idx" ON "PartnerVoiceUsageLedger"("phoneNumberId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_receivedAt_idx" ON "StripeWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerTwilioSubaccount_partnerId_key" ON "PartnerTwilioSubaccount"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerTwilioSubaccount_twilioSubaccountSid_key" ON "PartnerTwilioSubaccount"("twilioSubaccountSid");

-- CreateIndex
CREATE INDEX "SmsOptIn_phone_idx" ON "SmsOptIn"("phone");

-- CreateIndex
CREATE INDEX "SmsOptIn_createdAt_idx" ON "SmsOptIn"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_tenantId_userId_idx" ON "PushDevice"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "PipelineStage_tenantId_partnerId_sortOrder_idx" ON "PipelineStage"("tenantId", "partnerId", "sortOrder");

-- CreateIndex
CREATE INDEX "PipelineStage_partnerId_idx" ON "PipelineStage"("partnerId");

-- CreateIndex
CREATE INDEX "ContactNote_contactId_createdAt_idx" ON "ContactNote"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactNote_tenantId_createdAt_idx" ON "ContactNote"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactNote_partnerId_createdAt_idx" ON "ContactNote"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentReminder_status_scheduledAt_idx" ON "AppointmentReminder"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AppointmentReminder_tenantId_scheduledAt_idx" ON "AppointmentReminder"("tenantId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_channel_offsetMin_key" ON "AppointmentReminder"("appointmentId", "channel", "offsetMin");

-- CreateIndex
CREATE INDEX "PartnerScript_affiliateAccountId_idx" ON "PartnerScript"("affiliateAccountId");

-- CreateIndex
CREATE INDEX "PartnerScript_isDefault_idx" ON "PartnerScript"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionTier_level_key" ON "CommissionTier"("level");

-- CreateIndex
CREATE UNIQUE INDEX "GmbEvaluation_shareToken_key" ON "GmbEvaluation"("shareToken");

-- CreateIndex
CREATE INDEX "GmbEvaluation_partnerId_createdAt_idx" ON "GmbEvaluation"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadSearch_partnerId_createdAt_idx" ON "LeadSearch"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_partnerId_reviewStatus_idx" ON "Lead"("partnerId", "reviewStatus");

-- CreateIndex
CREATE INDEX "Lead_searchId_idx" ON "Lead"("searchId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSendingDomain_domain_key" ON "PartnerSendingDomain"("domain");

-- CreateIndex
CREATE INDEX "PartnerSendingDomain_partnerId_status_idx" ON "PartnerSendingDomain"("partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ColdEmailSend_unsubscribeToken_key" ON "ColdEmailSend"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "ColdEmailSend_partnerId_sentAt_idx" ON "ColdEmailSend"("partnerId", "sentAt");

-- CreateIndex
CREATE INDEX "ColdEmailSend_partnerId_status_idx" ON "ColdEmailSend"("partnerId", "status");

-- CreateIndex
CREATE INDEX "ColdEmailCampaign_partnerId_status_idx" ON "ColdEmailCampaign"("partnerId", "status");

-- CreateIndex
CREATE INDEX "ColdEmailCampaignTouch_campaignId_idx" ON "ColdEmailCampaignTouch"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ColdEmailCampaignTouch_campaignId_touchNumber_key" ON "ColdEmailCampaignTouch"("campaignId", "touchNumber");

-- CreateIndex
CREATE INDEX "ColdEmailCampaignLead_campaignId_status_idx" ON "ColdEmailCampaignLead"("campaignId", "status");

-- CreateIndex
CREATE INDEX "ColdEmailCampaignLead_status_nextTouchAt_idx" ON "ColdEmailCampaignLead"("status", "nextTouchAt");

-- CreateIndex
CREATE UNIQUE INDEX "ColdEmailCampaignLead_campaignId_leadId_key" ON "ColdEmailCampaignLead"("campaignId", "leadId");

-- CreateIndex
CREATE INDEX "EmailTemplate_partnerId_sortOrder_idx" ON "EmailTemplate"("partnerId", "sortOrder");

-- CreateIndex
CREATE INDEX "EmailTemplate_isSystem_sortOrder_idx" ON "EmailTemplate"("isSystem", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Email_messageId_key" ON "Email"("messageId");

-- CreateIndex
CREATE INDEX "Email_partnerId_direction_createdAt_idx" ON "Email"("partnerId", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "Email_partnerId_threadId_idx" ON "Email"("partnerId", "threadId");

-- CreateIndex
CREATE INDEX "EmailSuppression_email_idx" ON "EmailSuppression"("email");

-- CreateIndex
CREATE INDEX "EmailSuppression_tenantId_email_idx" ON "EmailSuppression"("tenantId", "email");

-- CreateIndex
CREATE INDEX "EmailSuppression_partnerId_email_idx" ON "EmailSuppression"("partnerId", "email");

-- CreateIndex
CREATE INDEX "EmailSuppression_tenantId_createdAt_idx" ON "EmailSuppression"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailSuppression_partnerId_createdAt_idx" ON "EmailSuppression"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailCampaign_partnerId_status_createdAt_idx" ON "EmailCampaign"("partnerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailCampaign_tenantId_status_idx" ON "EmailCampaign"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EmailCampaign_status_scheduledAt_idx" ON "EmailCampaign"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_campaignId_status_idx" ON "EmailCampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_status_sentAt_idx" ON "EmailCampaignRecipient"("status", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignRecipient_campaignId_email_key" ON "EmailCampaignRecipient"("campaignId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingKitVideo_filename_key" ON "MarketingKitVideo"("filename");

-- CreateIndex
CREATE INDEX "MarketingKitVideo_intent_sortOrder_idx" ON "MarketingKitVideo"("intent", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingKitVideo_visible_sortOrder_idx" ON "MarketingKitVideo"("visible", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingKitVideo_mediaType_idx" ON "MarketingKitVideo"("mediaType");

-- CreateIndex
CREATE INDEX "MarketingKitVideo_updatedAt_idx" ON "MarketingKitVideo"("updatedAt");

-- CreateIndex
CREATE INDEX "MarketingKitVideo_brand_intent_sortOrder_idx" ON "MarketingKitVideo"("brand", "intent", "sortOrder");

-- CreateIndex
CREATE INDEX "WebinarLeadList_partnerId_status_idx" ON "WebinarLeadList"("partnerId", "status");

-- CreateIndex
CREATE INDEX "WebinarLeadList_partnerId_createdAt_idx" ON "WebinarLeadList"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "WebinarSearchQuery_leadListId_status_idx" ON "WebinarSearchQuery"("leadListId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarSearchQuery_leadListId_queryText_provider_key" ON "WebinarSearchQuery"("leadListId", "queryText", "provider");

-- CreateIndex
CREATE INDEX "WebinarDiscoveredUrl_leadListId_status_idx" ON "WebinarDiscoveredUrl"("leadListId", "status");

-- CreateIndex
CREATE INDEX "WebinarDiscoveredUrl_domain_idx" ON "WebinarDiscoveredUrl"("domain");

-- CreateIndex
CREATE INDEX "WebinarExtractedEmail_leadListId_classificationStatus_idx" ON "WebinarExtractedEmail"("leadListId", "classificationStatus");

-- CreateIndex
CREATE INDEX "WebinarExtractedEmail_normalizedEmail_idx" ON "WebinarExtractedEmail"("normalizedEmail");

-- CreateIndex
CREATE INDEX "WebinarExtractedEmail_domain_idx" ON "WebinarExtractedEmail"("domain");

-- CreateIndex
CREATE INDEX "WebinarEmailVerification_extractedEmailId_idx" ON "WebinarEmailVerification"("extractedEmailId");

-- CreateIndex
CREATE INDEX "WebinarEmailVerification_normalizedEmail_idx" ON "WebinarEmailVerification"("normalizedEmail");

-- CreateIndex
CREATE INDEX "WebinarInviteContact_leadListId_idx" ON "WebinarInviteContact"("leadListId");

-- CreateIndex
CREATE INDEX "WebinarInviteContact_unsubscribedAt_idx" ON "WebinarInviteContact"("unsubscribedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarInviteContact_partnerId_normalizedEmail_key" ON "WebinarInviteContact"("partnerId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "WebinarSuppression_partnerId_idx" ON "WebinarSuppression"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarSuppression_partnerId_normalizedEmail_key" ON "WebinarSuppression"("partnerId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "WebinarAuditLog_partnerId_createdAt_idx" ON "WebinarAuditLog"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "WebinarAuditLog_action_idx" ON "WebinarAuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "CallReview_conversationId_key" ON "CallReview"("conversationId");

-- CreateIndex
CREATE INDEX "CallReview_tenantId_createdAt_idx" ON "CallReview"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CallReview_status_idx" ON "CallReview"("status");

-- CreateIndex
CREATE INDEX "CallReviewFinding_reviewId_idx" ON "CallReviewFinding"("reviewId");

-- CreateIndex
CREATE INDEX "CallReviewFinding_reviewStatus_severity_idx" ON "CallReviewFinding"("reviewStatus", "severity");

-- CreateIndex
CREATE INDEX "CallReviewFinding_tenantId_disposition_idx" ON "CallReviewFinding"("tenantId", "disposition");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPromptRule_sourceFindingId_key" ON "AgentPromptRule"("sourceFindingId");

-- CreateIndex
CREATE INDEX "AgentPromptRule_status_tenantId_idx" ON "AgentPromptRule"("status", "tenantId");

-- CreateIndex
CREATE INDEX "WebinarPerson_tenantId_normalizedPhone_idx" ON "WebinarPerson"("tenantId", "normalizedPhone");

-- CreateIndex
CREATE INDEX "WebinarPerson_contactId_idx" ON "WebinarPerson"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarPerson_tenantId_normalizedEmail_key" ON "WebinarPerson"("tenantId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Webinar_slug_key" ON "Webinar"("slug");

-- CreateIndex
CREATE INDEX "Webinar_tenantId_status_idx" ON "Webinar"("tenantId", "status");

-- CreateIndex
CREATE INDEX "WebinarSession_webinarId_status_idx" ON "WebinarSession"("webinarId", "status");

-- CreateIndex
CREATE INDEX "WebinarSession_tenantId_idx" ON "WebinarSession"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Registrant_joinToken_key" ON "Registrant"("joinToken");

-- CreateIndex
CREATE INDEX "Registrant_webinarId_personId_idx" ON "Registrant"("webinarId", "personId");

-- CreateIndex
CREATE INDEX "Registrant_tenantId_idx" ON "Registrant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Registrant_webinarId_email_key" ON "Registrant"("webinarId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "InteractionEvent_traceId_key" ON "InteractionEvent"("traceId");

-- CreateIndex
CREATE INDEX "InteractionEvent_personId_ts_idx" ON "InteractionEvent"("personId", "ts");

-- CreateIndex
CREATE INDEX "InteractionEvent_tenantId_ts_idx" ON "InteractionEvent"("tenantId", "ts");

-- CreateIndex
CREATE INDEX "InteractionEvent_webinarId_type_idx" ON "InteractionEvent"("webinarId", "type");

-- CreateIndex
CREATE INDEX "EngagementScore_tenantId_temp_idx" ON "EngagementScore"("tenantId", "temp");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementScore_personId_webinarId_key" ON "EngagementScore"("personId", "webinarId");

-- CreateIndex
CREATE INDEX "PartnerDailyActivityProgress_partnerId_dayKey_idx" ON "PartnerDailyActivityProgress"("partnerId", "dayKey");

-- CreateIndex
CREATE INDEX "PartnerDailyActivityProgress_dayKey_idx" ON "PartnerDailyActivityProgress"("dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerDailyActivityProgress_partnerId_activityKey_dayKey_key" ON "PartnerDailyActivityProgress"("partnerId", "activityKey", "dayKey");

-- CreateIndex
CREATE INDEX "PartnerGroup_partnerId_status_idx" ON "PartnerGroup"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerGroupPost_partnerId_groupId_idx" ON "PartnerGroupPost"("partnerId", "groupId");

-- CreateIndex
CREATE INDEX "PartnerGroupPost_partnerId_postedAt_idx" ON "PartnerGroupPost"("partnerId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProspect_demoSlug_key" ON "AgentProspect"("demoSlug");

-- CreateIndex
CREATE INDEX "AgentProspect_ownerId_idx" ON "AgentProspect"("ownerId");

-- CreateIndex
CREATE INDEX "AgentProspect_status_idx" ON "AgentProspect"("status");

-- CreateIndex
CREATE INDEX "AgentProspect_score_idx" ON "AgentProspect"("score");

-- CreateIndex
CREATE INDEX "DemoLead_createdAt_idx" ON "DemoLead"("createdAt");

-- CreateIndex
CREATE INDEX "DemoLead_email_idx" ON "DemoLead"("email");

-- CreateIndex
CREATE INDEX "DemoLead_phoneE164_idx" ON "DemoLead"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_pin_key" ON "DemoSession"("pin");

-- CreateIndex
CREATE INDEX "DemoSession_tenantId_idx" ON "DemoSession"("tenantId");

-- CreateIndex
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_tenantId_browserRef_key" ON "DemoSession"("tenantId", "browserRef");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDemo_tenantId_key" ON "AgentDemo"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDemo_pin_key" ON "AgentDemo"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDemo_micrositeSlug_key" ON "AgentDemo"("micrositeSlug");

-- CreateIndex
CREATE INDEX "AgentDemo_status_idx" ON "AgentDemo"("status");

-- CreateIndex
CREATE INDEX "AgentDemo_agentPhone_idx" ON "AgentDemo"("agentPhone");

-- CreateIndex
CREATE INDEX "AgentDemo_agentEmail_idx" ON "AgentDemo"("agentEmail");

-- CreateIndex
CREATE INDEX "Listing_tenantId_isActive_idx" ON "Listing"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Listing_tenantId_status_idx" ON "Listing"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Listing_ownerId_idx" ON "Listing"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_slug_key" ON "AffiliateAccount"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_integrationConnectionId_key" ON "AffiliateAccount"("integrationConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_partnerId_agentRoleType_key" ON "AgentProfile"("partnerId", "agentRoleType");

-- CreateIndex
CREATE INDEX "Appointment_partnerId_idx" ON "Appointment"("partnerId");

-- CreateIndex
CREATE INDEX "CampaignTemplate_subcategory_idx" ON "CampaignTemplate"("subcategory");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTemplate_vertical_campaignType_name_key" ON "CampaignTemplate"("vertical", "campaignType", "name");

-- CreateIndex
CREATE INDEX "Contact_tenantId_pipelineStageId_idx" ON "Contact"("tenantId", "pipelineStageId");

-- CreateIndex
CREATE INDEX "Contact_partnerId_pipelineStageId_idx" ON "Contact"("partnerId", "pipelineStageId");

-- CreateIndex
CREATE INDEX "Conversation_isFeaturedDemo_featuredCategory_featuredSortOr_idx" ON "Conversation"("isFeaturedDemo", "featuredCategory", "featuredSortOrder");

-- CreateIndex
CREATE INDEX "Conversation_partnerId_idx" ON "Conversation"("partnerId");

-- CreateIndex
CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");

-- CreateIndex
CREATE INDEX "Conversation_demoSessionId_idx" ON "Conversation"("demoSessionId");

-- CreateIndex
CREATE INDEX "MessageLog_partnerId_channel_createdAt_idx" ON "MessageLog"("partnerId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneNumber_tenantId_idx" ON "PhoneNumber"("tenantId");

-- CreateIndex
CREATE INDEX "PhoneNumber_partnerId_idx" ON "PhoneNumber"("partnerId");

-- CreateIndex
CREATE INDEX "PhoneNumber_purchaseStatus_idx" ON "PhoneNumber"("purchaseStatus");

-- CreateIndex
CREATE INDEX "PhoneNumber_listingId_idx" ON "PhoneNumber"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeConnectAccountId_key" ON "Tenant"("stripeConnectAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantA2PApplication_partnerId_key" ON "TenantA2PApplication"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- AddForeignKey
ALTER TABLE "KnowledgeBaseFile" ADD CONSTRAINT "KnowledgeBaseFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseFile" ADD CONSTRAINT "KnowledgeBaseFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayment" ADD CONSTRAINT "TenantPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerStripeCustomerRef" ADD CONSTRAINT "PartnerStripeCustomerRef_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSmsCreditLedger" ADD CONSTRAINT "PartnerSmsCreditLedger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerVoiceUsageLedger" ADD CONSTRAINT "PartnerVoiceUsageLedger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTwilioSubaccount" ADD CONSTRAINT "PartnerTwilioSubaccount_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantA2PApplication" ADD CONSTRAINT "TenantA2PApplication_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_featuredById_fkey" FOREIGN KEY ("featuredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAccount" ADD CONSTRAINT "AffiliateAccount_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAccount" ADD CONSTRAINT "AffiliateAccount_commissionTierId_fkey" FOREIGN KEY ("commissionTierId") REFERENCES "CommissionTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerScript" ADD CONSTRAINT "PartnerScript_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmbEvaluation" ADD CONSTRAINT "GmbEvaluation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSearch" ADD CONSTRAINT "LeadSearch_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "LeadSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSendingDomain" ADD CONSTRAINT "PartnerSendingDomain_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdEmailSend" ADD CONSTRAINT "ColdEmailSend_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdEmailCampaign" ADD CONSTRAINT "ColdEmailCampaign_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdEmailCampaignTouch" ADD CONSTRAINT "ColdEmailCampaignTouch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ColdEmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdEmailCampaignLead" ADD CONSTRAINT "ColdEmailCampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ColdEmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColdEmailCampaignLead" ADD CONSTRAINT "ColdEmailCampaignLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarLeadList" ADD CONSTRAINT "WebinarLeadList_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarSearchQuery" ADD CONSTRAINT "WebinarSearchQuery_leadListId_fkey" FOREIGN KEY ("leadListId") REFERENCES "WebinarLeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarDiscoveredUrl" ADD CONSTRAINT "WebinarDiscoveredUrl_leadListId_fkey" FOREIGN KEY ("leadListId") REFERENCES "WebinarLeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarDiscoveredUrl" ADD CONSTRAINT "WebinarDiscoveredUrl_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "WebinarSearchQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarExtractedEmail" ADD CONSTRAINT "WebinarExtractedEmail_leadListId_fkey" FOREIGN KEY ("leadListId") REFERENCES "WebinarLeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarExtractedEmail" ADD CONSTRAINT "WebinarExtractedEmail_discoveredUrlId_fkey" FOREIGN KEY ("discoveredUrlId") REFERENCES "WebinarDiscoveredUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarEmailVerification" ADD CONSTRAINT "WebinarEmailVerification_extractedEmailId_fkey" FOREIGN KEY ("extractedEmailId") REFERENCES "WebinarExtractedEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarInviteContact" ADD CONSTRAINT "WebinarInviteContact_leadListId_fkey" FOREIGN KEY ("leadListId") REFERENCES "WebinarLeadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarInviteContact" ADD CONSTRAINT "WebinarInviteContact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarSuppression" ADD CONSTRAINT "WebinarSuppression_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallReviewFinding" ADD CONSTRAINT "CallReviewFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CallReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebinarSession" ADD CONSTRAINT "WebinarSession_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrant" ADD CONSTRAINT "Registrant_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrant" ADD CONSTRAINT "Registrant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WebinarSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registrant" ADD CONSTRAINT "Registrant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "WebinarPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionEvent" ADD CONSTRAINT "InteractionEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "WebinarPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionEvent" ADD CONSTRAINT "InteractionEvent_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionEvent" ADD CONSTRAINT "InteractionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WebinarSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementScore" ADD CONSTRAINT "EngagementScore_personId_fkey" FOREIGN KEY ("personId") REFERENCES "WebinarPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementScore" ADD CONSTRAINT "EngagementScore_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "Webinar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDailyActivityProgress" ADD CONSTRAINT "PartnerDailyActivityProgress_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDemo" ADD CONSTRAINT "AgentDemo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

