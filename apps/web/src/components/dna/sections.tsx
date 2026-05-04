'use client'

/**
 * Per-section form components for the Business DNA editor.
 *
 * Each section receives the raw JSONB blob from the API and renders the right
 * form fields. Unknown keys (legacy or future) are preserved via
 * `<UnrecognizedFields>` so saving never loses data. Missing fields render
 * empty inputs.
 *
 * Every section component is `(value, onChange, disabled?) => JSX` so the
 * page can render them uniformly.
 */

import {
  TextField, TextArea, Select, NumberField, StringList,
  ObjectList, HoursGrid, KeyValueMap, UnrecognizedFields,
  type ObjectFieldSchema,
} from './inputs'
import { GenerateWithAi } from './generate-with-ai'

/* ─────────────────────────────────────────────────────────────────────────
 * Type helpers — JSONB is loose; we always validate the shape we read.
 * ──────────────────────────────────────────────────────────────────────── */

type DNASection = Record<string, unknown>

export interface SectionProps {
  value: DNASection
  onChange: (next: DNASection) => void
  disabled?: boolean
  /**
   * The Identity section's saved values, passed in from the page so other
   * sections can pre-fill the AI-assist seed (businessName, industry, tone).
   */
  identitySnapshot?: DNASection
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x : String(x)))
}
function asObjectArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => x !== null && typeof x === 'object' && !Array.isArray(x)) as Record<string, unknown>[]
}
function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** Pluck unrecognised keys from the section so they can be displayed as-is. */
function extras(value: DNASection, known: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (!known.includes(k)) out[k] = v
  }
  return out
}

/** Update one field while preserving unrecognised keys. */
function patch(value: DNASection, partial: Record<string, unknown>): DNASection {
  return { ...value, ...partial }
}

/** Small row that hosts the "Generate with AI" pill above a section's fields. */
function AiAssistRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end">{children}</div>
}

