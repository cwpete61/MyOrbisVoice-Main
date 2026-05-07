'use client'

/**
 * Account-email row for the System Settings cards. Renders ONLY when the
 * caller passes in a current value (or null) — meaning the API returned
 * accountEmails, meaning the user is Super Admin. For non-Super admins
 * the parent passes `currentValue={undefined}` and we render nothing —
 * defense in depth on top of the API-level redaction.
 *
 * Self-saves to the same /api/admin/system-settings/<provider> endpoint
 * the rest of the card uses, so credential edits and email edits don't
 * stomp on each other.
 */

import { useState, useEffect } from 'react'
import { apiFetchRaw } from '@/hooks/useApi'

interface Props {
  provider:     'google' | 'openai' | 'gemini' | 'stripe' | 'twilio' | 'twilioTest' | 'reoon' | 'bunny' | 'smtp'
  /** Current saved email for this provider. `null` means none stored.
   *  `undefined` means the user is not Super Admin — component returns null. */
  currentValue: string | null | undefined
  onSaved?: () => void  // parent re-fetches settings if it cares
}

const PROVIDER_PATH: Record<Props['provider'], string> = {
  google:     'google',
  openai:     'openai',
  gemini:     'gemini',
  stripe:     'stripe',
  twilio:     'twilio',
  twilioTest: 'twilio-test',
  reoon:      'reoon',
  bunny:      'bunny',
  smtp:       'smtp',
}

export function AccountEmailField({ provider, currentValue, onSaved }: Props) {
  const [draft, setDraft] = useState<string>(currentValue ?? '')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If parent re-fetches and the saved value changes (e.g., after a save),
  // sync our local draft so it shows the latest.
  useEffect(() => {
    setDraft(currentValue ?? '')
  }, [currentValue])

  // Non-Super Admin path: API redacted accountEmails, so currentValue is
  // undefined. Render nothing. (For Super Admin without a saved email yet,
  // currentValue is null — different — we DO render in that case.)
  if (currentValue === undefined) return null

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetchRaw(`/api/admin/system-settings/${PROVIDER_PATH[provider]}`, {
        method: 'PATCH',
        body:   JSON.stringify({ accountEmail: draft.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { errors?: Array<{ message?: string }> }
        throw new Error(body.errors?.[0]?.message ?? `Save failed (HTTP ${res.status})`)
      }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      onSaved?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const dirty = draft.trim() !== (currentValue ?? '')
  const stored = currentValue && currentValue.length > 0

  return (
    <div
      className="rounded-lg p-3 mt-3"
      style={{ background: 'var(--surface-app)', border: '1px dashed var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Account email <span className="text-[10px] font-normal" style={{ color: 'var(--text-tertiary)' }}>· Super admin only</span>
          </p>
          <input
            type="email"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null) }}
            placeholder="account-owner@example.com"
            className="w-full px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            autoComplete="off"
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {stored
              ? <>Currently: <strong style={{ color: 'var(--text-secondary)' }}>{currentValue}</strong></>
              : <>Not set — record which login owns this API key for easier rotation later.</>}
          </p>
          {error && <p className="text-xs mt-1" style={{ color: 'oklch(55% 0.18 25)' }}>{error}</p>}
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
          style={{
            background: savedFlash ? 'oklch(85% 0.10 145)' : 'oklch(55% 0.11 193)',
            color:      savedFlash ? 'oklch(30% 0.16 145)' : 'white',
            opacity:    !dirty || saving ? 0.5 : 1,
            cursor:     !dirty || saving ? 'not-allowed' : 'pointer',
          }}
        >
          {savedFlash ? 'Saved' : saving ? 'Saving…' : 'Save email'}
        </button>
      </div>
    </div>
  )
}
