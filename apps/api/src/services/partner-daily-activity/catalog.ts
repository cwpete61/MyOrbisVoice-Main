/**
 * Daily Activity catalog for the partner playbook.
 *
 * Lives in code (not DB) — the catalog evolves with the playbook + needs
 * i18n. Tying it to a table forces a migration every time we add a coaching
 * activity.
 *
 * Slug format: `<section>.<sub>.<verb>` (e.g. `morning.cold_calls.10`).
 * Tier maps to UI badge color: CRITICAL (red) / HIGH (amber) / STANDARD
 * (green) / OPTIONAL (blue).
 *
 * `followUps` lists the auto-actions worker (or UI nudges) will fire when the
 * activity ticks. Not all are wired yet — referenced for future build.
 */

export type ActivityTier = 'CRITICAL' | 'HIGH' | 'STANDARD' | 'OPTIONAL'

export interface ActivityItem {
  /** Slug stored on PartnerDailyActivityProgress.activityKey. Immutable. */
  key: string
  /** Visible label in English. ES translation comes from i18n dictionary. */
  label: string
  /** Optional one-line hint shown under the checkbox. */
  hint?: string
}

export interface ActivitySubsection {
  key: string
  label: string
  /** Suggested minutes for this sub-block. */
  durationMin?: number
  items: ActivityItem[]
}

export interface ActivitySection {
  key: string
  label: string
  tier: ActivityTier
  /** Suggested total minutes for the section. */
  durationMin: number
  /** One-line "why" shown under the section title. */
  rationale: string
  subsections: ActivitySubsection[]
  /** Optional auto-actions to fire when section reaches 100% (Phase 2 build). */
  followUps?: string[]
}

