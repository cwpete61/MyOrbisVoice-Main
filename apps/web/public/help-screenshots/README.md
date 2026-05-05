# Tenant Help Center — Screenshot Inventory

Drop PNG files into this folder using the exact filenames listed below. Help
articles automatically detect when an image exists and render it; otherwise
they show a labeled placeholder box describing what the screenshot should
depict.

## Two ways to capture screenshots

### Option 1 — Automated via `pnpm capture-screenshots`

Each screenshot slot in `apps/web/src/lib/helpContent.ts` can carry an optional
`capture` block describing how to navigate Puppeteer to the right view:

```ts
screenshots: [{
  filename: 'nav-channels.png',
  caption: 'Sidebar Channels link highlighted',
  capture: {
    url: '/channels',
    authAs: 'tenant',
    selector: 'aside nav a[href="/channels"]',  // optional — element-only crop
    setup: [{ action: 'wait', ms: 500 }],        // optional — clicks/typing/waits
    viewport: { width: 1280, height: 800 },
  },
}]
```

Then run:

```bash
export E2E_TENANT_LOGIN_EMAIL=<test-tenant-email>
export E2E_TENANT_LOGIN_PASSWORD=<password>
export E2E_ADMIN_LOGIN_EMAIL=<admin-email>     # only needed for admin help captures
export E2E_ADMIN_LOGIN_PASSWORD=<password>

pnpm capture-screenshots                       # all annotated slots
pnpm capture-screenshots --tenant              # only this folder
pnpm capture-screenshots --admin               # only admin-help-screenshots
pnpm capture-screenshots --filename foo.png    # one specific slot
```

The script logs in once per role, navigates to each slot, runs the setup
steps if any, and writes the PNG. Slots without `capture` metadata are
skipped — annotate them as feature testing surfaces UI bugs.

### Option 2 — Manually

1. Log in to the live tenant portal at https://app.myorbisvoice.com as a
   test tenant that has Pro or higher entitlements (so all features unlock)
2. Navigate to the page described in the caption
3. Capture the area described — usually a specific button, panel, or
   highlighted nav item. Crop tightly; readers should not have to hunt
   for what you're pointing at.
4. Save as `<filename>.png` in this folder
5. Redeploy the web app (`./infrastructure/scripts/deploy.sh web`) — the
   placeholder will swap to your image automatically

## Inventory (65 screenshots across 18 articles)

Generated 2026-05-02. Run `grep -h "filename:" apps/web/src/lib/helpContent.ts | sort -u`
to regenerate this list any time articles change.

### Getting Started — First-Time Setup Checklist
- `nav-business-dna.png` — Sidebar 'Business DNA' link highlighted, in the Configure section
- `nav-prompts.png` — Sidebar 'Prompts' link highlighted, in the Configure section
- `nav-channels.png` — Sidebar 'Channels' link highlighted; channels page showing the Widget toggle in the off position
- `nav-agent-studio.png` — Sidebar 'Agent Studio' link, plus the Agent Studio page with the 'Start Test' button visible
- `channels-widget-embed-snippet.png` — Channels page with the Widget card expanded and the 'Copy Embed Code' button visible

### Dashboard
- `dashboard-overview.png` — Full dashboard view showing the Conversations count, channel status, and active agents widgets
- `dashboard-period-selector.png` — Top-right of the dashboard stats area showing the period selector dropdown (Today / Last 7 / 30 / This Month)

### Business DNA Editor
- `dna-editor-tabs.png` — Business DNA editor with the section tabs along the top (Identity, Services, Pricing, Hours, Rules, Escalation, Compliance, Language)
- `dna-identity-section.png` — DNA editor with Identity tab active, showing the business name, tagline, industry, and description fields
- `dna-services-section.png` — DNA editor Services tab with multiple service rows
- `dna-hours-section.png` — DNA editor Hours tab showing per-day-of-week hour rows and the timezone dropdown
- `dna-save-draft-button.png` — Bottom-right of the DNA editor showing the 'Save Draft' button
- `dna-publish-button.png` — Bottom-right of the DNA editor showing the teal 'Publish' button next to 'Save Draft'
- `dna-publish-confirm-dialog.png` — Modal dialog asking 'Publish this version of Business DNA?' with confirm/cancel buttons

### Prompts
- `prompts-new-button.png` — Prompts page top-right with the '+ New Prompt' button
- `prompts-scope-dropdown.png` — Prompt creation modal with the Scope dropdown open showing Master/Widget/Inbound/Outbound/Role options
- `prompts-history-tab.png` — Prompt detail view with the 'History' tab selected
- `prompts-restore-version-button.png` — A historical prompt version with the 'Restore this version' button visible

### Agents
- `agents-page-grid.png` — Agents page showing the 7 role cards (Orchestrator, Appointment, Sales, Customer Service, Marketing, Assistant, Secretary)
- `agents-enable-toggle.png` — Agent role card expanded with the 'Enabled' toggle in the top-right
- `agents-prompt-dropdown.png` — Agent role configuration showing the 'Role Prompt' dropdown
- `agents-save-button.png` — Bottom of agent role card showing the Save button

