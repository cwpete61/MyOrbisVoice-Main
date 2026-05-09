// Compact in-app browseable view of docs/marketing-style-guide.md.
// The doc is the source of truth; this module is the rendering data.
// When the doc updates, update this file so the in-app surface stays fresh.
//
// Used by:
//   - apps/web/src/app/(dashboard)/marketing-resources/page.tsx (tenant)
//   - (future) apps/web/src/app/(partner-portal)/.../marketing-kit/copy-frameworks/page.tsx
//
// This is an intentional "cheat sheet" — not the full doc. Tenants who want
// the deep version read the doc directly. The in-app view is for the moment a
// tenant is writing a campaign and wants to remember what PAS stands for.

export interface FrameworkCard {
  id:           string
  name:         string
  fullName:     string
  oneLiner:     string
  steps:        string[]
  bestFor:      string
  tier:         'all' | 'conservative' | 'balanced' | 'direct' | 'aggressive'
}

export interface CialdiniPrinciple {
  id:        string
  name:      string
  oneLiner:  string
  example:   string
}

export interface VerticalExample {
  id:           'dental' | 'legal' | 'home-services' | 'fitness' | 'beauty'
  label:        string
  recommendedTier: 'conservative' | 'balanced' | 'direct'
  hook:         string
  pain:         string
  offer:        string
}

export interface HeadlineFormula {
  pattern:  string
  example:  string
  best:     string
}

export interface AntiPattern {
  pattern:  string
  badExample: string
  fixedExample: string
  why:        string
}

// ── Frameworks ──────────────────────────────────────────────────────────────

export const FRAMEWORKS: FrameworkCard[] = [
  {
    id:       'pas',
    name:     'PAS',
    fullName: 'Problem · Agitate · Solve',
    oneLiner: 'State the problem, twist the knife once with a specific cost-of-inaction, then offer the solution.',
    steps: [
      'Problem — name the situation specifically',
      'Agitate — quantify the cost of doing nothing',
      'Solve — present the solution + one CTA',
    ],
    bestFor: 'Cold outreach, ads, problem-aware landing pages, social cuts',
    tier: 'balanced',
  },
  {
    id:       'aida',
    name:     'AIDA',
    fullName: 'Attention · Interest · Desire · Action',
    oneLiner: 'Hook with attention, build interest with story, stoke desire with benefits, trigger action with a hard CTA.',
    steps: [
      'Attention — Caples-style specific-benefit hook',
      'Interest — expand the promise with story',
      'Desire — show the after-state, prove it',
      'Action — irresistible offer + deadline',
    ],
    bestFor: 'Long-form sales letters, full-funnel emails, launches',
    tier: 'direct',
  },
  {
    id:       'bab',
    name:     'BAB',
    fullName: 'Before · After · Bridge',
    oneLiner: 'Show life before, life after, then the bridge that closes the gap.',
    steps: [
      'Before — current pain state, specific',
      'After — desired state, specific',
      'Bridge — the platform/product as the path',
    ],
    bestFor: 'Transformation stories, case studies, testimonial framing',
    tier: 'conservative',
  },
  {
    id:       'storybrand',
    name:     'StoryBrand 7',
    fullName: 'Customer-as-Hero (Donald Miller)',
    oneLiner: 'Make the customer the hero of the story; the brand is the guide who hands them a plan.',
    steps: [
      'A character (the customer)',
      'Has a problem',
      'Meets a guide (the brand)',
      'Who gives them a plan',
      'Calls them to action',
      'That helps them avoid failure',
      'And ends in success',
    ],
    bestFor: 'Marketing site home page, brand video, "about us" pages',
    tier: 'all',
  },
]

// ── Cialdini's 7 Principles of Persuasion ──────────────────────────────────

