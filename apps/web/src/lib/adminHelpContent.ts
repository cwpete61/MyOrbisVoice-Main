/**
 * Admin / Support help center content.
 *
 * Lives at /admin/help, gated by requirePlatformAdmin.
 * Separate from the tenant-facing /help (helpContent.ts) — different audience,
 * different procedures, different screenshots.
 *
 * Reuses the HelpStep / HelpArticle / HelpSection types from helpContent.ts,
 * including the screenshots[] slots that auto-render placeholder boxes until
 * real PNGs are dropped at /admin-help-screenshots/<filename>.
 *
 * This is the initial scope (~5 articles covering the most common admin
 * tasks). Backlog item #13 in CLAUDE.md tracks the full ~30-article rollout.
 */
import type { HelpSection } from './helpContent'

export const ADMIN_HELP_CONTENT: HelpSection[] = [
  {
    id: 'admin-getting-started',
    label: 'Getting Started',
    icon: 'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 4v4m0 2.5v.5',
    articles: [
      {
        id: 'admin-overview',
        title: 'Admin Section — Overview',
        summary: 'What the admin/platform section does and how to navigate it. Read this first if you are new to support.',
        steps: [
          { title: 'What admin can do', body: 'Platform admins can: search and view all tenants, suspend or restore tenants, edit plans + entitlements, grant tier access for testing, enter any tenant in support mode (impersonation), update encrypted system secrets (Stripe / Twilio / Google / OpenAI / Bunny / Reoon / SMTP), view Twilio call logs across the platform, and read the system-wide audit log.' },
          { title: 'What admin CANNOT do', body: 'View plaintext secrets (they are encrypted at rest, write-only via the UI), bypass tenant data isolation in code (every query is scoped to a tenant), or send communications on a tenant\'s behalf without entering support mode (which is audit-logged).' },
          { title: 'Sidebar layout', body: 'Platform section: Overview, System Settings, Platform Status. Management: Tenants, Plans, Partners, Twilio Call Logs. Account: Profile, Help.', screenshots: [{ filename: 'admin-sidebar-full.png', caption: 'Full admin left sidebar showing all three sections (Platform / Management / Account) with every link visible' }] },
          { title: 'Audit log policy', body: 'Almost every admin action is recorded in AuditLog with the actor user ID, the target tenant or resource, and a metadata JSON payload. This is your forensic trail — when "what happened to tenant X" comes up, the audit log is the source of truth. CLAUDE.md documents the immutability policy at the application layer.' },
        ],
      },
    ],
  },
  {
    id: 'admin-tenants',
    label: 'Tenant Management',
    icon: 'M2 14V6l6-4 6 4v8M6 14v-4h4v4',
    articles: [
      {
        id: 'admin-tenants-search',
        title: 'Finding and Viewing a Tenant',
        summary: 'How to locate a specific tenant in the system and read their detail page.',
        steps: [
          { title: 'Open the Tenants list', body: 'Click "Tenants" in the Management section of the admin sidebar. The list shows every tenant in the system with status badges (TRIAL / ACTIVE / SUSPENDED / PAST_DUE).', screenshots: [{ filename: 'admin-tenants-list.png', caption: 'Admin Tenants page showing the searchable tenant list with status badges' }] },
          { title: 'Search by name or email', body: 'Use the search bar at the top to filter by display name or registration email. Matches happen as you type.', screenshots: [{ filename: 'admin-tenants-search-bar.png', caption: 'Top of Tenants list with the search input and active query highlighting matching rows' }] },
          { title: 'Click a tenant to open detail', body: 'Click any row to land on the tenant detail page. From there you can see all members, integrations, subscription state, conversation/appointment/contact counts, storage usage, and take admin actions.', screenshots: [{ filename: 'admin-tenant-detail-overview.png', caption: 'Full admin tenant detail page showing the Details / Plan-Tier / Activity / Members / Integrations / Recording Storage cards' }] },
          { title: 'What each panel means', body: 'Details: name, email, timezone, current plan, brand. Activity: counts of conversations / appointments / contacts / members. Members: who can log into this tenant. Integrations: status of Google / Twilio / etc. Recording Storage: their tier, quota, used bytes.' },
        ],
        tips: [
          'Bookmark the tenant detail page URL during a support session — it lets you jump back without re-searching.',
        ],
      },
      {
        id: 'admin-tenants-suspend-restore',
        title: 'Suspending or Restoring a Tenant',
        summary: 'When and how to suspend a tenant\'s access, and how to restore it.',
        steps: [
          { title: 'When to suspend', body: 'Suspend a tenant for: payment failure that has not been resolved after carrier follow-up, terms-of-service violations, suspected account takeover, or pending fraud investigation. Suspending is reversible — it does NOT delete data.' },
          { title: 'How to suspend', body: 'On the tenant detail page, click the red "Suspend" button at the top right. Confirm in the dialog.', screenshots: [{ filename: 'admin-tenant-suspend-button.png', caption: 'Top-right of tenant detail page with the red Suspend button' }] },
          { title: 'What happens when suspended', body: 'The tenant cannot log in (login returns 403), their voice gateway sessions terminate, scheduled outbound campaigns pause, and their status badge changes to SUSPENDED. Inbound calls to their Twilio numbers continue to ring but the agent does not answer.' },
          { title: 'How to restore', body: 'On a suspended tenant\'s detail page, the Suspend button is replaced with a teal "Restore" button. Click it to reactivate. Status returns to ACTIVE (or whatever it was before).', screenshots: [{ filename: 'admin-tenant-restore-button.png', caption: 'Top-right of suspended tenant detail page showing the Restore button' }] },
          { title: 'Audit signature', body: 'Suspending writes admin.tenant_suspended to AuditLog. Restoring writes admin.tenant_restored. Both include the actor user ID and timestamp.' },
        ],
        warnings: [
          'Do not suspend a tenant during an active customer conversation — they will be cut off mid-call. Wait for current conversations to end, or notify them first.',
        ],
      },
      {
        id: 'admin-tenants-impersonate',
        title: 'Entering as Tenant (Support Mode)',
        summary: 'How to log into a tenant\'s account to troubleshoot or configure on their behalf.',
        steps: [
          { title: 'When to use support mode', body: 'When a customer reports a problem you cannot reproduce from outside, when they ask you to make a configuration change for them, or when you need to verify they are seeing what they should be seeing. Always prefer to walk them through a fix over making changes on their behalf.' },
          { title: 'Click "Enter as tenant"', body: 'On the tenant detail page, click the "Enter as tenant →" button at the top right. This issues a short-TTL impersonation token and redirects you into their dashboard.', screenshots: [{ filename: 'admin-enter-as-tenant-button.png', caption: 'Top-right of tenant detail page showing the Enter as tenant button next to Suspend' }] },
          { title: 'Recognize support mode', body: 'A red/orange banner appears at the top of every page in the tenant dashboard while you are in support mode. It reads: "Support mode — acting as <TenantName>. All actions are audit-logged." This is your reminder that every click writes an audit log entry attributed to your admin account.', screenshots: [{ filename: 'admin-impersonation-banner.png', caption: 'Top of tenant dashboard showing the orange Support mode banner with the Exit support mode button on the right' }] },
          { title: 'What you can do in support mode', body: 'Anything the tenant owner can do — change settings, edit Business DNA, configure agents, view conversations. Do NOT initiate calls or send SMS unless the customer specifically asked you to.' },
          { title: 'Exit support mode', body: 'Click "Exit support mode" in the orange banner. You are returned to your admin session immediately, no re-login needed. The exit is audit-logged with the session duration.' },
          { title: 'Audit signature', body: 'Entering writes admin.impersonation_started with the impersonated tenant ID and the impersonation session ID. Every action you take during the session writes its normal audit entry but with actorUserId = your admin user. Exiting writes admin.impersonation_ended with the session duration.' },
        ],
        warnings: [
          'Support mode tokens have a short TTL (~15 min). If you need longer, exit and re-enter — the new session starts a fresh audit-logged entry.',
          'Never use support mode to make purchases, accept terms on a tenant\'s behalf, or send communications to their customers.',
        ],
      },
      {
        id: 'admin-tenants-grant-plan',
        title: 'Grant Plan / Tier (Stripe Bypass — Testing Only)',
        summary: 'How to give a tenant any tier\'s entitlements without going through Stripe checkout. For internal feature testing only.',
        steps: [
          { title: 'When to use this', body: 'You want to test how a paid tier looks/works without paying. You created a fresh test tenant via the normal signup flow (free tier) and want to flip them to Pro to verify Pro-tier features. You want to verify a downgrade from Premier to Basic does the right thing without two separate Stripe customers.' },
          { title: 'When NOT to use this', body: 'Granting plans to a real customer who has not paid. The audit log is your accountability — every grant is recorded. If a real customer has a billing issue, refund + re-checkout via Stripe; do not paper over it with admin grants.' },
          { title: 'Find the panel', body: 'On the tenant detail page, look for the card titled "Plan / Tier (Admin Grant — Bypasses Stripe)". It has a plan dropdown and a Grant button.', screenshots: [{ filename: 'admin-grant-plan-card.png', caption: 'Tenant detail page showing the Plan/Tier admin grant card with the dropdown and Grant button' }] },
          { title: 'Grant a plan', body: 'Pick a plan from the dropdown (Free / Basic / Pro / Premier / Enterprise / LTD), click Grant. Within ~1 second the tenant\'s entitlements update — verify by entering as tenant or refreshing their dashboard.' },
          { title: 'Revoke when done', body: 'Click the red "Revoke admin grant → reset to Free tier" button. This cancels any admin-granted Subscription rows (stripeSubscriptionId IS NULL) and resyncs entitlements from the Free plan. Real Stripe subscriptions are NOT touched.', screenshots: [{ filename: 'admin-grant-plan-revoke.png', caption: 'Plan/Tier card showing the red Revoke button below the Grant control' }] },
          { title: 'How it differs from real Stripe subs', body: 'Admin-granted subs have stripeSubscriptionId = null. Real Stripe subs have a sub_xxx ID populated by the Stripe webhook. The two coexist — granting Pro to a tenant who already has a real Basic Stripe sub does NOT cancel their Stripe sub; it just overrides the entitlements until you revoke. To test downgrade-from-real-Stripe scenarios, use Stripe test mode with a real test card.' },
          { title: 'Audit signature', body: 'Granting writes admin.plan_granted with the granted plan code, the plan name, and the granting admin\'s email. Revoking writes admin.plan_revoked with the count of subs canceled and the reset target ("free").' },
        ],
        warnings: [
          'Every grant is audit-logged. If audit reviewers flag an admin-granted plan on a real customer\'s tenant, you need to be able to explain why.',
        ],
      },
    ],
  },
  {
    id: 'admin-billing',
    label: 'Billing & Plans',
    icon: 'M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
    articles: [
      {
        id: 'admin-plans-edit',
        title: 'Editing Plan Entitlements',
        summary: 'How to adjust the limits and feature flags on each plan tier.',
        steps: [
          { title: 'Open the Plans page', body: 'Click "Plans" in the Management section of the admin sidebar. The page lists all 6 plan tiers as collapsible accordions.', screenshots: [{ filename: 'admin-plans-list.png', caption: 'Admin Plans page showing all 6 tier accordions in collapsed state' }] },
          { title: 'Expand a plan', body: 'Click any plan card to expand its entitlements. You will see all 35+ entitlement keys (max_channels, max_agents, widget_enabled, etc.) with editable input fields next to each.', screenshots: [{ filename: 'admin-plan-expanded.png', caption: 'A plan accordion expanded showing the full list of entitlements with edit fields' }] },
          { title: 'Edit and save', body: 'Change values directly in the input fields. Click "Save" at the bottom of the plan card. Changes apply to the plan template — they do NOT retroactively change existing tenant entitlements (those are synced from the plan only on subscribe/upgrade events). To push a plan change to all current subscribers, you would need to re-run syncEntitlementsFromPlan via a script.' },
          { title: 'Audit signature', body: 'admin.plan_updated with the plan ID and the diff of changed fields.' },
        ],
        tips: [
          'Test entitlement changes by granting the edited plan to a test tenant first (see Grant Plan article). Lets you verify the change behaves as expected before any real customer is affected.',
        ],
      },
    ],
  },
  {
    id: 'admin-system',
    label: 'System Settings',
    icon: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4.3-1.3A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-.2-.7l1.5-1.2-1-1.7-1.8.6A4.5 4.5 0 0 0 9.7 4.2L9.5 2.5h-2l-.2 1.7A4.5 4.5 0 0 0 5.9 5l-1.8-.6-1 1.7 1.5 1.2A4.5 4.5 0 0 0 4.5 8a4.5 4.5 0 0 0 .1.7L3.1 9.9l1 1.7 1.8-.6a4.5 4.5 0 0 0 1.4.8l.2 1.7h2l.2-1.7a4.5 4.5 0 0 0 1.4-.8l1.8.6 1-1.7z',
    articles: [
      {
        id: 'admin-system-secrets',
        title: 'Updating Encrypted System Secrets',
        summary: 'How to update API keys for Stripe, Twilio, Google, OpenAI, Bunny, Reoon, and SMTP without exposing them in plaintext anywhere.',
        steps: [
          { title: 'How storage works', body: 'Every external-provider secret lives in the SystemConfig DB table, encrypted at rest with AES-256-GCM using AUTH_SECRET as the key derivation seed. The UI never reads back the plaintext value — only "is it set?". This is intentional: even with admin access, you cannot leak a secret you never see.' },
          { title: 'Open System Settings', body: 'Click "System Settings" in the Platform section of the admin sidebar. You will see one card per integration (Stripe, Twilio, Google, OpenAI, Bunny, Reoon, SMTP).', screenshots: [{ filename: 'admin-system-settings-cards.png', caption: 'Admin System Settings page showing all 7 integration cards with status indicators' }] },
          { title: 'Update a key', body: 'Click the integration card you need. Each has write-only inputs (the existing value is shown as masked dots, never the actual value). Paste the new value, click Save. The value is encrypted before being stored.', screenshots: [{ filename: 'admin-system-settings-stripe-card.png', caption: 'Stripe card expanded showing Secret Key / Publishable Key / Webhook Secret input fields with Save button' }] },
          { title: 'Verify it took', body: 'After save, the indicator on the card flips to "✓ Set". To verify the key actually authenticates against the provider, the API service that uses it (Stripe, OpenAI, etc.) will surface a clear error in logs if the new value is wrong. Read the API container logs after a save to catch authentication failures fast.' },
          { title: 'Why some keys also live in .env.prod', body: 'A few critical keys (Stripe secret + webhook secret, OpenAI key) are pinned BOTH in SystemConfig AND in .env.prod on the server. The DB version is the canonical source; .env.prod is a fallback so the API still works if AUTH_SECRET changes and the DB-encrypted version becomes unreadable. When you rotate one of these, update both.' },
          { title: 'Audit signature', body: 'admin.system_config_updated with the config key name (e.g. "stripe_secret_key"). The old and new values are NOT logged — you cannot reconstruct rotated secrets from the audit log, by design.' },
        ],
        warnings: [
          'Never copy a plaintext API key into Slack, email, or shared documents. Paste directly from your password manager into the System Settings input field, then save.',
          'Rotating Stripe webhook secrets requires updating Stripe\'s endpoint configuration AS WELL — both sides need the same value. CLAUDE.md walks through the full rotation procedure.',
        ],
      },
    ],
  },
]
