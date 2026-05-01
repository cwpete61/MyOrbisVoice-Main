'use client'

import { useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface PhoneNumber {
  id: string
  e164Number: string
  displayLabel: string | null
  isInboundEnabled: boolean
  isOutboundEnabled: boolean
  isSmsEnabled: boolean
  forwardingTarget: string | null
  twilioNumberSid: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.myorbisvoice.com'

const VOICE_WEBHOOK_URL  = `${API_BASE}/api/webhooks/twilio/voice`
const STATUS_WEBHOOK_URL = `${API_BASE}/api/webhooks/twilio/status`

const inp  = 'w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2'
const inpS = `${inp} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-blue-500`

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
      style={{ background: checked ? 'oklch(55% 0.11 193)' : 'var(--border-subtle)' }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

export default function PhoneNumbersPage() {
  const { data: numbers, loading, reload } = useApi<PhoneNumber[]>('/api/phone-numbers')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [form, setForm] = useState({
    e164Number: '+1',
    displayLabel: '',
    twilioNumberSid: '',
    isInboundEnabled: true,
    isOutboundEnabled: false,
    isSmsEnabled: false,
    forwardingTarget: '',
  })

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  function resetForm() {
    setForm({ e164Number: '+1', displayLabel: '', twilioNumberSid: '', isInboundEnabled: true, isOutboundEnabled: false, isSmsEnabled: false, forwardingTarget: '' })
    setError('')
  }

  function startAdd() { resetForm(); setAdding(true); setEditId(null) }

  function startEdit(n: PhoneNumber) {
    setForm({
      e164Number:       n.e164Number,
      displayLabel:     n.displayLabel ?? '',
      twilioNumberSid:  n.twilioNumberSid ?? '',
      isInboundEnabled:  n.isInboundEnabled,
      isOutboundEnabled: n.isOutboundEnabled,
      isSmsEnabled:      n.isSmsEnabled,
      forwardingTarget:  n.forwardingTarget ?? '',
    })
    setEditId(n.id)
    setAdding(false)
    setError('')
  }

  async function save() {
    if (!form.e164Number.match(/^\+[1-9]\d{7,14}$/)) {
      setError('Phone number must be E.164 format, e.g. +18005551234')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        e164Number:        form.e164Number,
        displayLabel:      form.displayLabel || null,
        twilioNumberSid:   form.twilioNumberSid || null,
        isInboundEnabled:  form.isInboundEnabled,
        isOutboundEnabled: form.isOutboundEnabled,
        isSmsEnabled:      form.isSmsEnabled,
        forwardingTarget:  form.forwardingTarget || null,
      }
      if (editId) {
        await apiFetch(`/api/phone-numbers/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
        showToast('Number updated.')
        setEditId(null)
      } else {
        await apiFetch('/api/phone-numbers', { method: 'POST', body: JSON.stringify(body) })
        showToast('Number added.')
        setAdding(false)
      }
      resetForm()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteNumber(id: string, num: string) {
    if (!confirm(`Remove ${num}? Inbound calls to this number will stop routing.`)) return
    try {
      await apiFetch(`/api/phone-numbers/${id}`, { method: 'DELETE' })
      showToast('Number removed.')
      reload()
    } catch { showToast('Failed to remove number.') }
  }

  const list = numbers ?? []

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Phone Numbers</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Manage your Twilio numbers for inbound and outbound calling.
          </p>
        </div>
        <button onClick={startAdd} className="btn-primary text-sm px-4 py-2">+ Add number</button>
      </div>

      {/* Webhook reference card */}
      <div className="mt-6 mb-6 rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Twilio Console Webhook URLs</p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          Set these on each number in your Twilio Console under Voice &amp; Fax settings.
        </p>
        <div className="space-y-2">
          {[
            { label: 'Voice webhook (POST)', url: VOICE_WEBHOOK_URL },
            { label: 'Status callback (POST)', url: STATUS_WEBHOOK_URL },
          ].map(({ label, url }) => (
            <div key={url} className="flex items-center gap-2">
              <span className="text-xs w-44 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
              <code
                className="flex-1 text-xs px-2 py-1 rounded truncate"
                style={{ background: 'var(--surface-sunken)', color: 'oklch(55% 0.11 193)' }}
              >
                {url}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(url); showToast('Copied!') }}
                className="text-xs px-2 py-1 rounded border flex-shrink-0"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>
          {toast}
        </div>
      )}

      {/* Add / Edit form */}
      {(adding || editId) && (
        <div className="mb-6 rounded-xl border p-5" style={{ borderColor: 'oklch(55% 0.11 193 / 0.3)', background: 'var(--surface-raised)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editId ? 'Edit number' : 'Add number'}
          </h2>

          {error && <div className="alert-error mb-4 text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone number (E.164)</label>
              <input className={inpS} value={form.e164Number}
                onChange={e => setForm(f => ({ ...f, e164Number: e.target.value }))}
                placeholder="+18005551234" />
            </div>
            <div>
              <label className="label">Label (optional)</label>
              <input className={inpS} value={form.displayLabel}
                onChange={e => setForm(f => ({ ...f, displayLabel: e.target.value }))}
                placeholder="Main office line" />
            </div>
            <div>
              <label className="label">Twilio Number SID (optional)</label>
              <input className={inpS} value={form.twilioNumberSid}
                onChange={e => setForm(f => ({ ...f, twilioNumberSid: e.target.value }))}
                placeholder="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </div>
            <div>
              <label className="label">Forwarding number (optional)</label>
              <input className={inpS} value={form.forwardingTarget}
                onChange={e => setForm(f => ({ ...f, forwardingTarget: e.target.value }))}
                placeholder="+18005559999" />
            </div>
          </div>

          <div className="flex gap-6 mt-4">
            {([
              ['isInboundEnabled',  'Inbound'],
              ['isOutboundEnabled', 'Outbound'],
              ['isSmsEnabled',      'SMS'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <Toggle
                  checked={form[key]}
                  onChange={v => setForm(f => ({ ...f, [key]: v }))}
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={save} disabled={saving} className="btn-primary text-sm px-4 py-2">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setEditId(null); resetForm() }}
              className="btn-ghost text-sm px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Numbers list */}
      {loading ? (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div className="text-sm py-8 text-center rounded-xl border" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}>
          No phone numbers yet. Add one to enable inbound calling.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
          {list.map((n, i) => (
            <div
              key={n.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: 'var(--surface-raised)',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {n.e164Number}
                  </span>
                  {n.displayLabel && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{n.displayLabel}</span>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  {n.isInboundEnabled  && <Badge color="193">Inbound</Badge>}
                  {n.isOutboundEnabled && <Badge color="260">Outbound</Badge>}
                  {n.isSmsEnabled      && <Badge color="140">SMS</Badge>}
                  {!n.isInboundEnabled && !n.isOutboundEnabled && !n.isSmsEnabled && (
                    <Badge color="0">Inactive</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => startEdit(n)}
                  className="text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteNumber(n.id, n.e164Number)}
                  className="text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: 'oklch(55% 0.14 25 / 0.3)', color: 'oklch(60% 0.18 25)' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{
        background: `oklch(55% 0.11 ${color} / 0.15)`,
        color: `oklch(65% 0.12 ${color})`,
      }}
    >
      {children}
    </span>
  )
}
