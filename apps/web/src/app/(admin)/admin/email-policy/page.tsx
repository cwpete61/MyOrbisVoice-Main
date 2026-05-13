'use client'

import { useEffect, useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface PlatformPolicy {
  dailyCap:               number
  sendWindowStartHour:    number
  sendWindowEndHour:      number
  dripIntervalSecs:       number
  bounceAutoPauseRate:    number
  complaintAutoPauseRate: number
  warningBounceRate:      number
  warningComplaintRate:   number
  bulkEvaluationWindow:   number
}

interface SuppressionRow {
  id:        string
  email:     string
  reason:    string
  tenantId:  string | null
  partnerId: string | null
  note:      string | null
  createdAt: string
}

export default function EmailPolicyPage() {
  const { data: policy, reload } = useApi<PlatformPolicy>('/api/admin/email-policy')
  const { data: suppression, reload: reloadSupp } = useApi<{ items: SuppressionRow[]; total: number }>('/api/admin/email-suppression?limit=50')

  const [form, setForm] = useState<PlatformPolicy | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { if (policy) setForm(policy) }, [policy])

  async function save() {
    if (!form) return
    setSaving(true); setMsg(''); setErr('')
    try {
      await apiFetch('/api/admin/email-policy', { method: 'PUT', body: JSON.stringify(form) })
      setMsg('Saved.')
      reload()
      setTimeout(() => setMsg(''), 2000)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  function update<K extends keyof PlatformPolicy>(k: K, v: PlatformPolicy[K]) {
    setForm(prev => prev ? { ...prev, [k]: v } : prev)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Email policy</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Platform-wide defaults for partner bulk-email sending. Per-partner overrides live on each partner&apos;s detail page.
          Partners cannot edit these values themselves.
        </p>
      </div>

      {form && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Default partner limits</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Daily cap (emails/day)" hint="Max bulk sends per partner per day. Overflow is queued for tomorrow.">
              <input type="number" min={1} max={100000} className="input" value={form.dailyCap}
                onChange={(e) => update('dailyCap', parseInt(e.target.value || '0', 10))} />
            </Field>
            <Field label="Drip interval (seconds between sends)" hint="Looks human + gives bounce tracking time to halt mid-run.">
              <input type="number" min={1} max={86400} className="input" value={form.dripIntervalSecs}
                onChange={(e) => update('dripIntervalSecs', parseInt(e.target.value || '0', 10))} />
            </Field>
            <Field label="Send window start (hour, 0-23)" hint="Local time. Worker waits for window to open before draining queue.">
              <input type="number" min={0} max={23} className="input" value={form.sendWindowStartHour}
                onChange={(e) => update('sendWindowStartHour', parseInt(e.target.value || '0', 10))} />
            </Field>
            <Field label="Send window end (hour, 0-23)" hint="Inclusive end of the daily send window.">
              <input type="number" min={0} max={23} className="input" value={form.sendWindowEndHour}
                onChange={(e) => update('sendWindowEndHour', parseInt(e.target.value || '0', 10))} />
            </Field>
          </div>

          <h2 className="text-sm font-semibold pt-4" style={{ color: 'var(--text-primary)' }}>Auto-suspension thresholds</h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Rates computed over the rolling window of the partner&apos;s most recent N outbound emails (set below).
            Crossing the auto-pause threshold suspends the partner&apos;s bulk sending and writes a notification.
            Crossing the warning threshold writes a notification only (dedup&apos;d to one per 24h).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Auto-pause bounce rate (0-1)" hint="0.05 = 5% hard bounces in the window triggers suspension.">
              <input type="number" min={0} max={1} step={0.001} className="input" value={form.bounceAutoPauseRate}
                onChange={(e) => update('bounceAutoPauseRate', parseFloat(e.target.value || '0'))} />
            </Field>
            <Field label="Auto-pause complaint rate (0-1)" hint="0.001 = 0.1% complaints triggers suspension. Industry standard.">
              <input type="number" min={0} max={1} step={0.0001} className="input" value={form.complaintAutoPauseRate}
                onChange={(e) => update('complaintAutoPauseRate', parseFloat(e.target.value || '0'))} />
            </Field>
            <Field label="Warning bounce rate (0-1)" hint="Lower than auto-pause. Notification only, no suspension.">
              <input type="number" min={0} max={1} step={0.001} className="input" value={form.warningBounceRate}
                onChange={(e) => update('warningBounceRate', parseFloat(e.target.value || '0'))} />
            </Field>
            <Field label="Warning complaint rate (0-1)" hint="Early-warning level. Notification + suggest list review.">
              <input type="number" min={0} max={1} step={0.0001} className="input" value={form.warningComplaintRate}
                onChange={(e) => update('warningComplaintRate', parseFloat(e.target.value || '0'))} />
            </Field>
            <Field label="Evaluation window (last N sends)" hint="Rolling window size for rate calculations.">
              <input type="number" min={10} max={10000} className="input" value={form.bulkEvaluationWindow}
                onChange={(e) => update('bulkEvaluationWindow', parseInt(e.target.value || '0', 10))} />
            </Field>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save defaults'}</button>
            {msg && <span className="text-xs" style={{ color: 'var(--success-600, #16a34a)' }}>{msg}</span>}
            {err && <span className="text-xs" style={{ color: 'var(--error-600)' }}>{err}</span>}
          </div>
        </div>
      )}

      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Suppression list</h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {suppression?.total ?? 0} total
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Auto-populated from ESP webhooks (hard bounces + complaints). Manual entries are added by admins or partners.
        </p>

        {suppression && suppression.items.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No suppressions yet. Once ESP webhooks fire, this list will populate automatically.</p>
        )}

        {suppression && suppression.items.length > 0 && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--surface-overlay)' }}>
                  {['Email', 'Reason', 'Scope', 'Added', 'Note', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppression.items.map((s, i) => (
                  <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>{s.email}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{s.reason}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>
                      {s.partnerId ? 'partner' : s.tenantId ? 'tenant' : 'global'}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{s.note ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove ${s.email} from the suppression list?`)) return
                          await apiFetch(`/api/admin/email-suppression/${s.id}`, { method: 'DELETE' })
                          reloadSupp()
                        }}
                        className="text-xs hover:underline"
                        style={{ color: 'var(--error-600)' }}
                      >Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>}
    </div>
  )
}
