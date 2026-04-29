-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PromptScope" AS ENUM ('PLATFORM', 'TENANT', 'CHANNEL', 'ROLE', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WIDGET', 'INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "AgentRoleType" AS ENUM ('ORCHESTRATOR', 'APPOINTMENT', 'SALES', 'CUSTOMER_SERVICE', 'MARKETING', 'ASSISTANT', 'SECRETARY');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE', 'TWILIO', 'STRIPE', 'TRANSACTIONAL_EMAIL');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'ERROR', 'RECONNECT_REQUIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ConversationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'WIDGET');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'COMPLETED', 'FAILED', 'ESCALATED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RESCHEDULED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS', 'VOICE');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'HOLD', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "SecretOwnerType" AS ENUM ('PLATFORM', 'TENANT', 'USER', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "EntitlementValueType" AS ENUM ('BOOLEAN', 'INTEGER', 'STRING');

-- CreateEnum
CREATE TYPE "EntitlementSourceType" AS ENUM ('PLAN', 'ADMIN_OVERRIDE', 'PROMOTION', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED');

-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RotationStatus" AS ENUM ('VALID', 'NEEDS_ROTATION', 'REVOKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "registrationEmail" TEXT NOT NULL,
    "publicEmail" TEXT,
    "publicPhone" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleDefinitionId" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPlatformRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interval" "PlanInterval" NOT NULL,
    "stripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntitlement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueType" "EntitlementValueType" NOT NULL,
    "booleanValue" BOOLEAN,
    "integerValue" INTEGER,
    "stringValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueType" "EntitlementValueType" NOT NULL,
    "booleanValue" BOOLEAN,
    "integerValue" INTEGER,
    "stringValue" TEXT,
    "sourceType" "EntitlementSourceType" NOT NULL,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "serviceAreasJson" JSONB,
    "businessHoursJson" JSONB,
    "fallbackNotificationEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDNA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "identityJson" JSONB NOT NULL,
    "servicesJson" JSONB NOT NULL,
    "pricingJson" JSONB NOT NULL,
    "operationsJson" JSONB NOT NULL,
    "salesJson" JSONB NOT NULL,
    "appointmentJson" JSONB NOT NULL,
    "supportJson" JSONB NOT NULL,
    "languageJson" JSONB NOT NULL,
    "complianceJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDNA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "scope" "PromptScope" NOT NULL,
    "channelType" "ChannelType",
    "agentRoleType" "AgentRoleType",
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "parentPromptId" TEXT,
    "createdByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentRoleType" "AgentRoleType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersionId" TEXT,
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelType" "ChannelType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "greetingMode" TEXT,
    "afterHoursMode" TEXT,
    "escalationMode" TEXT,
    "configJson" JSONB,
    "promptVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "label" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "externalEmail" TEXT,
    "metadataJson" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "reconnectRequiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleConnectionDetail" (
    "id" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "mailboxEmail" TEXT NOT NULL,
    "grantedScopesJson" JSONB NOT NULL,
    "calendarIdsJson" JSONB,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnectionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwilioConnectionDetail" (
    "id" TEXT NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "accountSid" TEXT NOT NULL,
    "messagingServiceSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwilioConnectionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeCustomerRef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeCustomerRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumber" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "twilioNumberSid" TEXT,
    "e164Number" TEXT NOT NULL,
    "displayLabel" TEXT,
    "isInboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isOutboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "forwardingTarget" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phoneE164" TEXT,
    "source" TEXT NOT NULL,
    "tagsJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "channelType" "ChannelType" NOT NULL,
    "direction" "ConversationDirection" NOT NULL,
    "status" "ConversationStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "summaryText" TEXT,
    "transcriptRef" TEXT,
    "outcomeCode" TEXT,
    "outcomeJson" JSONB,
    "externalCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "status" "AppointmentStatus" NOT NULL,
    "appointmentType" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "providerEventId" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "bodyRef" TEXT,
    "providerMessageId" TEXT,
    "deliveryStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "direction" "ConversationDirection" NOT NULL,
    "sourceNumber" TEXT NOT NULL,
    "destinationNumber" TEXT NOT NULL,
    "providerCallId" TEXT,
    "status" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "forwarded" BOOLEAN NOT NULL DEFAULT false,
    "forwardingTarget" TEXT,
    "outcomeCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecutionRef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "workflowCode" TEXT NOT NULL,
    "executionRef" TEXT NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL,
    "inputHash" TEXT,
    "resultJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowExecutionRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "referralCode" TEXT NOT NULL,
    "payoutMethodJson" JSONB,
    "taxProfileJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "tenantId" TEXT,
    "sessionId" TEXT,
    "landingPath" TEXT,
    "referrer" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateConversion" (
    "id" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "conversionType" TEXT NOT NULL,
    "conversionValue" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateConversionId" TEXT NOT NULL,
    "affiliateAccountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payoutRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "actorUserId" TEXT,
    "impersonationSessionId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadataJson" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretRef" (
    "id" TEXT NOT NULL,
    "ownerType" "SecretOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "secretType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalRef" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "rotationStatus" "RotationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assumedRoleKey" TEXT NOT NULL,
    "reasonCode" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceJson" JSONB,
    "scheduleJson" JSONB,
    "promptVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundCallAttempt" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "providerCallId" TEXT,
    "status" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "outcomeCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundCallAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMember_tenantId_userId_key" ON "TenantMember"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDefinition_key_key" ON "RoleDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntitlement_planId_key_key" ON "PlanEntitlement"("planId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TenantEntitlement_tenantId_key_key" ON "TenantEntitlement"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_tenantId_key" ON "BusinessProfile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDNA_tenantId_version_key" ON "BusinessDNA"("tenantId", "version");

-- CreateIndex
CREATE INDEX "PromptVersion_tenantId_scope_idx" ON "PromptVersion"("tenantId", "scope");

-- CreateIndex
CREATE INDEX "PromptVersion_tenantId_status_idx" ON "PromptVersion"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_tenantId_agentRoleType_key" ON "AgentProfile"("tenantId", "agentRoleType");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConfig_tenantId_channelType_key" ON "ChannelConfig"("tenantId", "channelType");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnectionDetail_integrationConnectionId_key" ON "GoogleConnectionDetail"("integrationConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioConnectionDetail_integrationConnectionId_key" ON "TwilioConnectionDetail"("integrationConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeCustomerRef_tenantId_key" ON "StripeCustomerRef"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeCustomerRef_stripeCustomerId_key" ON "StripeCustomerRef"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumber_e164Number_key" ON "PhoneNumber"("e164Number");

-- CreateIndex
CREATE INDEX "Contact_tenantId_email_idx" ON "Contact"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Contact_tenantId_phoneE164_idx" ON "Contact"("tenantId", "phoneE164");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_startedAt_idx" ON "Conversation"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_channelType_idx" ON "Conversation"("tenantId", "channelType");

-- CreateIndex
CREATE INDEX "Conversation_externalCallId_idx" ON "Conversation"("externalCallId");

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_providerCallId_key" ON "CallLog"("providerCallId");

-- CreateIndex
CREATE INDEX "CallLog_tenantId_startAt_idx" ON "CallLog"("tenantId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowExecutionRef_workflowCode_executionRef_key" ON "WorkflowExecutionRef"("workflowCode", "executionRef");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_userId_key" ON "AffiliateAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_referralCode_key" ON "AffiliateAccount"("referralCode");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateAccountId_createdAt_idx" ON "AffiliateClick"("affiliateAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateCommission_affiliateAccountId_status_idx" ON "AffiliateCommission"("affiliateAccountId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecretRef_ownerType_ownerId_secretType_label_key" ON "SecretRef"("ownerType", "ownerId", "secretType", "label");

-- CreateIndex
CREATE INDEX "ImpersonationSession_tenantId_startedAt_idx" ON "ImpersonationSession"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_adminUserId_startedAt_idx" ON "ImpersonationSession"("adminUserId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundCallAttempt_providerCallId_key" ON "OutboundCallAttempt"("providerCallId");

-- CreateIndex
CREATE INDEX "OutboundCallAttempt_campaignId_status_idx" ON "OutboundCallAttempt"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_roleDefinitionId_fkey" FOREIGN KEY ("roleDefinitionId") REFERENCES "RoleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantEntitlement" ADD CONSTRAINT "TenantEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDNA" ADD CONSTRAINT "BusinessDNA_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_parentPromptId_fkey" FOREIGN KEY ("parentPromptId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConfig" ADD CONSTRAINT "ChannelConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConfig" ADD CONSTRAINT "ChannelConfig_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleConnectionDetail" ADD CONSTRAINT "GoogleConnectionDetail_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwilioConnectionDetail" ADD CONSTRAINT "TwilioConnectionDetail_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeCustomerRef" ADD CONSTRAINT "StripeCustomerRef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionRef" ADD CONSTRAINT "WorkflowExecutionRef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAccount" ADD CONSTRAINT "AffiliateAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateConversionId_fkey" FOREIGN KEY ("affiliateConversionId") REFERENCES "AffiliateConversion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateAccountId_fkey" FOREIGN KEY ("affiliateAccountId") REFERENCES "AffiliateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_impersonationSessionId_fkey" FOREIGN KEY ("impersonationSessionId") REFERENCES "ImpersonationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundCampaign" ADD CONSTRAINT "OutboundCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundCallAttempt" ADD CONSTRAINT "OutboundCallAttempt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutboundCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundCallAttempt" ADD CONSTRAINT "OutboundCallAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundCallAttempt" ADD CONSTRAINT "OutboundCallAttempt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
