/**
 * Partner-portal help content. Mirrors the shape of helpContent.ts (tenant
 * help) so the partner help page can reuse the same renderer. Articles cover
 * the partner experience end-to-end: signup → activate page → share links →
 * convert visitors → get paid.
 *
 * Starter content — write articles short enough to skim, focused on the one
 * task each title promises. Expand as partner-support tickets surface new
 * questions; the index here is the source of truth for what's documented.
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
        summary: 'The Partner Portal is your home for everything you need to refer customers, get paid, and track your performance.',
        steps: [
          { title: 'Refer customers, earn commissions', body: 'When someone signs up via your referral link or activates an account through one of your landing pages, you earn commission on every plan they purchase. Commissions accrue automatically — there is no invoicing or chasing involved.' },
          { title: 'Three ways to refer', body: '(1) Your Referral Links — drop these anywhere (email signature, social posts, business cards). (2) Your Landing Pages — full marketing sites at /p/<your-slug>/voice-{1,2,3}/ that prospects can preview live and talk to Orby on. (3) Your Public Booking Page — a type-not-talk surface at /book/<your-slug> for prospects who would rather pick a time than have a call.' },
          { title: 'Where the money flows', body: 'When a referred customer pays, your commission moves through three states: PENDING (still in the refund window) → APPROVED (eligible for payout) → PAID (Stripe Connect deposit to your bank). The 30-day holdback protects against refunds; everything else is automatic.' },
        ],
        tips: [
          'Activate your partner page in Profile to unlock per-partner landing-page URLs (otherwise prospects see the demo "sample" preview).',
          'Connect Stripe Connect early — the Get Paid checklist on your Dashboard walks you through it in two clicks.',
        ],
      },
      {
        id: 'gs-first-day',
        title: 'Your first day — the 5-minute setup',
        summary: 'The fastest path to active referrals: fill profile, activate page, connect Stripe, share your first link.',
        steps: [
          { title: '1. Fill out your profile', body: 'Go to Profile → upload an avatar (PNG/JPEG/WebP), add your bio, phone, and email signature. Your name + photo appear on every landing page prospects see, so this is the single highest-leverage thing you can do.' },
          { title: '2. Activate your partner page', body: 'In Profile → check "Partner page active" → Save. This unlocks /p/<your-slug>/voice-{1,2,3}/ — three personalized landing pages built around you. Each one has a different selling angle so you can pick which resonates with the audience you are messaging.' },
          { title: '3. Connect Stripe Connect', body: 'On the Dashboard, click "Set up payouts" in the Get Paid checklist. Stripe walks you through verification (~5 minutes if you have your tax ID handy). When you are done, both "Payout method connected" and "Tax form submitted" flip to green and your commissions can flow.' },
          { title: '4. Share your first link', body: 'Open the Landing Pages tab. Pick the variation that fits your audience (The Story, The Audit, The Team Member). Click "Copy link" and paste it into an email, DM, or LinkedIn post. Every prospect who opens the link gets your personalized version — your name, your photo, your contact info.' },
        ],
        tips: [
          'Your slug is permanent. Pick well — it shows up in URLs and emails forever.',
          'Profile changes (name, photo, phone) re-publish your landing pages automatically within ~10 seconds. No need to ask support.',
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
        steps: [
          { title: 'Open Profile', body: 'Go to /partner-portal/profile and scroll to the Marketing section.' },
          { title: 'Toggle "Partner page active"', body: 'Flip the checkbox to ON. Save. Within ~10 seconds, your three personalized landing pages publish to https://myorbisvoice.com/p/<your-slug>/voice-1/, /voice-2/, /voice-3/, and the Spanish mirrors at /es/p/<your-slug>/.' },
          { title: 'Verify the publish', body: 'Open one of those URLs in a new tab. You should see your name + photo + contact info, not Alex Rivera (the demo partner). If the page does not show your data, wait 30 seconds and refresh — the auto-publish is asynchronous.' },
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
        steps: [
          { title: 'The URL', body: 'Your public booking page lives at https://app.myorbisvoice.com/book/<your-slug>. The link is shown on your Dashboard with Copy + Open buttons.' },
          { title: 'What prospects see', body: 'A clean page with your avatar, name, business name, and a 30-day date strip. Closed days (per your Booking Preferences) are dimmed. Picking a day reveals an availability grid that honors your working hours + slot length + minimum notice + max-advance lookahead. Picking a slot reveals a contact form. Submit → confirmation screen with the booking time read back.' },
          { title: 'Where it lands', body: 'Every booking creates a Contact + Conversation + Appointment in the platform, all tagged with your partnerId. The appointment shows on YOUR Google Calendar (not the platform tenant\'s). Reminders fire per your reminder preferences. The visitor gets a Google Calendar invite + a confirmation email.' },
        ],
        tips: [
          'You can preview your own page — visiting /book/<your-slug> as the partner shows you exactly what prospects see.',
          'The page is bilingual. Visitors with browsers set to Spanish see the Spanish version automatically.',
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
        steps: [
          { title: 'Source', body: 'When a prospect opens any of your landing pages and clicks "Talk to Orby" (or types into the public booking page chat), the conversation is tagged with your partnerId. That tag is what makes it appear here. Inbound phone calls to a tenant phone number do NOT appear here — those belong to the tenant.' },
          { title: 'What each row shows', body: 'Contact name (or "Anonymous caller" if they didn\'t share one), the outcome code (BOOKED / CALLBACK_REQUESTED / INFO_REQUEST / QUALIFIED_LEAD / MISSED_CALL), the channel, the timestamp, and a short preview of the AI summary. Click a row for the full detail.' },
          { title: 'Detail page', body: 'Full AI summary at the top. Audio player below it (when E.8 recording capture succeeded — depends on visitor\'s browser). Then any appointments the conversation produced. Then the full speaker-labeled transcript — "Caller" on the left, "Orby" on the right, every turn in chronological order.' },
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
        steps: [
          { title: 'Start onboarding', body: 'Dashboard → Get Paid checklist → "Set up payouts." This opens a Stripe-hosted onboarding flow. We never see your full tax info — Stripe is the only party that holds it.' },
          { title: 'Fill out the form', body: 'You will need: legal name, date of birth, last 4 of SSN (US individuals) or EIN (LLC/Corp), your bank account routing + account number (for direct deposit), and an email address Stripe can verify.' },
          { title: 'Wait for verification', body: 'Stripe verifies your identity and bank account in ~1 business day. While that\'s pending, the checklist shows yellow. Once green, your "Payout method connected" + "Tax form submitted" both flip on and your APPROVED commissions become payout-eligible.' },
        ],
        tips: [
          'You can return to the Stripe-hosted flow anytime via the "Continue setup" link on the Dashboard if you exit mid-flow.',
          'International partners: select your country in the dropdown; Stripe asks for the equivalent local tax + banking info (W-8BEN for non-US).',
        ],
      },
      {
        id: 'cp-commission-states',
        title: 'How commissions move through states',
        summary: 'PENDING → APPROVED → PAID. The two transitions are automated; the timing is set by platform policy.',
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
        steps: [
          { title: 'Where to set this', body: 'Profile → Reminders section. The toggle at the top is the master switch — OFF means no automatic reminders fire for bookings on your calendar.' },
          { title: 'Picking offsets', body: 'Pick one or more times from the preset chips (1 week → 15 min). Each selected chip is a separate reminder that fires that many minutes before the appointment start. If a chip\'s fire-time is already in the past when the booking is made, that reminder is skipped silently — no embarrassing "your appointment was 10 minutes ago!" texts.' },
          { title: 'Picking channels', body: 'Email + SMS are independent toggles. Both ON = the prospect gets both. The visitor needs an email on file for email reminders, and a phone for SMS — partial data is fine, we just skip the channel that has no destination.' },
          { title: 'Cancel + reschedule cascade', body: 'If you cancel an appointment, all pending reminders for it auto-cancel — no stale messages. If you reschedule, the reminders re-arm against the new time, including reminders that already fired for the OLD time (they re-fire for the new one if still in the future).' },
        ],
        tips: [
          'These preferences only apply to PARTNER-routed bookings — visitors who book on your landing pages or your public booking page. Tenant-level bookings continue to use the platform default.',
          'If you turn reminders OFF, the Google Calendar invite still arrives via Google itself. Only the platform-side email + SMS reminders are suppressed.',
        ],
      },
      {
        id: 'rc-google-calendar',
        title: 'Connecting Google Calendar',
        summary: 'Your partner page books real appointments on your real Google Calendar. The setup is one OAuth click.',
        steps: [
          { title: 'Start the connection', body: 'Profile → Google Calendar section → click "Connect Google." This redirects to Google\'s OAuth consent screen.' },
          { title: 'Grant calendar + email scopes', body: 'Approve calendar.readonly + calendar.events for booking creation, and gmail.send for sending appointment emails from your own Gmail. You can revoke either scope later from your Google account settings.' },
          { title: 'Pick your default calendar', body: 'After OAuth, you can pick which of your Google Calendars receives the bookings. The "primary" calendar is the safest default. If you have a dedicated work calendar, point bookings there.' },
        ],
        tips: [
          'If you ever switch Google accounts, click "Disconnect" first, then reconnect with the new account. The platform stores OAuth tokens per partner, not per Google account.',
          'Booking conflicts are checked against the connected calendar in real-time before each booking is confirmed — no double-booking even if you have a manual event already on the slot.',
        ],
      },
    ],
  },
]
