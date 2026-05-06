'use client'

/**
 * Per-section form components for the Business DNA editor.
 *
 * Each section receives the raw JSONB blob from the API and renders the right
 * form fields. Missing fields render empty inputs. Unknown keys are still
 * preserved on save (the value object is sent as-is to PATCH) — they just
 * aren't surfaced in the UI; tenants who want to preserve background
 * reference content should use the Knowledge Base section instead.
 *
 * Every section component is `(value, onChange, disabled?) => JSX` so the
 * page can render them uniformly.
 */

import {
  TextField, TextArea, Select, NumberField, StringList,
  ObjectList, HoursGrid, KeyValueMap,
  type ObjectFieldSchema,
} from './inputs'
import { GenerateWithAi } from './generate-with-ai'
import { useT } from '@/lib/i18n/I18nProvider'

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
  const isObj = (x: unknown): x is Record<string, unknown> =>
    x !== null && typeof x === 'object' && !Array.isArray(x)
  return v.filter(isObj)
}
function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
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

export function IdentitySection({ value, onChange, disabled }: SectionProps) {
  const t = useT()
  const VOICE_OPTIONS = [
    { value: '',         label: t('tenantBusinessDna.voiceOptions.none'),  hint: t('tenantBusinessDna.voiceOptions.noneHint') },
    { value: 'Zephyr',   label: 'Zephyr',   hint: t('tenantBusinessDna.voiceOptions.zephyrHint') },
    { value: 'Despina',  label: 'Despina',  hint: t('tenantBusinessDna.voiceOptions.despinaHint') },
    { value: 'Aoede',    label: 'Aoede',    hint: t('tenantBusinessDna.voiceOptions.aoedeHint') },
    { value: 'Charon',   label: 'Charon',   hint: t('tenantBusinessDna.voiceOptions.charonHint') },
    { value: 'Fenrir',   label: 'Fenrir',   hint: t('tenantBusinessDna.voiceOptions.fenrirHint') },
    { value: 'Puck',     label: 'Puck',     hint: t('tenantBusinessDna.voiceOptions.puckHint') },
    { value: 'Sulafat',  label: 'Sulafat',  hint: t('tenantBusinessDna.voiceOptions.sulafatHint') },
  ]
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
        label={t('tenantBusinessDna.identity.businessName.label')}
        value={asString(value['businessName'])}
        onChange={(v) => onChange(patch(value, { businessName: v }))}
        placeholder={t('tenantBusinessDna.identity.businessName.placeholder')}
        description={t('tenantBusinessDna.identity.businessName.description')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.identity.agentName.label')}
        value={asString(value['agentName'])}
        onChange={(v) => onChange(patch(value, { agentName: v }))}
        placeholder={t('tenantBusinessDna.identity.agentName.placeholder')}
        description={t('tenantBusinessDna.identity.agentName.description')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.identity.tagline.label')}
        value={asString(value['tagline'])}
        onChange={(v) => onChange(patch(value, { tagline: v }))}
        placeholder={t('tenantBusinessDna.identity.tagline.placeholder')}
        description={t('tenantBusinessDna.identity.tagline.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.identity.shortDescription.label')}
        value={asString(value['shortDescription'])}
        onChange={(v) => onChange(patch(value, { shortDescription: v }))}
        rows={2}
        placeholder={t('tenantBusinessDna.identity.shortDescription.placeholder')}
        description={t('tenantBusinessDna.identity.shortDescription.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.identity.elevatorPitch.label')}
        value={asString(value['elevatorPitch'])}
        onChange={(v) => onChange(patch(value, { elevatorPitch: v }))}
        rows={4}
        placeholder={t('tenantBusinessDna.identity.elevatorPitch.placeholder')}
        description={t('tenantBusinessDna.identity.elevatorPitch.description')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.identity.tone.label')}
        value={asString(value['tone'])}
        onChange={(v) => onChange(patch(value, { tone: v }))}
        placeholder={t('tenantBusinessDna.identity.tone.placeholder')}
        description={t('tenantBusinessDna.identity.tone.description')}
        disabled={disabled}
      />
      <Select
        label={t('tenantBusinessDna.identity.voicePreference.label')}
        value={asString(value['voicePreference'])}
        options={VOICE_OPTIONS}
        onChange={(v) => onChange(patch(value, { voicePreference: v }))}
        description={t('tenantBusinessDna.identity.voicePreference.description')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.identity.industry.label')}
        value={asString(value['industry'])}
        onChange={(v) => onChange(patch(value, { industry: v }))}
        placeholder={t('tenantBusinessDna.identity.industry.placeholder')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.identity.targetCustomers.label')}
        value={asString(value['targetCustomers'])}
        onChange={(v) => onChange(patch(value, { targetCustomers: v }))}
        rows={2}
        placeholder={t('tenantBusinessDna.identity.targetCustomers.placeholder')}
        description={t('tenantBusinessDna.identity.targetCustomers.description')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Services
 * Schema: { channels: [{ name, description, useCases: [string] }],
 *           agentCapabilities: [string] }
 * ──────────────────────────────────────────────────────────────────────── */


export function ServicesSection({ value, onChange, disabled }: SectionProps) {
  const t = useT()
  const CHANNEL_SCHEMA: ObjectFieldSchema[] = [
    { key: 'name',        label: t('tenantBusinessDna.services.channels.fields.name'),        type: 'text',     placeholder: t('tenantBusinessDna.services.channels.fields.namePlaceholder') },
    { key: 'description', label: t('tenantBusinessDna.services.channels.fields.description'), type: 'textarea', rows: 2, placeholder: t('tenantBusinessDna.services.channels.fields.descriptionPlaceholder') },
    { key: 'useCases',    label: t('tenantBusinessDna.services.channels.fields.useCases'),    type: 'strings',  placeholder: t('tenantBusinessDna.services.channels.fields.useCasesPlaceholder'), emptyText: t('tenantBusinessDna.services.channels.fields.useCasesEmpty') },
  ]
  return (
    <div className="space-y-4">
      <ObjectList
        label={t('tenantBusinessDna.services.channels.label')}
        values={asObjectArray(value['channels'])}
        schema={CHANNEL_SCHEMA}
        onChange={(next) => onChange(patch(value, { channels: next }))}
        description={t('tenantBusinessDna.services.channels.description')}
        itemLabel={(it, idx) => asString(it['name']) || t('tenantBusinessDna.services.channels.fallbackName', { n: idx + 1 })}
        emptyText={t('tenantBusinessDna.services.channels.empty')}
        disabled={disabled}
      />
      <StringList
        label={t('tenantBusinessDna.services.agentCapabilities.label')}
        values={asStringArray(value['agentCapabilities'])}
        onChange={(next) => onChange(patch(value, { agentCapabilities: next }))}
        description={t('tenantBusinessDna.services.agentCapabilities.description')}
        placeholder={t('tenantBusinessDna.services.agentCapabilities.placeholder')}
        emptyText={t('tenantBusinessDna.services.agentCapabilities.empty')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Pricing
 * Schema: { plans: [{ name, price, summary }], overageRate, freeTrial,
 *           discountPolicy }
 * ──────────────────────────────────────────────────────────────────────── */


export function PricingSection({ value, onChange, disabled }: SectionProps) {
  const t = useT()
  const PLAN_SCHEMA: ObjectFieldSchema[] = [
    { key: 'name',    label: t('tenantBusinessDna.pricing.plans.fields.name'),    type: 'text',     placeholder: t('tenantBusinessDna.pricing.plans.fields.namePlaceholder') },
    { key: 'price',   label: t('tenantBusinessDna.pricing.plans.fields.price'),   type: 'text',     placeholder: t('tenantBusinessDna.pricing.plans.fields.pricePlaceholder') },
    { key: 'summary', label: t('tenantBusinessDna.pricing.plans.fields.summary'), type: 'textarea', rows: 2, placeholder: t('tenantBusinessDna.pricing.plans.fields.summaryPlaceholder') },
  ]
  return (
    <div className="space-y-4">
      <ObjectList
        label={t('tenantBusinessDna.pricing.plans.label')}
        values={asObjectArray(value['plans'])}
        schema={PLAN_SCHEMA}
        onChange={(next) => onChange(patch(value, { plans: next }))}
        description={t('tenantBusinessDna.pricing.plans.description')}
        itemLabel={(it, idx) => asString(it['name']) || t('tenantBusinessDna.pricing.plans.fallbackName', { n: idx + 1 })}
        emptyText={t('tenantBusinessDna.pricing.plans.empty')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.pricing.overageRate.label')}
        value={asString(value['overageRate'])}
        onChange={(v) => onChange(patch(value, { overageRate: v }))}
        placeholder={t('tenantBusinessDna.pricing.overageRate.placeholder')}
        description={t('tenantBusinessDna.pricing.overageRate.description')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.pricing.freeTrial.label')}
        value={asString(value['freeTrial'])}
        onChange={(v) => onChange(patch(value, { freeTrial: v }))}
        placeholder={t('tenantBusinessDna.pricing.freeTrial.placeholder')}
        description={t('tenantBusinessDna.pricing.freeTrial.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.pricing.discountPolicy.label')}
        value={asString(value['discountPolicy'])}
        onChange={(v) => onChange(patch(value, { discountPolicy: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.pricing.discountPolicy.placeholder')}
        description={t('tenantBusinessDna.pricing.discountPolicy.description')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Operations
 * Schema: { timezone, businessHours: { monday: "09:00-18:00", ... },
 *           holidays, afterHoursBehavior }
 * ──────────────────────────────────────────────────────────────────────── */


export function OperationsSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  const t = useT()
  const TIMEZONE_OPTIONS = [
    { value: '',                    label: t('tenantBusinessDna.operations.timezone.selectPlaceholder') },
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
        label={t('tenantBusinessDna.operations.timezone.label')}
        value={asString(value['timezone'])}
        options={TIMEZONE_OPTIONS}
        onChange={(v) => onChange(patch(value, { timezone: v }))}
        description={t('tenantBusinessDna.operations.timezone.description')}
        disabled={disabled}
      />
      <HoursGrid
        value={asObject(value['businessHours'])}
        onChange={(next) => onChange(patch(value, { businessHours: next }))}
        description={t('tenantBusinessDna.operations.businessHours.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.operations.holidays.label')}
        value={asString(value['holidays'])}
        onChange={(v) => onChange(patch(value, { holidays: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.operations.holidays.placeholder')}
        description={t('tenantBusinessDna.operations.holidays.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.operations.afterHoursBehavior.label')}
        value={asString(value['afterHoursBehavior'])}
        onChange={(v) => onChange(patch(value, { afterHoursBehavior: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.operations.afterHoursBehavior.placeholder')}
        description={t('tenantBusinessDna.operations.afterHoursBehavior.description')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Sales
 * Schema: { qualificationCriteria: [string], discoveryQuestions: [string],
 *           demoFlow, objectionHandling: { ... } }
 * ──────────────────────────────────────────────────────────────────────── */


export function SalesSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  const t = useT()
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
        label={t('tenantBusinessDna.sales.qualificationCriteria.label')}
        values={asStringArray(value['qualificationCriteria'])}
        onChange={(next) => onChange(patch(value, { qualificationCriteria: next }))}
        description={t('tenantBusinessDna.sales.qualificationCriteria.description')}
        placeholder={t('tenantBusinessDna.sales.qualificationCriteria.placeholder')}
        emptyText={t('tenantBusinessDna.sales.qualificationCriteria.empty')}
        disabled={disabled}
      />
      <StringList
        label={t('tenantBusinessDna.sales.discoveryQuestions.label')}
        values={asStringArray(value['discoveryQuestions'])}
        onChange={(next) => onChange(patch(value, { discoveryQuestions: next }))}
        description={t('tenantBusinessDna.sales.discoveryQuestions.description')}
        placeholder={t('tenantBusinessDna.sales.discoveryQuestions.placeholder')}
        emptyText={t('tenantBusinessDna.sales.discoveryQuestions.empty')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.sales.demoFlow.label')}
        value={asString(value['demoFlow'])}
        onChange={(v) => onChange(patch(value, { demoFlow: v }))}
        rows={4}
        placeholder={t('tenantBusinessDna.sales.demoFlow.placeholder')}
        description={t('tenantBusinessDna.sales.demoFlow.description')}
        disabled={disabled}
      />
      <KeyValueMap
        label={t('tenantBusinessDna.sales.objectionHandling.label')}
        value={asObject(value['objectionHandling'])}
        onChange={(next) => onChange(patch(value, { objectionHandling: next }))}
        description={t('tenantBusinessDna.sales.objectionHandling.description')}
        keyLabel={t('tenantBusinessDna.sales.objectionHandling.keyLabel')}
        valueLabel={t('tenantBusinessDna.sales.objectionHandling.valueLabel')}
        keyPlaceholder={t('tenantBusinessDna.sales.objectionHandling.keyPlaceholder')}
        valuePlaceholder={t('tenantBusinessDna.sales.objectionHandling.valuePlaceholder')}
        emptyText={t('tenantBusinessDna.sales.objectionHandling.empty')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Appointments
 * Schema: { defaultDuration, appointmentTypes: [{ name, duration, description }],
 *           bookingPolicy, cancellationPolicy }
 * ──────────────────────────────────────────────────────────────────────── */


export function AppointmentSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  const t = useT()
  const APPOINTMENT_TYPE_SCHEMA: ObjectFieldSchema[] = [
    { key: 'name',        label: t('tenantBusinessDna.appointments.appointmentTypes.fields.name'),        type: 'text',     placeholder: t('tenantBusinessDna.appointments.appointmentTypes.fields.namePlaceholder') },
    { key: 'duration',    label: t('tenantBusinessDna.appointments.appointmentTypes.fields.duration'),    type: 'number',   unit: t('tenantBusinessDna.appointments.appointmentTypes.fields.durationUnit') },
    { key: 'description', label: t('tenantBusinessDna.appointments.appointmentTypes.fields.description'), type: 'textarea', rows: 2, placeholder: t('tenantBusinessDna.appointments.appointmentTypes.fields.descriptionPlaceholder') },
  ]
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
        label={t('tenantBusinessDna.appointments.defaultDuration.label')}
        value={asNumber(value['defaultDuration'], 30)}
        unit={t('tenantBusinessDna.appointments.defaultDuration.unit')}
        onChange={(v) => onChange(patch(value, { defaultDuration: v }))}
        description={t('tenantBusinessDna.appointments.defaultDuration.description')}
        min={5}
        disabled={disabled}
      />
      <ObjectList
        label={t('tenantBusinessDna.appointments.appointmentTypes.label')}
        values={asObjectArray(value['appointmentTypes'])}
        schema={APPOINTMENT_TYPE_SCHEMA}
        onChange={(next) => onChange(patch(value, { appointmentTypes: next }))}
        description={t('tenantBusinessDna.appointments.appointmentTypes.description')}
        itemLabel={(it, idx) => asString(it['name']) || t('tenantBusinessDna.appointments.appointmentTypes.fallbackName', { n: idx + 1 })}
        emptyText={t('tenantBusinessDna.appointments.appointmentTypes.empty')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.appointments.bookingPolicy.label')}
        value={asString(value['bookingPolicy'])}
        onChange={(v) => onChange(patch(value, { bookingPolicy: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.appointments.bookingPolicy.placeholder')}
        description={t('tenantBusinessDna.appointments.bookingPolicy.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.appointments.cancellationPolicy.label')}
        value={asString(value['cancellationPolicy'])}
        onChange={(v) => onChange(patch(value, { cancellationPolicy: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.appointments.cancellationPolicy.placeholder')}
        description={t('tenantBusinessDna.appointments.cancellationPolicy.description')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Support
 * Schema: { commonIssues: [{ issue, fix }], escalationRules: [string],
 *           supportEmail, founderContact }
 * ──────────────────────────────────────────────────────────────────────── */


export function SupportSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  const t = useT()
  const COMMON_ISSUE_SCHEMA: ObjectFieldSchema[] = [
    { key: 'issue', label: t('tenantBusinessDna.support.commonIssues.fields.issue'), type: 'text',     placeholder: t('tenantBusinessDna.support.commonIssues.fields.issuePlaceholder') },
    { key: 'fix',   label: t('tenantBusinessDna.support.commonIssues.fields.fix'),   type: 'textarea', rows: 3, placeholder: t('tenantBusinessDna.support.commonIssues.fields.fixPlaceholder') },
  ]
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
        label={t('tenantBusinessDna.support.commonIssues.label')}
        values={asObjectArray(value['commonIssues'])}
        schema={COMMON_ISSUE_SCHEMA}
        onChange={(next) => onChange(patch(value, { commonIssues: next }))}
        description={t('tenantBusinessDna.support.commonIssues.description')}
        itemLabel={(it, idx) => asString(it['issue']) || t('tenantBusinessDna.support.commonIssues.fallbackName', { n: idx + 1 })}
        emptyText={t('tenantBusinessDna.support.commonIssues.empty')}
        disabled={disabled}
      />
      <StringList
        label={t('tenantBusinessDna.support.escalationRules.label')}
        values={asStringArray(value['escalationRules'])}
        onChange={(next) => onChange(patch(value, { escalationRules: next }))}
        description={t('tenantBusinessDna.support.escalationRules.description')}
        placeholder={t('tenantBusinessDna.support.escalationRules.placeholder')}
        emptyText={t('tenantBusinessDna.support.escalationRules.empty')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.support.supportEmail.label')}
        value={asString(value['supportEmail'])}
        onChange={(v) => onChange(patch(value, { supportEmail: v }))}
        type="email"
        placeholder={t('tenantBusinessDna.support.supportEmail.placeholder')}
        description={t('tenantBusinessDna.support.supportEmail.description')}
        disabled={disabled}
      />
      <TextField
        label={t('tenantBusinessDna.support.founderContact.label')}
        value={asString(value['founderContact'])}
        onChange={(v) => onChange(patch(value, { founderContact: v }))}
        placeholder={t('tenantBusinessDna.support.founderContact.placeholder')}
        description={t('tenantBusinessDna.support.founderContact.description')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Language
 * Schema: { primaryLanguage, supportedLanguages: [string],
 *           vocabularyPreferences: [string], prohibitedLanguage: [string] }
 * ──────────────────────────────────────────────────────────────────────── */


export function LanguageSection({ value, onChange, disabled, identitySnapshot }: SectionProps) {
  const t = useT()
  const LANGUAGE_OPTIONS = [
    { value: '',           label: t('tenantBusinessDna.language.primaryLanguage.selectPlaceholder') },
    { value: 'English',    label: t('tenantBusinessDna.language.options.english') },
    { value: 'Spanish',    label: t('tenantBusinessDna.language.options.spanish') },
    { value: 'French',     label: t('tenantBusinessDna.language.options.french') },
    { value: 'German',     label: t('tenantBusinessDna.language.options.german') },
    { value: 'Portuguese', label: t('tenantBusinessDna.language.options.portuguese') },
    { value: 'Italian',    label: t('tenantBusinessDna.language.options.italian') },
  ]
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
        label={t('tenantBusinessDna.language.primaryLanguage.label')}
        value={asString(value['primaryLanguage'])}
        options={LANGUAGE_OPTIONS}
        onChange={(v) => onChange(patch(value, { primaryLanguage: v }))}
        description={t('tenantBusinessDna.language.primaryLanguage.description')}
        disabled={disabled}
      />
      <StringList
        label={t('tenantBusinessDna.language.supportedLanguages.label')}
        values={asStringArray(value['supportedLanguages'])}
        onChange={(next) => onChange(patch(value, { supportedLanguages: next }))}
        description={t('tenantBusinessDna.language.supportedLanguages.description')}
        placeholder={t('tenantBusinessDna.language.supportedLanguages.placeholder')}
        emptyText={t('tenantBusinessDna.language.supportedLanguages.empty')}
        disabled={disabled}
      />
      <StringList
        label={t('tenantBusinessDna.language.vocabularyPreferences.label')}
        values={asStringArray(value['vocabularyPreferences'])}
        onChange={(next) => onChange(patch(value, { vocabularyPreferences: next }))}
        description={t('tenantBusinessDna.language.vocabularyPreferences.description')}
        placeholder={t('tenantBusinessDna.language.vocabularyPreferences.placeholder')}
        emptyText={t('tenantBusinessDna.language.vocabularyPreferences.empty')}
        disabled={disabled}
      />
      <StringList
        label={t('tenantBusinessDna.language.prohibitedLanguage.label')}
        values={asStringArray(value['prohibitedLanguage'])}
        onChange={(next) => onChange(patch(value, { prohibitedLanguage: next }))}
        description={t('tenantBusinessDna.language.prohibitedLanguage.description')}
        placeholder={t('tenantBusinessDna.language.prohibitedLanguage.placeholder')}
        emptyText={t('tenantBusinessDna.language.prohibitedLanguage.empty')}
        disabled={disabled}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 * Compliance
 * Schema: { callRecordingConsent, dataHandling, phoneCompliance,
 *           smsCompliance, ageRestrictions }
 * ──────────────────────────────────────────────────────────────────────── */

export function ComplianceSection({ value, onChange, disabled }: SectionProps) {
  const t = useT()
  return (
    <div className="space-y-4">
      <TextArea
        label={t('tenantBusinessDna.compliance.callRecordingConsent.label')}
        value={asString(value['callRecordingConsent'])}
        onChange={(v) => onChange(patch(value, { callRecordingConsent: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.compliance.callRecordingConsent.placeholder')}
        description={t('tenantBusinessDna.compliance.callRecordingConsent.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.compliance.dataHandling.label')}
        value={asString(value['dataHandling'])}
        onChange={(v) => onChange(patch(value, { dataHandling: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.compliance.dataHandling.placeholder')}
        description={t('tenantBusinessDna.compliance.dataHandling.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.compliance.phoneCompliance.label')}
        value={asString(value['phoneCompliance'])}
        onChange={(v) => onChange(patch(value, { phoneCompliance: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.compliance.phoneCompliance.placeholder')}
        description={t('tenantBusinessDna.compliance.phoneCompliance.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.compliance.smsCompliance.label')}
        value={asString(value['smsCompliance'])}
        onChange={(v) => onChange(patch(value, { smsCompliance: v }))}
        rows={3}
        placeholder={t('tenantBusinessDna.compliance.smsCompliance.placeholder')}
        description={t('tenantBusinessDna.compliance.smsCompliance.description')}
        disabled={disabled}
      />
      <TextArea
        label={t('tenantBusinessDna.compliance.ageRestrictions.label')}
        value={asString(value['ageRestrictions'])}
        onChange={(v) => onChange(patch(value, { ageRestrictions: v }))}
        rows={2}
        placeholder={t('tenantBusinessDna.compliance.ageRestrictions.placeholder')}
        description={t('tenantBusinessDna.compliance.ageRestrictions.description')}
        disabled={disabled}
      />
    </div>
  )
}