export const CIALDINI: CialdiniPrinciple[] = [
  {
    id:       'reciprocity',
    name:     'Reciprocity',
    oneLiner: 'Give something valuable BEFORE asking. The audience feels obligated to engage in return.',
    example:  '"Free 5-minute audit of your missed-call patterns — no signup needed."',
  },
  {
    id:       'commitment',
    name:     'Commitment + Consistency',
    oneLiner: 'Get a small yes first. Each commitment makes the next easier to keep.',
    example:  '"Want to see a 90-second demo?" → "Want a free trial?" → purchase.',
  },
  {
    id:       'social-proof',
    name:     'Social Proof',
    oneLiner: 'Show what others like them are doing. Specific numbers > "trusted worldwide."',
    example:  '"500+ dental practices use this. Sarah\'s office in Allentown captured 23 missed calls last month."',
  },
  {
    id:       'authority',
    name:     'Authority',
    oneLiner: 'Show expertise + credentials early. Citation chips on every claim (Forbes, HBR, BIA-Kelsey).',
    example:  '"85% of after-hours callers never call back (BIA-Kelsey)."',
  },
  {
    id:       'liking',
    name:     'Liking',
    oneLiner: 'Be similar, complimentary, cooperative. Talk like the audience talks.',
    example:  '"You\'ve been juggling missed calls and pricing questions for years."',
  },
  {
    id:       'scarcity',
    name:     'Scarcity',
    oneLiner: 'Limited supply > limited time, when both are real. Fake scarcity burns trust.',
    example:  '"100 LTD spots, lifetime price. First 50 partners get the founding badge."',
  },
  {
    id:       'unity',
    name:     'Unity',
    oneLiner: 'Shared identity. Stronger than liking — implies a tribal in-group.',
    example:  '"Built by service-business owners, for service-business owners."',
  },
]

// ── Per-vertical worked examples ────────────────────────────────────────────

export const VERTICALS: VerticalExample[] = [
  {
    id:    'dental',
    label: 'Dental',
    recommendedTier: 'conservative',
    hook:  'Your front desk closes at 5. Your patients\' jaw pain doesn\'t.',
    pain:  'After-hours emergency callers don\'t leave voicemails — they call the next dentist on Google. The AAGD reports that ~40% of new-patient calls happen outside normal hours.',
    offer: 'First month free. We hand you the transcript of every call so you can verify it\'s working before you pay anything.',
  },
  {
    id:    'legal',
    label: 'Legal',
    recommendedTier: 'conservative',
    hook:  'When a potential client calls a personal-injury firm, they call the next firm if you don\'t pick up. Period.',
    pain:  '79% of personal-injury intake calls go to whoever answers first. After-hours ROI is a function of pickup speed, not advertising spend.',
    offer: 'Schedule a 20-minute walkthrough. Bring a recent voicemail you missed; we\'ll show you what would have happened.',
  },
  {
    id:    'home-services',
    label: 'Home services',
    recommendedTier: 'balanced',
    hook:  'Your truck is rolling. Your phone is ringing. Now what?',
    pain:  'Every missed call between 10am and 4pm goes to the next number on the search results. Service businesses lose 8-15 leads/week to "we couldn\'t answer fast enough."',
    offer: 'Mike\'s HVAC in Phoenix went from missing 14 calls a week to capturing every one of them within 8 days.',
  },
  {
    id:    'fitness',
    label: 'Fitness',
    recommendedTier: 'direct',
    hook:  'Your DM inbox doesn\'t sleep. You shouldn\'t be the one answering it at 11pm.',
    pain:  'Leads cool fast in fitness — the 5-min response window matters more than in any other vertical. The agent that answers in 60 seconds wins.',
    offer: 'First 25 studios get founder pricing — $97/mo locked for life. Tomorrow it\'s $197.',
  },
  {
    id:    'beauty',
    label: 'Beauty',
    recommendedTier: 'direct',
    hook:  'She\'ll book with whoever answers first. After 9pm, that\'s never you.',
    pain:  'Booking-window economics in beauty: every minute past 30 minutes drops conversion ~7%. After-hours = 80% bounce.',
    offer: 'Maria\'s salon in Tampa books 31% more after-hours appointments now. Limited founder rates this month.',
  },
]

// ── Headline formulas (Caples 35, operational subset) ──────────────────────

