/**
 * Partner-portal help content. Mirrors the shape of helpContent.ts (tenant
 * help) so the partner help page can reuse the same renderer. Articles cover
 * the partner experience end-to-end: signup → activate page → share links →
 * convert visitors → get paid.
 *
 * Each article carries:
 *   - lastUpdated   ISO date the article was reviewed against the live code
 *   - sourcePaths   directory names under apps/web/src/app/(partner-portal)/
 *                   partner-portal/(portal)/ that the article documents
 *
 * The `pnpm partner-help:audit` script reads `git log` on each `sourcePaths`
 * directory and flags any article whose `lastUpdated` is older than the most
 * recent code change. Use that report to keep this file in sync with the
 * product.
 */
import type { HelpSection } from './helpContent'

export const PARTNER_HELP_CONTENT: HelpSection[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: 'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 4v4m0 2.5v.5',
    articles: [
      {
        id: 'gs-overview',
        title: 'What the Partner Portal does',
        summary: 'The Partner Portal is your home for everything you need to refer customers, get paid, and run your own outreach with the tools we hand you.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['dashboard', 'landing-page'],
        steps: [
          { title: 'Refer customers, earn commissions', body: 'When someone signs up via your referral link or activates an account through one of your landing pages, you earn commission on every plan they purchase. Commissions accrue automatically — there is no invoicing or chasing involved.', screenshots: [{ filename: 'partner-dashboard-overview.png', caption: 'Partner Dashboard — shows Get Paid checklist, commissions summary, and quick links to landing pages and referral tools.', capture: { url: '/partner-portal/dashboard', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Four ways to acquire prospects', body: '(1) Referral Links — drop them in email signatures, social posts, business cards. (2) Personalized Landing Pages — /p/<your-slug>/voice-{1,2,3}/ with Orby embedded so prospects can talk to the agent right there. (3) Public Booking Page — /book/<your-slug> for prospects who prefer to type and pick a time over having a call. (4) Your own Phone Number — buy one through the portal, route inbound calls to your agent (G.2 — SMS sending decoupled into credit packs).' },
          { title: 'Run outreach with portal tools', body: 'Inside the portal you also get: CRM with a kanban pipeline + per-stage automations, a partner Mailbox (inbox / sent / compose / templates), bulk Email Campaigns with suppression-list reputation, and a Marketing Kit with swipe copy and assets you can lift.' },
          { title: 'Where the money flows', body: 'When a referred customer pays, your commission moves through PENDING → APPROVED → PAID. The 30-day holdback protects against refunds; the monthly-5th payout deposits APPROVED commissions into the bank account on file via Stripe Connect.' },
        ],
        tips: [
          'Activate your partner page in Profile to unlock per-partner landing-page URLs (otherwise prospects see the demo "sample" preview).',
          'Connect Stripe Connect early — the Get Paid checklist on your Dashboard walks you through it in two clicks.',
          'New 2026-05-14: SMS sending uses prepaid credits (separate from your phone-number subscription). See Phone Numbers → SMS Credits.',
        ],
      },
      {
        id: 'gs-first-day',
        title: 'Your first day — the 5-minute setup',
        summary: 'The fastest path to active referrals: fill profile, activate page, connect Stripe, share your first link.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['profile', 'dashboard', 'landing-page'],
        steps: [
          { title: '1. Fill out your profile', body: 'Go to Profile → upload an avatar (PNG / JPEG / WebP), add your bio, phone, mailing address, and email signature. Your name + photo + business name appear on every landing page and email signature prospects see, so this is the single highest-leverage thing you can do.' },
          { title: '2. Activate your partner page', body: 'In Profile → check "Partner page active" → Save. This unlocks /p/<your-slug>/voice-{1,2,3}/ — three personalized landing pages built around you. Each one has a different selling angle so you can pick which resonates with the audience you are messaging.', screenshots: [{ filename: 'partner-profile-marketing-section.png', caption: 'Profile page — Marketing section with "Partner page active" toggle, slug display, and landing page preview.', capture: { url: '/partner-portal/profile', selector: 'main', authAs: 'tenant' } }] },
          { title: '3. Connect Stripe Connect', body: 'On the Dashboard, click "Set up payouts" in the Get Paid checklist. Stripe walks you through verification (~5 minutes if you have your tax ID handy). When you are done, both "Payout method connected" and "Tax form submitted" flip to green and your commissions can flow.' },
          { title: '4. Share your first link', body: 'Open the Landing Pages tab. Pick the variation that fits your audience (The Story, The Audit, The Team Member). Click "Copy link" and paste it into an email, DM, or LinkedIn post. Every prospect who opens the link gets your personalized version — your name, your photo, your contact info.' },
        ],
        tips: [
          'Your slug is permanent. Pick well — it shows up in URLs and emails forever.',
          'Profile changes (name, photo, phone, address) re-publish your landing pages automatically within ~10 seconds. No need to ask support.',
        ],
      },
    ],
  },
  {
    id: 'landing-pages',
    label: 'Landing Pages',
    icon: 'M3 5h18v14H3zM3 9h18M7 5v14',
    articles: [
      {
        id: 'lp-variations',
        title: 'Picking the right landing-page variation',
        summary: 'Each of your three landing pages tells a different story. Pick the one that matches the prospect you are messaging.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['landing-page'],
        steps: [
          { title: 'V1 — The Story', body: 'Narrative angle. Walks prospects through a missed-call scene they have lived (phone rings, no one answers, business lost), then shows the version where MyOrbisVoice picks up. Best for service businesses: HVAC, plumbing, dental, legal. Higher emotional engagement than the audit page.' },
          { title: 'V2 — The Audit', body: 'Quantified angle. A 60-second calculator that shows how much the prospect is losing to missed calls in dollars per month. Best for owners who respond to numbers more than narratives — franchises, multi-location brands, high-ticket service operators.' },
          { title: 'V3 — The Team Member', body: 'Positions MyOrbisVoice as the receptionist + sales assistant + scheduler the prospect always wanted but could not afford. Best for small teams, solopreneurs, and growing practices.' },
          { title: 'How to use this in practice', body: 'If you are sending an email to a single prospect, pick one variation that matches what you know about their business. If you are running a campaign across a list, A/B test two variations on different segments and keep the one that converts better.' },
        ],
        tips: [
          'Every landing page has Orby\'s voice widget embedded. Prospects can have a real conversation with the agent before they book.',
          'Every page also links to your /book/<slug> public booking page for prospects who prefer typing.',
        ],
      },
      {
        id: 'lp-activation',
        title: 'Activating your landing pages',
        summary: 'Until your partner page is active, prospects see a generic demo. Activate it to switch them to your personalized version.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['profile', 'landing-page'],
        steps: [
          { title: 'Open Profile', body: 'Go to /partner-portal/profile and scroll to the Marketing section.' },
          { title: 'Toggle "Partner page active"', body: 'Flip the checkbox to ON. Save. Within ~10 seconds, your three personalized landing pages publish to https://myorbisvoice.com/p/<your-slug>/voice-1/, /voice-2/, /voice-3/, and the Spanish mirrors at /es/p/<your-slug>/.' },
          { title: 'Verify the publish', body: 'Open one of those URLs in a new tab. You should see your name + photo + contact info, not Alex Rivera (the demo partner). If the page does not show your data, wait 30 seconds and refresh — the auto-publish is asynchronous.', screenshots: [{ filename: 'partner-landing-pages-tab.png', caption: 'Landing Pages tab — three variations (The Story, The Audit, The Team Member) with copy link buttons.', capture: { url: '/partner-portal/landing-page', selector: 'main', authAs: 'tenant' } }] },
        ],
        tips: [
          'When your page is inactive, the Landing Pages tab in your portal shows the demo page as a preview so you can still see what the variations look like.',
          'Toggling the switch OFF does not delete your pages from the marketing site — they stay live with their last-published content until you toggle ON again and re-save.',
        ],
      },
    ],
  },
  {
    id: 'public-booking',
    label: 'Public Booking Page',
    icon: 'M3 9h18M3 5h18v14H3zM8 3v4M16 3v4',
    articles: [
      {
        id: 'pb-what-it-is',
        title: 'How your public booking page works',
        summary: 'A type-not-talk surface for prospects who do not want a voice conversation. They pick a date, pick a slot, fill in a form — and the appointment lands directly on your calendar.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['profile'],
        steps: [
          { title: 'The URL', body: 'Your public booking page lives at https://app.myorbisvoice.com/book/<your-slug>. The link is shown on your Dashboard with Copy + Open buttons.' },
          { title: 'What prospects see', body: 'A Google-Calendar-style layout — left rail mini-month calendar, right-side 7-day grid with day headers + time pills. The "Business Hours" block above shows your slot length, the calendar-invite line, your full weekly hours table (each open day with its open/close + break window), and your notice + advance limits (e.g. "60-min notice required · Book up to 60 days ahead").', screenshots: [{ filename: 'partner-public-booking-page.png', caption: 'Public booking page — mini-month calendar, 7-day slot grid, business hours block, and time pills.', capture: { url: '/book/e2e.capture', authAs: 'tenant' } }] },
          { title: 'How slots are filtered', body: 'Slots respect every setting from Profile → Booking Preferences: open/close per day, optional lunch/break window, slot length, minimum notice, max advance, buffer before/after each existing appointment. Slots snap to :00 / :30 boundaries in your business timezone.' },
          { title: 'Where the booking lands', body: 'Every booking creates a Contact + Conversation + Appointment in the platform, all tagged with your partnerId. The appointment shows on YOUR Google Calendar (not the platform tenant\'s). Reminders fire per your reminder preferences. The visitor gets a Google Calendar invite + a confirmation email.' },
        ],
        tips: [
          'You can preview your own page — visiting /book/<your-slug> as the partner shows you exactly what prospects see.',
          'The page is bilingual. Visitors with browsers set to Spanish see the Spanish version automatically.',
          'Set a lunch break with the "Apply to all open days" shortcut in Booking Preferences — pills for that hour disappear instantly on the public page.',
        ],
      },
      {
        id: 'pb-booking-preferences',
        title: 'Editing your booking preferences',
        summary: 'Working hours, lunch break, slot length, notice + advance limits, buffer minutes, and timezone. All of it controls what prospects see on your public booking page.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['profile'],
        steps: [
          { title: 'Where to find it', body: 'Profile → Booking Preferences section.' },
          { title: 'Set working hours per day', body: 'Tick "Open" on each day that should accept bookings. Enter the open + close times. Days without "Open" ticked are dimmed on the customer page and never offered as slots.' },
          { title: 'Add a lunch / break window', body: 'Per-day: click "+ break" next to that day\'s close time to insert a Break From / Break To range — slots overlapping that range are hidden. Bulk: use the "Lunch break, all open days [12:00] to [13:00] [Apply to all open days]" row at the top to copy one break window to every open day.' },
          { title: 'Tune slot length + limits', body: 'Slot length sets the default appointment duration. Minimum notice (in minutes) hides any slot starting sooner than that from now. Maximum advance (in days) caps how far out prospects can book. Buffer before / after (in minutes) pads existing calendar events on both sides so back-to-back bookings get breathing room.', screenshots: [{ filename: 'partner-profile-booking-preferences.png', caption: 'Profile → Booking Preferences — weekly hours table, lunch break options, slot length, notice/advance limits.', capture: { url: '/partner-portal/profile', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Set the booking timezone', body: 'The IANA zone (e.g. America/New_York) is what your "09:00" labels mean. Falls back to your account timezone if unset.' },
        ],
        tips: [
          'Closed days are skipped by the bulk-apply break shortcut. They are not silently overwritten.',
          'Save Booking Preferences before testing — the customer page reads from the saved record, not your unsaved edits.',
        ],
      },
    ],
  },
  {
    id: 'phone-numbers',
    label: 'Phone Numbers & SMS',
    icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
    articles: [
      {
        id: 'pn-buying-numbers',
        title: 'Buying a partner phone number',
        summary: 'Search Twilio inventory, pick a local or toll-free number, click Request — the number is bought, moved to your subaccount, and your monthly subscription starts immediately. No admin approval required.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['phone-numbers'],
        steps: [
          {
            title: 'Add a card on file',
            body:  'Phone Numbers page → top banner → "Add card". Stripe Checkout (hosted, no card data touches our servers) saves the card. You can\'t buy a number without one on file — the first month\'s charge runs immediately at request time.',
            screenshots: [
              {
                filename: 'partner-phone-numbers-card-banner.png',
                caption:  'Top of the Phone Numbers page — red "No card on file" banner with the Add card button on the right. Once a card is saved the banner turns green with the brand + last 4.',
                capture:  {
                  url:      '/partner-portal/phone-numbers',
                  selector: 'main',
                  authAs:   'tenant',
                  fullPage: false,
                },
              },
            ],
          },
          {
            title: 'Pick a tier',
            body:  '"Buy a new number" → tier picker: Voice (local, $2/mo) or Toll-free ($5/mo). SMS sending is sold separately as credit packs (next article).',
            screenshots: [
              {
                filename: 'partner-phone-numbers-tier-picker.png',
                caption:  'Search panel expanded — Voice $2/mo and Toll-free $5/mo tiles side-by-side. The Voice tile is highlighted by default.',
                capture:  {
                  url:      '/partner-portal/phone-numbers',
                  selector: '[data-testid="search-panel"]',
                  setup:    [
                    { action: 'click', selector: '[data-testid="buy-new-toggle"]' },
                    { action: 'wait',  selector: '[data-testid="search-panel"]' },
                    { action: 'wait',  ms: 300 },
                  ],
                  authAs: 'tenant',
                },
              },
            ],
          },
          {
            title: 'Search by area code',
            body:  'Enter an area code (212, 415, 800, 833, …) and click Search. Available numbers from Twilio inventory show up — click "Request this number".',
            screenshots: [
              {
                filename: 'partner-phone-numbers-area-search.png',
                caption:  'Area code field with "212" entered + list of 3-5 Twilio-available numbers. Each row shows the friendly number, locality, and a "Request this number" button.',
                capture:  {
                  url:    '/partner-portal/phone-numbers',
                  setup:  [
                    { action: 'click', selector: '[data-testid="buy-new-toggle"]' },
                    { action: 'type',  selector: '[data-testid="area-code"]', value: '212' },
                    { action: 'click', selector: '[data-testid="search-go"]' },
                    { action: 'wait',  ms: 1500 },
                  ],
                  authAs: 'tenant',
                },
              },
            ],
          },
          {
            title: 'Auto-purchase + Stripe charge',
            body:  'On click the platform runs the full purchase flow inline: number is bought from Twilio, moved to your subaccount, and a Stripe Subscription is created. The first month\'s charge runs immediately. If your card fails or the number is no longer available, the Twilio purchase rolls back and your row lands in REJECTED with the reason inline — pick another number and try again.',
            screenshots: [
              {
                filename: 'partner-phone-numbers-purchased-row.png',
                caption:  'Active Numbers table — a freshly purchased number showing in green Active status with monthly price $2.00/mo and the Cancel action on the right.',
                capture:  {
                  url:      '/partner-portal/phone-numbers',
                  selector: '[data-testid="active-numbers-table"]',
                  authAs:   'tenant',
                  fullPage: false,
                },
              },
            ],
          },
          {
            title: 'Admin can disable',
            body:  'Admin keeps oversight: any partner number can be disabled by admin from the Number Requests page (cancels your Stripe Subscription and releases the number on period end). Used only for policy / abuse cases — not part of normal purchase flow.',
            screenshots: [
              {
                filename: 'admin-number-requests-purchased-disable.png',
                caption:  'Admin → Number Requests page, PURCHASED tab. Each row shows the partner, number, tier, monthly price, and a red Disable button in the Actions column. Clicking opens a reason-required modal.',
                capture:  {
                  url:    '/admin/number-requests',
                  setup:  [
                    { action: 'click', selector: '[data-testid="status-tab-PURCHASED"]' },
                    { action: 'wait',  ms: 400 },
                  ],
                  authAs: 'admin',
                },
              },
            ],
          },
        ],
        tips: [
          'You can cancel a number\'s subscription yourself anytime from the Actions column → Cancel. The subscription stops at the end of the current period and the number is released to Twilio.',
          'Numbers in REJECTED status carry the rejection reason inline (e.g. "card declined", "number no longer available"). Re-pick a different number or fix your card and try again.',
        ],
      },
      {
        id: 'pn-sms-credits',
        title: 'Buying SMS / MMS credits',
        summary: 'SMS sending is prepaid credits, not a monthly subscription. Buy a pack once, credits roll over forever, 1 credit = 1 SMS segment.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['phone-numbers'],
        steps: [
          { title: 'Why credits, not a flat fee', body: 'Most partners send little SMS; a few send a lot. Prepaid credits keep small senders cheap ($5 / mo at most if you buy one pack a quarter) and big senders linear (buy more packs as you scale). Credits never expire.' },
          { title: 'Pick a pack', body: 'On the Phone Numbers page → SMS / MMS Credits card. $5 pack = 500 credits, $10 pack = 1,200 credits. The pricing table shows what those credits translate to per channel (SMS, long SMS, MMS).', screenshots: [{ filename: 'partner-sms-credits-card.png', caption: 'Phone Numbers page — SMS / MMS Credits card showing current balance, $5/$10 pack options, and purchase button.', capture: { url: '/partner-portal/phone-numbers', selector: 'main', authAs: 'tenant' } }, { filename: 'partner-sms-credits-ledger.png', caption: 'Credit ledger modal — shows grant, deduct, and refund entries with timestamps and amounts.', capture: { url: '/partner-portal/phone-numbers', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Channel cost', body: '1 credit = 1 standard SMS segment (up to 160 chars). 2 credits = long SMS (161+ chars, splits to 2 segments). 2.5 credits = MMS (with media). WhatsApp pricing is TBD — the tile shows "Coming soon" until pricing finalizes.' },
          { title: 'How deduction works', body: 'When your agent (or you) sends a partner-routed message, credits deduct BEFORE the message hits Twilio. If you don\'t have enough credits the send fails with 402 INSUFFICIENT_CREDITS. If the provider then fails to deliver, the credits are refunded automatically.' },
        ],
        tips: [
          'Balance under 50 credits highlights red on the card — buy another pack to keep automated reminders + campaigns from stalling.',
          'Inbound messages do not cost credits. Only outbound sends deduct.',
          'Every grant + deduct + refund is logged in the credit ledger (visible in the Phone Numbers credit card → details).',
        ],
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM Pipeline',
    icon: 'M3 6h18M3 12h18M3 18h18',
    articles: [
      {
        id: 'crm-pipeline',
        title: 'Working the partner CRM',
        summary: 'A kanban pipeline of every contact captured from your landing pages, public booking page, or manual add. Drag cards to move stages; the platform records every transition.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['crm', 'contacts'],
        steps: [
          { title: 'Where contacts come from', body: 'Three sources: (1) Conversations on your landing pages auto-create a Contact when the visitor shares name / email / phone; (2) Public booking page submissions create a Contact at booking time; (3) Manual add via the Contacts tab.' },
          { title: 'The kanban', body: 'CRM tab → kanban board with your stages as columns. Each card shows contact name, last activity, and source tag. Drag a card horizontally to move stages; the change is saved instantly.', screenshots: [{ filename: 'partner-crm-kanban.png', caption: 'CRM tab — kanban board with stage columns, contact cards showing name/source, and drag interaction.', capture: { url: '/partner-portal/crm', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Customize stages', body: 'CRM → Manage stages. Rename, recolor, reorder, add new stages. Won + Lost are reserved terminal stages — they cannot be deleted but you can rename their labels.' },
          { title: 'Auto-transitions', body: 'Booked appointment → stage flips forward automatically. Marked LOST in your conversation outcome → stage flips to Lost. You can override either by dragging.', screenshots: [{ filename: 'partner-crm-contact-detail.png', caption: 'Contact detail page — conversation history timeline, notes, and email/SMS compose buttons.', capture: { url: '/partner-portal/contacts', selector: 'main', authAs: 'tenant' } }] },
        ],
        tips: [
          'Click any card to open the contact detail page with the full conversation history, notes timeline, and one-click email + SMS compose buttons.',
          'Filter by source tag to see only landing-page leads, only public-booking leads, or only manual adds.',
        ],
      },
    ],
  },
  {
    id: 'mailbox',
    label: 'Mailbox',
    icon: 'M3 8l9 6 9-6M3 8v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2',
    articles: [
      {
        id: 'mb-overview',
        title: 'Using the partner Mailbox',
        summary: 'Send + receive email from your <slug>@myorbisresults.com alias. Inbox, Sent, Compose, Templates, threaded conversation view, search — all in one tab.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['mailbox'],
        steps: [
          { title: 'Your sending address', body: 'When you signed up, the platform assigned you <firstname>.<lastname>@myorbisresults.com. Every email sent from the Mailbox uses that address as the From header, plus your auto-generated signature footer.' },
          { title: 'Compose', body: 'Compose tab → To / Subject / Rich-text body. Templates dropdown loads any template you saved earlier with variables ({firstName}, {businessName}, {appointmentDate}). Variables are substituted from the contact you select.', screenshots: [{ filename: 'partner-mailbox-compose.png', caption: 'Compose view — To/Subject fields, rich-text body, templates dropdown, and contact selector.', capture: { url: '/partner-portal/mailbox', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Threading', body: 'Replies from the recipient land back in Inbox grouped by thread. The conversation view shows every message in the thread in chronological order, with quote-collapse on long quoted blocks.', screenshots: [{ filename: 'partner-mailbox-inbox.png', caption: 'Mailbox tab — inbox view with threaded conversations, sender info, and subject preview.', capture: { url: '/partner-portal/mailbox', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Search', body: 'Top-of-page search box matches subject, body, recipient, and contact name. Drops you into the first matching thread.' },
        ],
        tips: [
          'Auto-signature uses your Profile fields: avatar, name, business name, partner phone, and landing-page link. To customize, toggle "Use custom HTML instead" on the Profile signature card.',
          'Bulk campaigns are a separate surface — Mailbox is for 1:1 follow-up. See Campaigns for blast sends.',
        ],
      },
    ],
  },
  {
    id: 'campaigns',
    label: 'Email Campaigns',
    icon: 'M3 5h18v14H3zM3 9l9 6 9-6',
    articles: [
      {
        id: 'cp-bulk',
        title: 'Running a bulk email campaign',
        summary: 'Select a list, pick a template, schedule the send. The platform respects send-window timezone, suppression list, and reputation gates.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['campaigns'],
        steps: [
          { title: 'Pick recipients', body: 'Campaigns → New → choose a CRM stage or upload a CSV. Suppressed addresses (unsubscribes, bounces, complaints) are filtered automatically — they will not be sent to.' },
          { title: 'Pick a template', body: 'Saved templates with {firstName} / {businessName} / {appointmentDate} variables. Preview the rendered version against any recipient on the list before scheduling.' },
          { title: 'Schedule', body: 'Choose send-now or a future date / time. The platform respects your account-level send window (e.g. 9 AM – 6 PM in your timezone) and your per-partner email reputation policy set by admin.', screenshots: [{ filename: 'partner-campaign-builder.png', caption: 'Campaign builder — recipient selector, template picker, and schedule options.', capture: { url: '/partner-portal/campaigns', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Track results', body: 'Open rate, click rate, reply rate, bounce rate, unsubscribe rate. Bounces + unsubscribes automatically add to your suppression list — future sends skip them.', screenshots: [{ filename: 'partner-campaign-results.png', caption: 'Campaign results — open rate, click rate, bounce rate, unsubscribe rate metrics.', capture: { url: '/partner-portal/campaigns', selector: 'main', authAs: 'tenant' } }] },
        ],
        tips: [
          'CAN-SPAM footer (your mailing address from Profile) is auto-appended. Add your full address in Profile → Address fields before your first send.',
          'Hold on bulk sends if you don\'t have an ESP wired through admin; without one the platform falls back to a low-volume sending tier that throttles aggressively.',
        ],
      },
    ],
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    articles: [
      {
        id: 'cv-what-shows-up',
        title: 'What lands in your Conversations tab',
        summary: 'Every conversation Orby has on YOUR landing pages — with summary, transcript, and (when available) an audio recording.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['conversations'],
        steps: [
          { title: 'Source', body: 'When a prospect opens any of your landing pages and clicks "Talk to Orby" (or types into the public booking page chat), the conversation is tagged with your partnerId. That tag is what makes it appear here. Inbound phone calls to a tenant phone number do NOT appear here — those belong to the tenant.' },
          { title: 'What each row shows', body: 'Contact name (or "Anonymous caller" if they didn\'t share one), the outcome code (BOOKED / CALLBACK_REQUESTED / INFO_REQUEST / QUALIFIED_LEAD / MISSED_CALL), the channel, the timestamp, and a short preview of the AI summary. Click a row for the full detail.', screenshots: [{ filename: 'partner-conversations-list.png', caption: 'Conversations tab — list of conversation rows with contact name, outcome code, timestamp, and summary preview.', capture: { url: '/partner-portal/conversations', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Detail page', body: 'Full AI summary at the top. Audio player below it (when recording capture succeeded — depends on visitor\'s browser). Then any appointments the conversation produced. Then the full speaker-labeled transcript — "Caller" on the left, "Orby" on the right, every turn in chronological order.' },
          { title: 'CRM link-up', body: 'If the conversation produced a Contact (visitor shared name + email or phone), the contact is auto-created and appears in your CRM pipeline at the default starting stage. Manual adjustments from there.' },
        ],
        tips: [
          'The summary is regenerated when the session ends — you cannot edit it. Use it for fast skim; the transcript is the source of truth.',
          'Calls that ended without the visitor saying anything ("Anonymous, no transcript") still appear here so you can see widget-open events even when nothing was said.',
        ],
      },
    ],
  },
  {
    id: 'commissions-payouts',
    label: 'Getting Paid',
    icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    articles: [
      {
        id: 'cp-stripe-connect',
        title: 'Setting up Stripe Connect',
        summary: 'Stripe Connect Express handles your payouts + the IRS tax form (W-9 / W-8BEN) in one flow. Five minutes if you have your tax info ready.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['dashboard', 'commissions', 'payouts'],
        steps: [
          { title: 'Start onboarding', body: 'Dashboard → Get Paid checklist → "Set up payouts." This opens a Stripe-hosted onboarding flow. We never see your full tax info — Stripe is the only party that holds it.', screenshots: [{ filename: 'partner-dashboard-get-paid-checklist.png', caption: 'Dashboard — Get Paid checklist showing "Set up payouts" button and verification status items.', capture: { url: '/partner-portal/dashboard', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Fill out the form', body: 'You will need: legal name, date of birth, last 4 of SSN (US individuals) or EIN (LLC / Corp), your bank account routing + account number (for direct deposit), and an email address Stripe can verify.' },
          { title: 'Wait for verification', body: 'Stripe verifies your identity and bank account in ~1 business day. While that is pending, the checklist shows yellow. Once green, your "Payout method connected" + "Tax form submitted" both flip on and your APPROVED commissions become payout-eligible.', screenshots: [{ filename: 'partner-commissions-page.png', caption: 'Commissions page — PENDING/APPROVED/PAID tabs with commission amounts and dates.', capture: { url: '/partner-portal/commissions', selector: 'main', authAs: 'tenant' } }] },
        ],
        tips: [
          'You can return to the Stripe-hosted flow anytime via the "Continue setup" link on the Dashboard if you exit mid-flow.',
          'International partners: select your country in the dropdown; Stripe asks for the equivalent local tax + banking info (W-8BEN for non-US).',
          'Stripe prefills business name + mailing address from your Profile — fill those in first to cut the Stripe form to half the time.',
        ],
      },
      {
        id: 'cp-commission-states',
        title: 'How commissions move through states',
        summary: 'PENDING → APPROVED → PAID. The two transitions are automated; the timing is set by platform policy.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['commissions', 'payouts'],
        steps: [
          { title: 'PENDING', body: 'A referred customer just paid. The commission is logged but held during the 30-day refund window. If the customer cancels their subscription or charges back inside this window, the commission flips to REVERSED instead and never pays out.' },
          { title: 'APPROVED', body: '30 days after the underlying payment, the commission auto-flips to APPROVED. It now shows up in your "available to pay out" total on the Dashboard and is queued for the next monthly payout run.' },
          { title: 'PAID', body: 'Monthly on the 5th, the scheduler runs the payout job: every APPROVED commission gets bundled into a single Stripe payout to your connected bank account. The commission rows flip to PAID and you can see the Stripe transfer ID on the Payouts page.' },
        ],
        tips: [
          'There is a minimum payout threshold ($50 by default). Smaller balances roll over to the next month.',
          'You can request an early payout via the Payouts page if your balance is over the minimum and the 30-day hold has cleared for the relevant commissions.',
        ],
      },
    ],
  },
  {
    id: 'reminders-and-calendar',
    label: 'Reminders & Calendar',
    icon: 'M3 5h18v14H3zM3 9h18M7 5v14',
    articles: [
      {
        id: 'rc-reminders',
        title: 'Configuring your reminder preferences',
        summary: 'You control when Orby reminds your prospects about their bookings. Default is 24h + 1h before, email + SMS.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['profile'],
        steps: [
          { title: 'Where to set this', body: 'Profile → Reminders section. The toggle at the top is the master switch — OFF means no automatic reminders fire for bookings on your calendar.', screenshots: [{ filename: 'partner-profile-reminders-section.png', caption: 'Profile → Reminders section — master toggle, offset chips, and email/SMS channel toggles.', capture: { url: '/partner-portal/profile', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Picking offsets', body: 'Pick one or more times from the preset chips (1 week → 15 min). Each selected chip is a separate reminder that fires that many minutes before the appointment start. If a chip\'s fire-time is already in the past when the booking is made, that reminder is skipped silently — no embarrassing "your appointment was 10 minutes ago!" texts.' },
          { title: 'Picking channels', body: 'Email + SMS are independent toggles. Both ON = the prospect gets both. The visitor needs an email on file for email reminders, and a phone for SMS — partial data is fine, we just skip the channel that has no destination. NOTE: SMS reminders deduct partner SMS credits per send.' },
          { title: 'Cancel + reschedule cascade', body: 'If you cancel an appointment, all pending reminders for it auto-cancel — no stale messages. If you reschedule, the reminders re-arm against the new time, including reminders that already fired for the OLD time (they re-fire for the new one if still in the future).' },
        ],
        tips: [
          'These preferences only apply to PARTNER-routed bookings — visitors who book on your landing pages or your public booking page. Tenant-level bookings continue to use the platform default.',
          'If you turn reminders OFF, the Google Calendar invite still arrives via Google itself. Only the platform-side email + SMS reminders are suppressed.',
          'Low on SMS credits? Disable the SMS toggle to send email-only reminders without burning credits.',
        ],
      },
      {
        id: 'rc-google-calendar',
        title: 'Connecting Google Calendar',
        summary: 'Your partner page books real appointments on your real Google Calendar. The setup is one OAuth click.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['profile', 'calendar'],
        steps: [
          { title: 'Start the connection', body: 'Profile → Google Calendar section → click "Connect Google." This redirects to Google\'s OAuth consent screen.', screenshots: [{ filename: 'partner-profile-google-calendar-section.png', caption: 'Profile → Google Calendar section — Connect Google button, calendar selector, and disconnect option.', capture: { url: '/partner-portal/profile', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Grant calendar + email scopes', body: 'Approve calendar.readonly + calendar.events for booking creation, and gmail.send for sending appointment emails from your own Gmail. You can revoke either scope later from your Google account settings.' },
          { title: 'Pick your default calendar', body: 'After OAuth, you can pick which of your Google Calendars receives the bookings. The "primary" calendar is the safest default. If you have a dedicated work calendar, point bookings there.' },
          { title: 'View bookings in-portal', body: 'Calendar tab in the partner portal shows Day / Week / Month / Agenda views of every event on your connected calendar, with booked-by-Orby events badged so you can scan partner-routed bookings at a glance.', screenshots: [{ filename: 'partner-calendar-tab.png', caption: 'Calendar tab — Day/Week/Month/Agenda views with booked-by-Orby event badges.', capture: { url: '/partner-portal/calendar', selector: 'main', authAs: 'tenant' } }] },
        ],
        tips: [
          'If you ever switch Google accounts, click "Disconnect" first, then reconnect with the new account. The platform stores OAuth tokens per partner, not per Google account.',
          'Booking conflicts are checked against the connected calendar in real-time before each booking is confirmed — no double-booking even if you have a manual event already on the slot.',
        ],
      },
    ],
  },
  {
    id: 'marketing-tools',
    label: 'Marketing & Referral Tools',
    icon: 'M3 12h18M3 6h18M3 18h18',
    articles: [
      {
        id: 'mt-referral-links',
        title: 'Building + tracking referral links',
        summary: 'Custom referral links with your own UTM tags, click tracking, and conversion attribution back to your commission ledger.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['referrals'],
        steps: [
          { title: 'The basic link', body: 'Your referral link is myorbisvoice.com/?ref=<your-code>. Every signup that opens that link within the cookie window (30 days) is attributed to you.' },
          { title: 'Custom branded links', body: 'Referrals tab → Custom Links → New link. Add a campaign label (e.g. "LinkedIn Q2"), pick a destination page (home, pricing, /book), get back a short link like myorbisvoice.com/r/<code>. Useful for A/B comparing channels.', screenshots: [{ filename: 'partner-referrals-custom-links.png', caption: 'Referrals tab — custom links list with click stats, signups, and conversion rates.', capture: { url: '/partner-portal/referrals', selector: 'main', authAs: 'tenant' } }] },
          { title: 'Click tracking', body: 'Each link shows total clicks, unique clicks, signups, and conversion rate. Click on a link to see day-by-day breakdown for the last 30 days.' },
        ],
        tips: [
          'Cookie window is 30 days — visitors who come back through any of your links inside 30 days still attribute to you.',
          'The dashboard "Top performing link" widget surfaces the highest-converting branded link weekly.',
        ],
      },
      {
        id: 'mt-marketing-kit',
        title: 'Using the Marketing Kit',
        summary: 'Swipe copy, social-post templates, and partner-branded assets you can lift straight into outbound.',
        lastUpdated: '2026-05-14',
        sourcePaths: ['marketing-kit', 'market-vault'],
        steps: [
          { title: 'Email swipe copy', body: 'Marketing Kit → Email swipes. Five proven outreach templates with subject lines + body. Variables auto-personalize to your name + landing-page link.' },
          { title: 'Social posts', body: 'Pre-written X / LinkedIn / Facebook posts with quote graphics. Copy + paste, or download the graphic and post natively.' },
          { title: 'Market Vault', body: 'Long-form assets — case studies, sales decks, customer testimonials — that you can attach in email or share by link. Re-skinned with your name + photo on the cover slide.' },
        ],
        tips: [
          'All swipe copy is also available in Spanish on the Spanish toggle of the same page.',
        ],
      },
    ],
  },
]