### Agent Studio
- `studio-channel-tabs.png` — Agent Studio top with the three channel tabs (Widget / Inbound / Outbound), Widget tab active
- `studio-avatar-grid.png` — Widget tab showing the female/male avatar selection grid
- `studio-voice-dropdown.png` — Widget tab voice picker dropdown open, listing the 7 voices
- `studio-start-test-button.png` — Agent Studio with the 'Start Test' button highlighted
- `studio-mic-controls.png` — Active test session showing Speak / Stop mic / End buttons with the live waveform indicator
- `studio-save-settings-button.png` — Widget tab bottom showing the 'Save Settings' button

### Channels — Widget
- `channels-widget-enable-toggle.png` — Channels page Widget card with the 'Enable Widget' toggle
- `channels-widget-position-dropdown.png` — Widget configuration showing the position dropdown
- `channels-widget-color-picker.png` — Widget configuration showing the color picker / hex input field
- `channels-widget-copy-embed.png` — Widget configuration with the 'Copy Embed Code' button at the bottom

### Channels — Inbound
- `channels-inbound-enable.png` — Channels page Inbound Receptionist card with the 'Enable' toggle
- `channels-inbound-greeting-field.png` — Inbound configuration with the greeting text field
- `channels-inbound-after-hours.png` — Inbound configuration showing the after-hours behavior options
- `channels-inbound-forwarding-number.png` — Inbound configuration showing the forwarding-number field
- `twilio-console-voice-webhook.png` — Twilio Console phone number configuration showing the 'A call comes in' webhook URL field

### Channels — Outbound
- `channels-outbound-enable.png` — Channels page Outbound Caller card with the 'Enable' toggle
- `channels-outbound-caller-id.png` — Outbound configuration showing the caller-ID dropdown listing available Twilio numbers
- `channels-outbound-retry-policy.png` — Outbound configuration showing retry count and retry-interval fields

### Integrations — Google
- `integrations-google-connect-button.png` — Integrations page Google card showing the 'Connect Google' button (NOT_CONNECTED state)
- `google-oauth-permissions-screen.png` — Google's OAuth consent screen showing the requested scopes
- `integrations-google-connected-state.png` — Integrations page Google card now in the CONNECTED state, showing email + calendar count
- `integrations-google-calendar-picker.png` — Google card showing the calendar dropdown listing available calendars

### Integrations — Twilio
- `twilio-console-account-credentials.png` — Twilio Console main dashboard showing where Account SID and Auth Token are displayed
- `integrations-twilio-credentials-form.png` — OrbisVoice Integrations page Twilio card with input fields
- `phone-numbers-add-modal.png` — Phone Numbers page with the '+ Add number' modal open
- `twilio-console-phone-number-config.png` — Twilio Console > Phone Numbers > Manage > active number with the Voice webhook URL field

### Twilio Console deep links
- `twilio-trust-hub-customer-profiles.png` — Twilio Console Trust Hub > Customer Profiles page
- `twilio-a2p-brand-registration.png` — Twilio Console A2P 10DLC Brands page
- `twilio-a2p-campaign-registration.png` — Twilio Console A2P 10DLC Campaigns page

### Contacts
- `contacts-add-button.png` — Contacts page with the '+ Add Contact' button highlighted
- `contacts-add-form.png` — Contact creation modal with all input fields
- `contacts-import-csv-button.png` — Contacts page with the 'Import CSV' button
- `contacts-import-preview.png` — CSV import preview screen showing the first 5 rows mapped to the right columns
- `contacts-tag-filter.png` — Contacts page filter bar showing tag chips and the search input

### Campaigns
- `campaigns-new-button.png` — Campaigns page with the '+ New Campaign' button
- `campaigns-goal-type-selector.png` — Campaign creation step showing goal type radio options
- `campaigns-contact-filter.png` — Campaign creation showing contact selection options with the live count display
- `campaigns-brief-textarea.png` — Campaign creation showing the 'Script Brief' textarea
- `campaigns-schedule-options.png` — Campaign scheduling section with all timing options
- `campaigns-launch-button.png` — Campaign review page with the 'Launch Campaign' button
- `campaigns-running-stats.png` — Active campaign view showing real-time stats

### Conversations
- `conversations-list-with-filters.png` — Conversations page showing the list, search bar, and filter controls
- `conversations-detail-transcript.png` — Conversation detail view with the Transcript tab
- `conversations-detail-audio-player.png` — Conversation detail view showing the audio player

### Billing
- `billing-current-plan-card.png` — Billing page top showing the current plan card
- `billing-plan-comparison.png` — Billing page plan comparison table with all 6 tiers and 'Upgrade' buttons
- `stripe-checkout-page.png` — Stripe-hosted checkout page after clicking Upgrade
- `billing-manage-billing-button.png` — Billing page showing the 'Manage Billing' button

### Settings
- `settings-workspace-fields.png` — Settings page Workspace section with all fields
- `settings-security-password.png` — Settings page Security section with password change fields
