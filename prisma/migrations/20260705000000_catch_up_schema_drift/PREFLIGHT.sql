-- ─────────────────────────────────────────────────────────────────────────────
-- PREFLIGHT for 20260705000000_catch_up_schema_drift
--
-- READ-ONLY. Run this against a database BEFORE applying the migration there.
-- It writes nothing and locks nothing.
--
-- Why: the migration adds 47 unique indexes. 40 are on tables it creates in the
-- same transaction, so they start empty and cannot collide. The 7 below are added
-- to PRE-EXISTING tables — if production already holds duplicate values in any of
-- them, CREATE UNIQUE INDEX fails and the whole migration rolls back.
--
-- NULLs are fine: Postgres treats NULLs as distinct in a unique index, so a column
-- full of NULLs (e.g. User.googleId for password users) never collides. Hence every
-- check below ignores NULLs — counting them would produce false alarms.
--
-- Expected result: zero rows. Any row returned is a real blocker; resolve the
-- duplicates first, then migrate.
--
--   psql "$PROD_DATABASE_URL" -f PREFLIGHT.sql
-- ─────────────────────────────────────────────────────────────────────────────

\echo '== Duplicate check for the 7 unique constraints added to existing tables =='

SELECT 'AffiliateAccount(slug)' AS constraint_at_risk, slug::text AS duplicate_value, COUNT(*) AS rows
FROM "AffiliateAccount" WHERE slug IS NOT NULL GROUP BY slug HAVING COUNT(*) > 1

UNION ALL
SELECT 'AffiliateAccount(integrationConnectionId)', "integrationConnectionId"::text, COUNT(*)
FROM "AffiliateAccount" WHERE "integrationConnectionId" IS NOT NULL
GROUP BY "integrationConnectionId" HAVING COUNT(*) > 1

UNION ALL
SELECT 'AgentProfile(partnerId, agentRoleType)', "partnerId"::text || ' / ' || "agentRoleType"::text, COUNT(*)
FROM "AgentProfile" WHERE "partnerId" IS NOT NULL AND "agentRoleType" IS NOT NULL
GROUP BY "partnerId", "agentRoleType" HAVING COUNT(*) > 1

UNION ALL
SELECT 'CampaignTemplate(vertical, campaignType, name)',
       COALESCE(vertical::text,'∅') || ' / ' || COALESCE("campaignType"::text,'∅') || ' / ' || COALESCE(name,'∅'), COUNT(*)
FROM "CampaignTemplate" WHERE vertical IS NOT NULL AND "campaignType" IS NOT NULL AND name IS NOT NULL
GROUP BY vertical, "campaignType", name HAVING COUNT(*) > 1

UNION ALL
SELECT 'Tenant(stripeConnectAccountId)', "stripeConnectAccountId"::text, COUNT(*)
FROM "Tenant" WHERE "stripeConnectAccountId" IS NOT NULL
GROUP BY "stripeConnectAccountId" HAVING COUNT(*) > 1

UNION ALL
SELECT 'TenantA2PApplication(partnerId)', "partnerId"::text, COUNT(*)
FROM "TenantA2PApplication" WHERE "partnerId" IS NOT NULL
GROUP BY "partnerId" HAVING COUNT(*) > 1

UNION ALL
SELECT 'User(googleId)', "googleId"::text, COUNT(*)
FROM "User" WHERE "googleId" IS NOT NULL
GROUP BY "googleId" HAVING COUNT(*) > 1

ORDER BY 1, 3 DESC;

\echo ''
\echo 'Zero rows above == safe to migrate. Any row == fix those duplicates first.'
\echo ''
\echo '== Does this database already have the webinar tables (db push drift)? =='
-- If these exist, the DB was built with `db push` and the migration will collide.
-- In that case use: prisma migrate resolve --applied 20260705000000_catch_up_schema_drift
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('Webinar','WebinarSession','WebinarPerson','Registrant','InteractionEvent','EngagementScore')
ORDER BY 1;

\echo ''
\echo '== Has any migration ever been applied here? =='
SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_migration_history;
