'use client'

/**
 * "My Twilio Numbers" — combined view of every Twilio subaccount the
 * current user owns (tenant + partner). Move button hits preflight first;
 * confirmed transfer calls /api/me/twilio/transfer which fires Twilio's
 * cross-subaccount move + DB swap atomically.
 */

import { useEffect, useState } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'

interface InvNumber {
  id: string
  e164Number: string
  displayLabel: string | null
  notes: string | null
  isInboundEnabled: boolean
  isOutboundEnabled: boolean
  isSmsEnabled: boolean
  monthlyPriceCents: number | null
  partnerCapabilityTier: string | null
  a2pStatus: string
  purchaseStatus: string
  createdAt: string
  dbTracked: boolean
}
interface UntrackedNumber {
  twilioNumberSid: string
  e164Number: string
  friendlyName: string | null
  capabilities: { voice: boolean; sms: boolean; mms: boolean; fax: boolean }
  dateCreated: string | null
}
interface InvSubaccount {
  kind: 'tenant' | 'partner'
  subaccountRecordId: string
  twilioSubaccountSid: string
  ownerEntityId: string
  label: string
  status: string
  numbers: InvNumber[]
  untracked: UntrackedNumber[]
  liveSyncError: string | null
}
interface EligibleLinkTarget { kind: 'tenant' | 'partner'; id: string; label: string }
interface Inventory {
  subaccounts: InvSubaccount[]
  canTransfer: boolean
  eligibleLinkTargets: EligibleLinkTarget[]
}

const KIND_COLORS: Record<'tenant' | 'partner', { bg: string; fg: string; border: string }> = {
  tenant:  { bg: 'rgba(63, 227, 227, 0.10)', fg: 'oklch(55% 0.11 193)', border: 'oklch(55% 0.11 193 / 0.35)' },
  partner: { bg: 'rgba(245, 158, 11, 0.12)', fg: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)' },
}

interface TransferTarget {
  numberId: string
  e164Number: string
  fromSub: InvSubaccount
  toSub: InvSubaccount
}

interface PreflightWarning { code: string; message: string }
interface PreflightBlocker { code: string; message: string }
interface PreflightResult {
  numberId: string
  e164Number: string
  source: { kind: string; sid: string; label: string }
  target: { kind: string; sid: string; label: string }
  warnings: PreflightWarning[]
  blockers: PreflightBlocker[]
  ok: boolean
}