/* ─────────────────────────────────────────────────────────────────────────
 * Identity
 * Schema: { businessName, tagline, shortDescription, elevatorPitch, tone,
 *           voicePreference, industry, targetCustomers }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_IDENTITY = [
  'businessName', 'tagline', 'shortDescription', 'elevatorPitch',
  'tone', 'voicePreference', 'industry', 'targetCustomers',
]

const VOICE_OPTIONS = [
  { value: '',         label: '— No preference —', hint: 'Falls back to the channel default voice.' },
  { value: 'Zephyr',   label: 'Zephyr',   hint: 'Female · Bright & clear' },
  { value: 'Despina',  label: 'Despina',  hint: 'Female · Smooth & polished' },
  { value: 'Aoede',    label: 'Aoede',    hint: 'Female · Warm & breezy' },
  { value: 'Charon',   label: 'Charon',   hint: 'Male · Deep & authoritative' },
  { value: 'Fenrir',   label: 'Fenrir',   hint: 'Male · Warm & approachable (default)' },
  { value: 'Puck',     label: 'Puck',     hint: 'Male · Upbeat & conversational' },
  { value: 'Sulafat',  label: 'Sulafat',  hint: 'Neutral · Warm & even' },
]

export function IdentitySection({ value, onChange, disabled }: SectionProps) {
  return (
    <div className="space-y-4">
      {!disabled && (
        <AiAssistRow>
          <GenerateWithAi
            section="identity"
            currentValue={value}
            identitySnapshot={value}
            onApply={(generated) => onChange({ ...value, ...generated })}
          />
        </AiAssistRow>
      )}
      <TextField
        label="Business name"
        value={asString(value['businessName'])}
        onChange={(v) => onChange(patch(value, { businessName: v }))}
        placeholder="Acme Plumbing"
        description="The name your agent uses to introduce itself."
        disabled={disabled}
      />
      <TextField
        label="Tagline"
        value={asString(value['tagline'])}
        onChange={(v) => onChange(patch(value, { tagline: v }))}
        placeholder="Fast, friendly, fixed right the first time."
        description="A short one-liner. Optional."
        disabled={disabled}
      />
      <TextArea
        label="Short description"
        value={asString(value['shortDescription'])}
        onChange={(v) => onChange(patch(value, { shortDescription: v }))}
        rows={2}
        placeholder="What the business does in one or two sentences."
        description="The agent uses this to answer 'what do you do?'."
        disabled={disabled}
      />
      <TextArea
        label="Elevator pitch"
        value={asString(value['elevatorPitch'])}
        onChange={(v) => onChange(patch(value, { elevatorPitch: v }))}
        rows={4}
        placeholder="A longer 30-second version. Cover what you do, who for, and what makes you different."
        description="Used when callers want more detail than the short description."
        disabled={disabled}
      />
      <TextField
        label="Tone"
        value={asString(value['tone'])}
        onChange={(v) => onChange(patch(value, { tone: v }))}
        placeholder="warm, professional, no jargon"
        description="A few adjectives describing how the agent should sound."
        disabled={disabled}
      />
      <Select
        label="Voice preference"
        value={asString(value['voicePreference'])}
        options={VOICE_OPTIONS}
        onChange={(v) => onChange(patch(value, { voicePreference: v }))}
        description="Which agent voice to prefer. The channel can override this."
        disabled={disabled}
      />
      <TextField
        label="Industry"
        value={asString(value['industry'])}
        onChange={(v) => onChange(patch(value, { industry: v }))}
        placeholder="Home services"
        disabled={disabled}
      />
      <TextArea
        label="Target customers"
        value={asString(value['targetCustomers'])}
        onChange={(v) => onChange(patch(value, { targetCustomers: v }))}
        rows={2}
        placeholder="Homeowners in the greater metro area, ages 35-65, who own their home."
        description="Who you serve. Helps the agent qualify leads."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_IDENTITY)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Services
 * Schema: { channels: [{ name, description, useCases: [string] }],
 *           agentCapabilities: [string] }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_SERVICES = ['channels', 'agentCapabilities']

const CHANNEL_SCHEMA: ObjectFieldSchema[] = [
  { key: 'name',        label: 'Name',        type: 'text',     placeholder: 'Inbound calls' },
  { key: 'description', label: 'Description', type: 'textarea', rows: 2, placeholder: 'What this channel covers.' },
  { key: 'useCases',    label: 'Use cases',   type: 'strings',  placeholder: 'New customer asks for a quote', emptyText: 'No use cases listed.' },
]

export function ServicesSection({ value, onChange, disabled }: SectionProps) {
  return (
    <div className="space-y-4">
      <ObjectList
        label="Channels"
        values={asObjectArray(value['channels'])}
        schema={CHANNEL_SCHEMA}
        onChange={(next) => onChange(patch(value, { channels: next }))}
        description="The channels this business serves customers through (calls, web chat, walk-ins, etc.)."
        itemLabel={(it, idx) => asString(it['name']) || `Channel ${idx + 1}`}
        emptyText="No channels yet — add the ones the agent should know about."
        disabled={disabled}
      />
      <StringList
        label="Agent capabilities"
        values={asStringArray(value['agentCapabilities'])}
        onChange={(next) => onChange(patch(value, { agentCapabilities: next }))}
        description="What the agent is allowed and able to do (book appointments, quote prices, take messages, etc.)."
        placeholder="Book appointments"
        emptyText="No capabilities listed yet."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_SERVICES)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Pricing
 * Schema: { plans: [{ name, price, summary }], overageRate, freeTrial,
 *           discountPolicy }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_PRICING = ['plans', 'overageRate', 'freeTrial', 'discountPolicy']

const PLAN_SCHEMA: ObjectFieldSchema[] = [
  { key: 'name',    label: 'Plan name', type: 'text',     placeholder: 'Standard' },
  { key: 'price',   label: 'Price',     type: 'text',     placeholder: '$197 / month' },
  { key: 'summary', label: 'Summary',   type: 'textarea', rows: 2, placeholder: 'What\'s included at a glance.' },
]

export function PricingSection({ value, onChange, disabled }: SectionProps) {
  return (
    <div className="space-y-4">
      <ObjectList
        label="Plans"
        values={asObjectArray(value['plans'])}
        schema={PLAN_SCHEMA}
        onChange={(next) => onChange(patch(value, { plans: next }))}
        description="Your packages or pricing tiers."
        itemLabel={(it, idx) => asString(it['name']) || `Plan ${idx + 1}`}
        emptyText="No plans yet."
        disabled={disabled}
      />
      <TextField
        label="Overage rate"
        value={asString(value['overageRate'])}
        onChange={(v) => onChange(patch(value, { overageRate: v }))}
        placeholder="$0.05 / minute over the included quota"
        description="What happens past the included quota — leave blank if N/A."
        disabled={disabled}
      />
      <TextField
        label="Free trial"
        value={asString(value['freeTrial'])}
        onChange={(v) => onChange(patch(value, { freeTrial: v }))}
        placeholder="14-day free trial, no card required"
        description="What trial or free period you offer, if any."
        disabled={disabled}
      />
      <TextArea
        label="Discount policy"
        value={asString(value['discountPolicy'])}
        onChange={(v) => onChange(patch(value, { discountPolicy: v }))}
        rows={3}
        placeholder="When can the agent offer a discount? Up to how much?"
        description="The rules the agent should follow when callers ask for a deal."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_PRICING)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Operations
 * Schema: { timezone, businessHours: { monday: "09:00-18:00", ... },
 *           holidays, afterHoursBehavior }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_OPERATIONS = ['timezone', 'businessHours', 'holidays', 'afterHoursBehavior']

const TIMEZONE_OPTIONS = [
  { value: '',                    label: '— Select —' },
  { value: 'America/New_York',    label: 'America/New_York (Eastern)' },
  { value: 'America/Chicago',     label: 'America/Chicago (Central)' },
  { value: 'America/Denver',      label: 'America/Denver (Mountain)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific)' },
  { value: 'America/Phoenix',     label: 'America/Phoenix' },
  { value: 'Europe/London',       label: 'Europe/London' },
  { value: 'Europe/Berlin',       label: 'Europe/Berlin' },
  { value: 'Asia/Tokyo',          label: 'Asia/Tokyo' },
  { value: 'Australia/Sydney',    label: 'Australia/Sydney' },
  { value: 'UTC',                 label: 'UTC' },
]

export function OperationsSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  return (
    <div className="space-y-4">
      {!disabled && (
        <AiAssistRow>
          <GenerateWithAi
            section="operations"
            currentValue={value}
            identitySnapshot={identitySnapshot}
            // Operations only generates afterHoursBehavior — preserve every
            // other key (timezone, businessHours, holidays, etc.).
            onApply={(generated) => onChange({ ...value, ...generated })}
          />
        </AiAssistRow>
      )}
      <Select
        label="Timezone"
        value={asString(value['timezone'])}
        options={TIMEZONE_OPTIONS}
        onChange={(v) => onChange(patch(value, { timezone: v }))}
        description="The timezone the business operates in. Used for hours and bookings."
        disabled={disabled}
      />
      <HoursGrid
        value={asObject(value['businessHours'])}
        onChange={(next) => onChange(patch(value, { businessHours: next }))}
        description="When you're open. Mark days closed with the checkbox."
        disabled={disabled}
      />
      <TextArea
        label="Holidays"
        value={asString(value['holidays'])}
        onChange={(v) => onChange(patch(value, { holidays: v }))}
        rows={3}
        placeholder="Closed Dec 24, Dec 25, Jan 1. Reduced hours on July 4."
        description="Major holidays and any special closures."
        disabled={disabled}
      />
      <TextArea
        label="After-hours behavior"
        value={asString(value['afterHoursBehavior'])}
        onChange={(v) => onChange(patch(value, { afterHoursBehavior: v }))}
        rows={3}
        placeholder="Take a message, offer to schedule a callback during business hours, escalate emergencies to the on-call number."
        description="What the agent should do when called outside business hours."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_OPERATIONS)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Sales
 * Schema: { qualificationCriteria: [string], discoveryQuestions: [string],
 *           demoFlow, objectionHandling: { ... } }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_SALES = ['qualificationCriteria', 'discoveryQuestions', 'demoFlow', 'objectionHandling']

export function SalesSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  return (
    <div className="space-y-4">
      {!disabled && (
        <AiAssistRow>
          <GenerateWithAi
            section="sales"
            currentValue={value}
            identitySnapshot={identitySnapshot}
            onApply={(generated) => onChange({ ...value, ...generated })}
          />
        </AiAssistRow>
      )}
      <StringList
        label="Qualification criteria"
        values={asStringArray(value['qualificationCriteria'])}
        onChange={(next) => onChange(patch(value, { qualificationCriteria: next }))}
        description="What makes a caller a good fit? The agent uses these to decide whether to keep selling or to politely disqualify."
        placeholder="Owns a single-family home"
        emptyText="No qualification criteria yet."
        disabled={disabled}
      />
      <StringList
        label="Discovery questions"
        values={asStringArray(value['discoveryQuestions'])}
        onChange={(next) => onChange(patch(value, { discoveryQuestions: next }))}
        description="Questions the agent should ask early on a sales call."
        placeholder="What problem are you trying to solve?"
        emptyText="No discovery questions yet."
        disabled={disabled}
      />
      <TextArea
        label="Demo flow"
        value={asString(value['demoFlow'])}
        onChange={(v) => onChange(patch(value, { demoFlow: v }))}
        rows={4}
        placeholder="If the caller is qualified, walk them through: 1) the problem we solve, 2) how it works, 3) pricing, 4) next steps."
        description="The structure of a typical sales conversation, top to bottom."
        disabled={disabled}
      />
      <KeyValueMap
        label="Objection handling"
        value={asObject(value['objectionHandling'])}
        onChange={(next) => onChange(patch(value, { objectionHandling: next }))}
        description="Common objections and how the agent should respond. Key = objection, value = response."
        keyLabel="Objection"
        valueLabel="Response"
        keyPlaceholder="Too expensive"
        valuePlaceholder="Acknowledge, then re-anchor on value: explain what's included and the cost of not solving the problem."
        emptyText="No objections mapped yet."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_SALES)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Appointments
 * Schema: { defaultDuration, appointmentTypes: [{ name, duration, description }],
 *           bookingPolicy, cancellationPolicy }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_APPOINTMENT = ['defaultDuration', 'appointmentTypes', 'bookingPolicy', 'cancellationPolicy']

const APPOINTMENT_TYPE_SCHEMA: ObjectFieldSchema[] = [
  { key: 'name',        label: 'Name',        type: 'text',     placeholder: 'Free consultation' },
  { key: 'duration',    label: 'Duration',    type: 'number',   unit: 'minutes' },
  { key: 'description', label: 'Description', type: 'textarea', rows: 2, placeholder: 'What happens during this appointment.' },
]

export function AppointmentSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  return (
    <div className="space-y-4">
      {!disabled && (
        <AiAssistRow>
          <GenerateWithAi
            section="appointment"
            currentValue={value}
            identitySnapshot={identitySnapshot}
            onApply={(generated) => onChange({ ...value, ...generated })}
          />
        </AiAssistRow>
      )}
      <NumberField
        label="Default duration"
        value={asNumber(value['defaultDuration'], 30)}
        unit="minutes"
        onChange={(v) => onChange(patch(value, { defaultDuration: v }))}
        description="Standard appointment length when no specific type is requested."
        min={5}
        disabled={disabled}
      />
      <ObjectList
        label="Appointment types"
        values={asObjectArray(value['appointmentTypes'])}
        schema={APPOINTMENT_TYPE_SCHEMA}
        onChange={(next) => onChange(patch(value, { appointmentTypes: next }))}
        description="The kinds of appointments callers can book."
        itemLabel={(it, idx) => asString(it['name']) || `Type ${idx + 1}`}
        emptyText="No appointment types yet."
        disabled={disabled}
      />
      <TextArea
        label="Booking policy"
        value={asString(value['bookingPolicy'])}
        onChange={(v) => onChange(patch(value, { bookingPolicy: v }))}
        rows={3}
        placeholder="Bookings require name, phone, and email. Minimum 4 hours notice. Confirmations sent by email."
        description="The rules around how appointments get booked."
        disabled={disabled}
      />
      <TextArea
        label="Cancellation policy"
        value={asString(value['cancellationPolicy'])}
        onChange={(v) => onChange(patch(value, { cancellationPolicy: v }))}
        rows={3}
        placeholder="Free cancellation up to 24 hours before. Within 24 hours, $50 fee."
        description="What happens if a caller wants to cancel or reschedule."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_APPOINTMENT)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Support
 * Schema: { commonIssues: [{ issue, fix }], escalationRules: [string],
 *           supportEmail, founderContact }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_SUPPORT = ['commonIssues', 'escalationRules', 'supportEmail', 'founderContact']

const COMMON_ISSUE_SCHEMA: ObjectFieldSchema[] = [
  { key: 'issue', label: 'Issue', type: 'text',     placeholder: 'Caller can\'t find their invoice' },
  { key: 'fix',   label: 'Fix',   type: 'textarea', rows: 3, placeholder: 'Direct them to billing@... or offer to email a copy.' },
]

export function SupportSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  return (
    <div className="space-y-4">
      {!disabled && (
        <AiAssistRow>
          <GenerateWithAi
            section="support"
            currentValue={value}
            identitySnapshot={identitySnapshot}
            onApply={(generated) => onChange({ ...value, ...generated })}
          />
        </AiAssistRow>
      )}
      <ObjectList
        label="Common issues"
        values={asObjectArray(value['commonIssues'])}
        schema={COMMON_ISSUE_SCHEMA}
        onChange={(next) => onChange(patch(value, { commonIssues: next }))}
        description="Issues callers ask about often, paired with the right fix."
        itemLabel={(it, idx) => asString(it['issue']) || `Issue ${idx + 1}`}
        emptyText="No common issues mapped yet."
        disabled={disabled}
      />
      <StringList
        label="Escalation rules"
        values={asStringArray(value['escalationRules'])}
        onChange={(next) => onChange(patch(value, { escalationRules: next }))}
        description="When the agent should hand off to a human."
        placeholder="Caller is frustrated or asks for a manager"
        emptyText="No escalation rules yet."
        disabled={disabled}
      />
      <TextField
        label="Support email"
        value={asString(value['supportEmail'])}
        onChange={(v) => onChange(patch(value, { supportEmail: v }))}
        type="email"
        placeholder="support@acme.com"
        description="Where the agent should direct customers for written support."
        disabled={disabled}
      />
      <TextField
        label="Founder contact"
        value={asString(value['founderContact'])}
        onChange={(v) => onChange(patch(value, { founderContact: v }))}
        placeholder="founder@acme.com or +1 555 000 0000"
        description="An escalation path of last resort. Used sparingly."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_SUPPORT)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Language
 * Schema: { primaryLanguage, supportedLanguages: [string],
 *           vocabularyPreferences: [string], prohibitedLanguage: [string] }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_LANGUAGE = ['primaryLanguage', 'supportedLanguages', 'vocabularyPreferences', 'prohibitedLanguage']

const LANGUAGE_OPTIONS = [
  { value: '',           label: '— Select —' },
  { value: 'English',    label: 'English' },
  { value: 'Spanish',    label: 'Spanish' },
  { value: 'French',     label: 'French' },
  { value: 'German',     label: 'German' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Italian',    label: 'Italian' },
]

export function LanguageSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  return (
    <div className="space-y-4">
      {!disabled && (
        <AiAssistRow>
          <GenerateWithAi
            section="language"
            currentValue={value}
            identitySnapshot={identitySnapshot}
            onApply={(generated) => onChange({ ...value, ...generated })}
          />
        </AiAssistRow>
      )}
      <Select
        label="Primary language"
        value={asString(value['primaryLanguage'])}
        options={LANGUAGE_OPTIONS}
        onChange={(v) => onChange(patch(value, { primaryLanguage: v }))}
        description="The default language for agent conversations."
        disabled={disabled}
      />
      <StringList
        label="Supported languages"
        values={asStringArray(value['supportedLanguages'])}
        onChange={(next) => onChange(patch(value, { supportedLanguages: next }))}
        description="Other languages the agent should answer in if asked."
        placeholder="Spanish"
        emptyText="No additional languages."
        disabled={disabled}
      />
      <StringList
        label="Vocabulary preferences"
        values={asStringArray(value['vocabularyPreferences'])}
        onChange={(next) => onChange(patch(value, { vocabularyPreferences: next }))}
        description="Words and phrases the agent should prefer to use."
        placeholder="say 'team member' instead of 'staff'"
        emptyText="No vocabulary preferences."
        disabled={disabled}
      />
      <StringList
        label="Prohibited language"
        values={asStringArray(value['prohibitedLanguage'])}
        onChange={(next) => onChange(patch(value, { prohibitedLanguage: next }))}
        description="Words and phrases the agent must never use."
        placeholder="don't say 'guarantee'"
        emptyText="No prohibited words."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_LANGUAGE)} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Compliance
 * Schema: { callRecordingConsent, dataHandling, phoneCompliance,
 *           smsCompliance, ageRestrictions }
 * ──────────────────────────────────────────────────────────────────────── */