export const DAILY_ACTIVITY_CATALOG: ActivitySection[] = [
  {
    key: 'morning',
    label: 'Morning Power Hour',
    tier: 'CRITICAL',
    durationMin: 90,
    rationale:
      'Prospects respond to outreach 2-3× more between 8-11am local time. Front-load the highest-value activity.',
    subsections: [
      {
        key: 'pipeline_triage',
        label: 'Pipeline triage',
        durationMin: 15,
        items: [
          { key: 'morning.triage.review_replies', label: "Review yesterday's responses + replies" },
          { key: 'morning.triage.check_notifications', label: 'Check overnight CRM notifications' },
          { key: 'morning.triage.top_3_deals', label: 'Identify today’s top 3 hot deals' },
          { key: 'morning.triage.move_stalled', label: 'Move stalled deals to next stage or nurture' },
        ],
      },
      {
        key: 'cold_blast',
        label: 'Cold outreach blast',
        durationMin: 60,
        items: [
          { key: 'morning.cold_calls.10', label: '10 cold phone calls', hint: 'Use Trifecta talk track' },
          { key: 'morning.cold_emails.10', label: '10 cold emails', hint: 'Use Marketing Kit templates' },
          { key: 'morning.linkedin_dms.5', label: '5 LinkedIn DMs', hint: 'Personalized openers only' },
          { key: 'morning.log_outcomes', label: 'Log every call outcome in CRM' },
        ],
      },
      {
        key: 'inbound',
        label: 'Inbound response',
        durationMin: 15,
        items: [
          { key: 'morning.inbound.reply_emails', label: 'Reply to all inbound emails within 1 hour' },
          { key: 'morning.inbound.return_calls', label: 'Return missed calls from yesterday/overnight' },
          { key: 'morning.inbound.confirm_demos', label: 'Confirm any pending demos scheduled today' },
        ],
      },
    ],
    followUps: [
      'Auto-queue tomorrow’s nurture touch for "no answer" outcomes',
      'Flag "call me back" responses for same-day callback',
    ],
  },
  {
    key: 'midday',
    label: 'Midday Outreach',
    tier: 'HIGH',
    durationMin: 60,
    rationale: 'Mid-day window — lunch-time prospects checking email + responses to morning sends.',
    subsections: [
      {
        key: 'gmb_audits',
        label: 'Run 3 GMB audits',
        items: [
          { key: 'midday.gmb.pull_3', label: 'Pull 3 fresh local businesses (different verticals)' },
          { key: 'midday.gmb.run_audit', label: 'Run GMB Evaluation on each' },
          { key: 'midday.gmb.send_pdf', label: 'Send branded PDF report with audit + Orby pitch' },
          { key: 'midday.gmb.tag_crm', label: 'Tag each in CRM with audit date' },
        ],
      },
      {
        key: 'trifecta_demos',
        label: 'Trifecta demo prep',
        items: [
          { key: 'midday.loom.record', label: 'Record 1 personalized Loom for a hot prospect (≤3 min)' },
          { key: 'midday.trifecta.send', label: 'Send Trifecta one-pager + Orby demo link to 2 warm leads' },
        ],
      },
      {
        key: 'quote_followup',
        label: 'Quote + proposal follow-up',
        items: [
          { key: 'midday.quote.followup_3d', label: 'Follow up on quotes sent >3 days ago' },
          { key: 'midday.quote.followup_7d', label: 'Push for decision on quotes sent >7 days ago' },
        ],
      },
    ],
  },
  {
    key: 'relationship',
    label: 'Relationship Building',
    tier: 'STANDARD',
    durationMin: 45,
    rationale: 'Compound growth. Skip a few days and you won’t notice; skip 90 and the pipeline empties.',
    subsections: [
      {
        key: 'linkedin',
        label: 'LinkedIn engagement',
        items: [
          { key: 'rel.linkedin.engage_10', label: 'Like + thoughtful-comment on 10 prospect posts' },
          { key: 'rel.linkedin.accept_5', label: 'Accept 5 new connection requests (qualify first)' },
          { key: 'rel.linkedin.post_1', label: 'Post 1 piece of content (testimonial / before-after / tip)' },
        ],
      },
      {
        key: 'referrals',
        label: 'Referral asks',
        items: [
          { key: 'rel.referrals.ask_2', label: 'Ask 2 existing customers for a referral' },
          { key: 'rel.referrals.thank_you', label: 'Send thank-you note to 1 recent customer' },
          { key: 'rel.referrals.reviews', label: 'Check if any reviews came in → respond' },
        ],
      },
      {
        key: 'visibility',
        label: 'Industry visibility',
        items: [
          { key: 'rel.visibility.fb_li_groups', label: 'Drop 1 valuable comment in 3 industry FB/LinkedIn groups' },
          { key: 'rel.visibility.forum', label: 'Reply to 1 forum/Reddit thread in your vertical' },
        ],
      },
    ],
  },
  {
    key: 'webinar',
    label: 'Webinar + Content Pipeline',
    tier: 'HIGH',
    durationMin: 30,
    rationale: 'Builds the invite database that fills your next webinar — recurring revenue engine.',
    subsections: [
      {
        key: 'webinar_db',
        label: 'Webinar invite database growth',
        items: [
          { key: 'webinar.db.add_5', label: 'Add 5+ qualified businesses to Webinar Marketing list' },
          { key: 'webinar.db.run_discovery', label: 'Run discovery on any new niche/location combo' },
          { key: 'webinar.db.approve_3', label: 'Review quarantine queue → approve 3+ qualified' },
          { key: 'webinar.db.reject', label: 'Reject anything that doesn’t pass smell test' },
        ],
      },
      {
        key: 'content',
        label: 'Content seeding',
        items: [
          { key: 'webinar.content.share_asset', label: 'Share 1 Marketing Kit asset on your social channels' },
          { key: 'webinar.content.case_study', label: 'Drop 1 case study link in your email signature' },
          { key: 'webinar.content.pin_testimonial', label: 'Pin a customer testimonial to your LinkedIn' },
        ],
      },
    ],
    followUps: [
      'Promoted contacts automatically eligible for next webinar invite send',
    ],
  },
  {
    key: 'crm_hygiene',
    label: 'CRM Hygiene',
    tier: 'STANDARD',
    durationMin: 15,
    rationale: 'Clean CRM = no leads slipping through cracks. 15 min/day beats 4 hours of cleanup on Friday.',
    subsections: [
      {
        key: 'crm',
        label: 'CRM tasks',
        items: [
          { key: 'crm.log_calls', label: 'Log all of today’s calls + outcomes' },
          { key: 'crm.tag_stages', label: 'Tag every prospect with current pipeline stage' },
          { key: 'crm.schedule_followups', label: 'Schedule tomorrow’s follow-ups (auto-suggest from CRM)' },
          { key: 'crm.note_objections', label: 'Note any objections heard for tomorrow’s prep' },
          { key: 'crm.update_commissions', label: 'Update commission tracker with closed deals' },
        ],
      },
    ],
  },
  {
    key: 'eod',
    label: 'End of Day Review',
    tier: 'CRITICAL',
    durationMin: 10,
    rationale: 'Closes the loop. Without it, days blur. With it, you know what worked + what to fix tomorrow.',
    subsections: [
      {
        key: 'review',
        label: 'Review',
        items: [
          { key: 'eod.hit_kpis', label: 'Did I hit my daily KPIs? (10 calls / 10 emails / 5 DMs / 3 audits)' },
          { key: 'eod.best_outcome', label: 'What was today’s best outcome? (log it)' },
          { key: 'eod.objection', label: 'What objection came up that needs a better answer?' },
          { key: 'eod.tomorrow_top_3', label: 'Top 3 priorities written for tomorrow' },
          { key: 'eod.calendar_check', label: 'Calendar checked for tomorrow’s commitments' },
        ],
      },
    ],
  },
  {
    key: 'stretch',
    label: 'Optional Stretch',
    tier: 'OPTIONAL',
    durationMin: 30,
    rationale: 'When you’re ahead — invest in compounding skills + cross-partner learning.',
    subsections: [
      {
        key: 'stretch',
        label: 'Stretch goals',
        items: [
          { key: 'stretch.training_video', label: 'Watch 1 sales training video (10 min)' },
          { key: 'stretch.industry_article', label: 'Read 1 industry article + share' },
          { key: 'stretch.test_template', label: 'Try 1 new outreach template + A/B against the standard' },
          { key: 'stretch.partner_call', label: 'Network call with another partner (compare playbooks)' },
        ],
      },
    ],
  },
]

/** Flat lookup. Returns null if key isn't in catalog. */
export function findActivity(key: string): ActivityItem | null {
  for (const section of DAILY_ACTIVITY_CATALOG) {
    for (const sub of section.subsections) {
      const hit = sub.items.find((i) => i.key === key)
      if (hit) return hit
    }
  }
  return null
}

/** Total checkbox count for the day (for completion-meter math). */
export function totalActivityCount(): number {
  return DAILY_ACTIVITY_CATALOG.reduce(
    (sum, s) => sum + s.subsections.reduce((ss, sub) => ss + sub.items.length, 0),
    0,
  )
}