export default function MyTwilioPage() {
  const { data, loading, error, reload } = useApi<Inventory>('/api/me/twilio/inventory')
  const [transferOpen, setTransferOpen] = useState<TransferTarget | null>(null)
  const [adoptingSid, setAdoptingSid] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  async function adoptNumber(subaccountRecordId: string, twilioPhoneSid: string, e164: string) {
    setAdoptingSid(twilioPhoneSid)
    try {
      await apiFetch<{ phoneNumberId: string; e164Number: string }>('/api/me/twilio/adopt-number', {
        method: 'POST',
        body: JSON.stringify({ subaccountRecordId, twilioPhoneSid }),
      })
      setStatusMsg(`✓ Adopted ${e164}. The number is now manageable from your tenant or partner numbers page.`)
      reload()
      setTimeout(() => setStatusMsg(null), 8000)
    } catch (err) {
      setStatusMsg(`Error adopting ${e164}: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setAdoptingSid(null)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>My Twilio Numbers</h1>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: 760, lineHeight: 1.55 }}>
            Every Twilio subaccount you own. We pull the live number list from
            Twilio so you can <strong>Adopt</strong> any number that exists on
            Twilio but isn't tracked here yet, and <strong>Move</strong>{' '}
            numbers between your tenant and partner sides.
          </p>
        </div>
        {data && data.eligibleLinkTargets.length > 0 && (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#04151A',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '0.88rem',
            }}
          >
            + Link existing Twilio subaccount
          </button>
        )}
      </header>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
      {error && <p style={{ color: '#ef4444' }}>Error: {String(error)}</p>}

      {data && data.subaccounts.length === 0 && (
        <div
          style={{
            border: '1px dashed var(--border-strong)',
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          You don't own any Twilio subaccounts yet. They're created automatically
          on your first phone-number purchase (tenant or partner).
        </div>
      )}

      {data && data.subaccounts.length === 1 && (
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.88rem',
          }}
        >
          You currently have one Twilio subaccount. When you own both a tenant
          account and a partner account, you'll be able to move numbers between
          them from this page.
        </div>
      )}

      {data && data.subaccounts.length >= 2 && (
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            background: 'rgba(16, 185, 129, 0.08)',
            color: 'var(--text-primary)',
            fontSize: '0.88rem',
          }}
        >
          ✓ You own {data.subaccounts.length} Twilio subaccounts. Click <strong>Move →</strong>{' '}
          on any number to transfer it to one of your other subaccounts.
        </div>
      )}

      {statusMsg && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(63, 227, 227, 0.10)', color: 'var(--text-primary)', fontSize: '0.88rem', border: '1px solid var(--border-subtle)' }}>
          {statusMsg}
        </div>
      )}

      {data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: data.subaccounts.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 16,
          }}
        >
          {data.subaccounts.map((sub) => (
            <SubaccountCard
              key={sub.subaccountRecordId}
              sub={sub}
              otherSubs={data.subaccounts.filter((s) => s.subaccountRecordId !== sub.subaccountRecordId)}
              onMove={(n, toSub) => setTransferOpen({ numberId: n.id, e164Number: n.e164Number, fromSub: sub, toSub })}
              onAdopt={(twilioPhoneSid, e164) => adoptNumber(sub.subaccountRecordId, twilioPhoneSid, e164)}
              adoptingSid={adoptingSid}
            />
          ))}
        </div>
      )}

      {linkOpen && data && (
        <LinkSubaccountModal
          targets={data.eligibleLinkTargets}
          onClose={() => setLinkOpen(false)}
          onLinked={(msg) => {
            setLinkOpen(false)
            setStatusMsg(msg)
            reload()
            setTimeout(() => setStatusMsg(null), 8000)
          }}
        />
      )}

      {transferOpen && (
        <TransferModal
          target={transferOpen}
          onClose={() => setTransferOpen(null)}
          onCompleted={(msg) => {
            setTransferOpen(null)
            setStatusMsg(msg)
            reload()
            setTimeout(() => setStatusMsg(null), 8000)
          }}
          onError={(msg) => setStatusMsg(`Error: ${msg}`)}
        />
      )}
    </div>
  )
}

function SubaccountCard({
  sub, otherSubs, onMove, onAdopt, adoptingSid,
}: {
  sub: InvSubaccount
  otherSubs: InvSubaccount[]
  onMove: (n: InvNumber, toSub: InvSubaccount) => void
  onAdopt: (twilioPhoneSid: string, e164: string) => void
  adoptingSid: string | null
}) {
  const colors = KIND_COLORS[sub.kind]
  return (
    <section
      style={{
        background: 'var(--surface)',
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{sub.label}</h2>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: colors.bg,
                color: colors.fg,
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {sub.kind}
            </span>
            {sub.status !== 'ACTIVE' && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(239,68,68,0.15)',
                  color: '#ef4444',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {sub.status}
              </span>
            )}
          </div>
          <code style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{sub.twilioSubaccountSid}</code>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {sub.numbers.length} number{sub.numbers.length === 1 ? '' : 's'}
        </span>
      </header>

      {sub.liveSyncError && (
        <div style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Live sync warning: {sub.liveSyncError}. Showing DB-known numbers only.
        </div>
      )}

      {sub.numbers.length === 0 && sub.untracked.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', margin: 0, padding: '14px 0', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>
          No numbers on this subaccount yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {sub.numbers.map((n) => (
            <li key={n.id}>
              <NumberRow n={n} otherSubs={otherSubs} onMove={(toSub) => onMove(n, toSub)} />
            </li>
          ))}
        </ul>
      )}

      {sub.untracked.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            On Twilio, not yet tracked ({sub.untracked.length})
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {sub.untracked.map((u) => (
              <li key={u.twilioNumberSid}>
                <UntrackedRow
                  u={u}
                  busy={adoptingSid === u.twilioNumberSid}
                  onAdopt={() => onAdopt(u.twilioNumberSid, u.e164Number)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function UntrackedRow({ u, busy, onAdopt }: { u: UntrackedNumber; busy: boolean; onAdopt: () => void }) {
  return (
    <div style={{
      background: 'var(--background)',
      border: '1px dashed var(--border-subtle)',
      borderRadius: 8,
      padding: '10px 12px',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 10,
      alignItems: 'center',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <code style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{u.e164Number}</code>
          {u.friendlyName && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>· {u.friendlyName}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
          {u.capabilities.voice && <span>📞 voice</span>}
          {u.capabilities.sms && <span>✉ sms</span>}
          {u.capabilities.mms && <span>🖼 mms</span>}
          <span>· SID {u.twilioNumberSid.slice(0, 10)}…</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdopt}
        disabled={busy}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--accent)',
          background: busy ? 'var(--surface-overlay)' : 'var(--accent)',
          color: busy ? 'var(--text-secondary)' : '#04151A',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {busy ? 'Adopting…' : 'Adopt'}
      </button>
    </div>
  )
}

function NumberRow({
  n, otherSubs, onMove,
}: {
  n: InvNumber
  otherSubs: InvSubaccount[]
  onMove: (toSub: InvSubaccount) => void
}) {
  return (
    <div
      style={{
        background: 'var(--background)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <code style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.e164Number}</code>
          {n.displayLabel && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>· {n.displayLabel}</span>
          )}
          {n.partnerCapabilityTier && (
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--surface-overlay)',
                color: 'var(--text-tertiary)',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {n.partnerCapabilityTier}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
          {n.isInboundEnabled && <span>📥 inbound</span>}
          {n.isOutboundEnabled && <span>📤 outbound</span>}
          {n.isSmsEnabled && <span>✉ sms</span>}
          {n.a2pStatus !== 'NOT_REQUIRED' && <span>A2P: {n.a2pStatus}</span>}
          {n.purchaseStatus !== 'PURCHASED' && (
            <span style={{ color: '#f59e0b' }}>· {n.purchaseStatus}</span>
          )}
        </div>
      </div>
      {otherSubs.length === 0 ? (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>no target</span>
      ) : otherSubs.length === 1 ? (
        <button
          type="button"
          onClick={() => onMove(otherSubs[0]!)}
          style={moveBtnStyle}
        >
          Move → {otherSubs[0]!.label}
        </button>
      ) : (
        <select
          defaultValue=""
          onChange={(e) => {
            const target = otherSubs.find((s) => s.subaccountRecordId === e.target.value)
            if (target) onMove(target)
            e.target.value = ''
          }}
          style={{ ...moveBtnStyle, appearance: 'auto' as const }}
        >
          <option value="" disabled>Move to…</option>
          {otherSubs.map((s) => (
            <option key={s.subaccountRecordId} value={s.subaccountRecordId}>{s.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

const moveBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--accent)',
  background: 'transparent',
  color: 'var(--accent-hi)',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

// ─── Transfer modal ────────────────────────────────────────────────────────
//
// Two-stage: (1) call preflight to surface warnings + blockers; (2) on
// confirm, call the live transfer endpoint. We deliberately do NOT show the
// confirm button until preflight returns to avoid users clicking through
// before seeing the A2P re-registration warning.
function TransferModal({
  target, onClose, onCompleted, onError,
}: {
  target: TransferTarget
  onClose: () => void
  onCompleted: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [preflightErr, setPreflightErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Build the API-shape target object once.
  function buildTarget() {
    return target.toSub.kind === 'tenant'
      ? { kind: 'tenant' as const, tenantId: target.toSub.ownerEntityId }
      : { kind: 'partner' as const, partnerId: target.toSub.ownerEntityId }
  }

  // Kick off preflight on mount.
  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<PreflightResult>('/api/me/twilio/transfer/preflight', {
          method: 'POST',
          body: JSON.stringify({ numberId: target.numberId, target: buildTarget() }),
        })
        setPreflight(res)
      } catch (err) {
        setPreflightErr(err instanceof Error ? err.message : 'Preflight failed')
      } finally { setLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.numberId])

  async function confirm() {
    if (!preflight?.ok) return
    setSubmitting(true)
    try {
      const res = await apiFetch<{ numberId: string; e164Number: string; fromSubaccountSid: string; toSubaccountSid: string }>(
        '/api/me/twilio/transfer',
        {
          method: 'POST',
          body: JSON.stringify({ numberId: target.numberId, target: buildTarget() }),
        },
      )
      onCompleted(`✓ Moved ${res.e164Number} to ${target.toSub.label}. A2P + agent + webhooks may need reconfiguring on the new owner.`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Transfer failed')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div className="rounded-xl w-full max-w-lg p-5"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Move number to {target.toSub.label}
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          <code style={{ color: 'var(--text-primary)' }}>{target.e164Number}</code>
          <span style={{ margin: '0 8px' }}>·</span>
          {target.fromSub.label} <span style={{ margin: '0 4px' }}>→</span> {target.toSub.label}
        </p>

        {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Running pre-flight…</p>}
        {preflightErr && <p style={{ color: '#ef4444', fontSize: '0.88rem' }}>Pre-flight error: {preflightErr}</p>}

        {preflight && (
          <>
            {preflight.blockers.length > 0 && (
              <div className="mb-3 p-3 rounded" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Cannot transfer:</p>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  {preflight.blockers.map((b) => <li key={b.code}>{b.message}</li>)}
                </ul>
              </div>
            )}

            {preflight.warnings.length > 0 && (
              <div className="mb-3 p-3 rounded" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>Heads up:</p>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  {preflight.warnings.map((w) => <li key={w.code} style={{ marginBottom: 4 }}>{w.message}</li>)}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={confirm}
            disabled={!preflight?.ok || submitting}
            className="flex-1 text-sm py-2 rounded font-medium disabled:opacity-40"
            style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}
          >
            {submitting ? 'Moving…' : 'Confirm move'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-4 py-2 rounded"
            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Link existing Twilio subaccount modal ─────────────────────────────────
function LinkSubaccountModal({
  targets, onClose, onLinked,
}: {
  targets: EligibleLinkTarget[]
  onClose: () => void
  onLinked: (msg: string) => void
}) {
  const [sid, setSid] = useState('')
  const [token, setToken] = useState('')
  const [targetKey, setTargetKey] = useState(targets[0] ? `${targets[0].kind}:${targets[0].id}` : '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!sid.trim() || !token.trim() || !targetKey) {
      setErr('All fields are required')
      return
    }
    const [kind, id] = targetKey.split(':') as ['tenant' | 'partner', string]
    const target = kind === 'tenant' ? { kind: 'tenant' as const, tenantId: id } : { kind: 'partner' as const, partnerId: id }
    setSubmitting(true)
    try {
      const res = await apiFetch<{ twilioSubaccountSid: string; twilioFriendlyName: string | null }>(
        '/api/me/twilio/link-subaccount',
        {
          method: 'POST',
          body: JSON.stringify({
            twilioSubaccountSid: sid.trim(),
            authToken:           token.trim(),
            target,
          }),
        },
      )
      onLinked(`✓ Linked Twilio subaccount ${res.twilioFriendlyName ?? res.twilioSubaccountSid}. Its numbers will appear here.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Link failed')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div className="rounded-xl w-full max-w-lg p-5"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Link an existing Twilio subaccount
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Enter the subaccount SID + its auth token. We verify with Twilio,
          then surface its numbers here so you can adopt + assign them.
        </p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Twilio Subaccount SID</span>
            <input
              type="text"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={sid}
              onChange={(ev) => setSid(ev.target.value)}
              style={inputStyle}
              autoFocus
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Subaccount Auth Token</span>
            <input
              type="password"
              placeholder="Stored encrypted — write-only after save"
              value={token}
              onChange={(ev) => setToken(ev.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Attach to</span>
            <select value={targetKey} onChange={(ev) => setTargetKey(ev.target.value)} style={inputStyle}>
              {targets.map((t) => (
                <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>
                  {t.kind === 'tenant' ? 'Tenant: ' : 'Partner: '}{t.label}
                </option>
              ))}
            </select>
          </label>
          {err && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{err}</p>}
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 text-sm py-2 rounded font-medium disabled:opacity-40"
              style={{ background: 'oklch(55% 0.11 193)', color: 'white' }}
            >
              {submitting ? 'Verifying…' : 'Verify + Link'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm px-4 py-2 rounded"
              style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--background)',
  color: 'var(--text-primary)',
  fontSize: '0.92rem',
  fontFamily: 'inherit',
}