const KNOWN_COMPLIANCE = [
  'callRecordingConsent', 'dataHandling', 'phoneCompliance', 'smsCompliance', 'ageRestrictions',
]

export function ComplianceSection({ value, onChange, disabled }: SectionProps) {
  return (
    <div className="space-y-4">
      <TextArea
        label="Call recording consent"
        value={asString(value['callRecordingConsent'])}
        onChange={(v) => onChange(patch(value, { callRecordingConsent: v }))}
        rows={3}
        placeholder="This call may be recorded for quality and training purposes."
        description="The exact disclosure your agent should read at the start of recorded calls."
        disabled={disabled}
      />
      <TextArea
        label="Data handling"
        value={asString(value['dataHandling'])}
        onChange={(v) => onChange(patch(value, { dataHandling: v }))}
        rows={3}
        placeholder="We store contact data in the US. We don't share with third parties without consent."
        description="How customer data is stored and used. Drives the agent's privacy answers."
        disabled={disabled}
      />
      <TextArea
        label="Phone compliance"
        value={asString(value['phoneCompliance'])}
        onChange={(v) => onChange(patch(value, { phoneCompliance: v }))}
        rows={3}
        placeholder="TCPA: only outbound-call numbers with prior express consent. Honor opt-outs immediately."
        description="Telephony rules the agent must follow (TCPA, do-not-call, etc.)."
        disabled={disabled}
      />
      <TextArea
        label="SMS compliance"
        value={asString(value['smsCompliance'])}
        onChange={(v) => onChange(patch(value, { smsCompliance: v }))}
        rows={3}
        placeholder="Include STOP and HELP language in any opt-in. Honor STOP within 24 hours."
        description="SMS-specific rules (10DLC, opt-in/out flow)."
        disabled={disabled}
      />
      <TextArea
        label="Age restrictions"
        value={asString(value['ageRestrictions'])}
        onChange={(v) => onChange(patch(value, { ageRestrictions: v }))}
        rows={2}
        placeholder="18 and over only."
        description="Any age gating that applies to your offering."
        disabled={disabled}
      />
      <UnrecognizedFields extras={extras(value, KNOWN_COMPLIANCE)} />
    </div>
  )
}