export const HEADLINE_FORMULAS: HeadlineFormula[] = [
  { pattern: 'How to [outcome] (without [common cost])',
    example: 'How to capture every missed call without hiring a receptionist',
    best:    'Pain-aware traffic, evergreen' },
  { pattern: '[N] ways to [achieve outcome]',
    example: '7 calls your front desk is missing every Tuesday',
    best:    'Curiosity + specificity, list-friendly' },
  { pattern: 'Why [unexpected fact]',
    example: 'Why 85% of after-hours callers never call back',
    best:    'News-aware, citation-anchored' },
  { pattern: 'The [adjective] way to [outcome]',
    example: 'The cheapest way to add a 24/7 receptionist',
    best:    'Pricing-page traffic' },
  { pattern: 'What every [audience] should know about [topic]',
    example: 'What every dental office should know about Tuesday-afternoon missed calls',
    best:    'Vertical-specific landing' },
  { pattern: 'If you [condition], here\'s [solution]',
    example: 'If you\'ve ever apologized to a customer for a missed call, this is for you',
    best:    'Self-identifying audience filter' },
  { pattern: '[Social proof number] [audience] are doing [thing]',
    example: '500+ service businesses are letting AI handle after-hours',
    best:    'Social-proof opener' },
  { pattern: '[Outcome] in [specific short time]',
    example: 'Set up your AI receptionist in under 8 minutes',
    best:    'Onboarding push, friction-reduction' },
  { pattern: 'The [story type] that changed how I [outcome]',
    example: 'The voicemail that changed how I think about lead capture',
    best:    'Story-led nurture email' },
  { pattern: '[Question that names the pain]',
    example: 'Tired of explaining missed calls to your customers?',
    best:    'Cold email, ad copy' },
]

// ── Anti-patterns (LLM defaults to avoid) ──────────────────────────────────

export const ANTI_PATTERNS: AntiPattern[] = [
  {
    pattern: 'LLM hedging',
    badExample: '"It might be worth considering whether you could potentially benefit from..."',
    fixedExample: '"You\'re losing 8 calls a week. Here\'s how to stop."',
    why: 'Costs the read. Direct response is direct.',
  },
  {
    pattern: 'Owner-centered openings',
    badExample: '"We are excited to share our new..."',
    fixedExample: '"You\'ve been juggling missed calls for years. Here\'s a faster way."',
    why: 'Customer doesn\'t care about your excitement. Lead with their problem.',
  },
  {
    pattern: 'Adjective stacking',
    badExample: '"Powerful, intuitive, beautiful, modern platform."',
    fixedExample: '"Captures every missed call. Books appointments. $97/mo."',
    why: 'Zero info, zero hook. Stack proof, not adjectives.',
  },
  {
    pattern: 'Cliché urgency without enforcement',
    badExample: '"Don\'t miss out! Limited time!" (with no actual deadline)',
    fixedExample: '"100 LTD spots. 47 left. Closes Sunday Sept 15 at midnight EST."',
    why: 'Burns trust. Kennedy: this is the fastest way to lose direct-response credibility.',
  },
  {
    pattern: 'Generic social proof',
    badExample: '"Trusted by businesses worldwide."',
    fixedExample: '"500+ dental practices and counting. See their numbers →"',
    why: 'Specific or nothing. "500+ dental practices" or don\'t say it.',
  },
  {
    pattern: 'Apology framing',
    badExample: '"We know your time is valuable, but..."',
    fixedExample: '"This is 90 seconds. You\'ll know in 90 seconds whether it\'s for you."',
    why: 'Lowers the writer\'s status. Direct response writers never apologize for selling.',
  },
]

// ── Tier reference ─────────────────────────────────────────────────────────

export const TIER_GUIDE = [
  {
    tier:    'conservative',
    label:   'Conservative',
    bestFor: 'Dental, legal, financial advisors, B2B services',
    voice:   'Polite, factual, proof-stacked. No urgency tactics. CTAs are invitations.',
  },
  {
    tier:    'balanced',
    label:   'Balanced (default)',
    bestFor: 'Home services, beauty, fitness, most service businesses',
    voice:   'Modern direct-response. Emotional but credible. Soft urgency where natural. Direct CTAs.',
  },
  {
    tier:    'direct',
    label:   'Direct',
    bestFor: 'Coaching, courses, info products, time-sensitive offers',
    voice:   'Story-led, urgency built in. Real deadlines. Hard CTAs.',
  },
  {
    tier:    'aggressive',
    label:   'Aggressive',
    bestFor: 'One-time events: Black Friday, launches, anniversary sales',
    voice:   'High-intensity launch voice. Sparingly — burns trust if used continuously.',
  },
] as const
