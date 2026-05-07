'use client'

/**
 * Platform Team management page — Super Admin only.
 *
 * Lists current platform-staff members (users with platform_super_admin,
 * platform_admin, or platform_support role assignments) and lets the
 * Super Admin grant the role to an existing user by email, change a
 * user's role, or revoke a user from the team.
 *
 * v1 scope: the user being granted must already exist in the platform
 * (i.e., they signed up at app.myorbisvoice.com/signup at some point).
 * Email-magic-link invite for brand-new users is a v2 follow-up.
 */

import { useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

interface StaffMember {
  userId:      string
  email:       string
  username:    string | null
  firstName:   string | null
  lastName:    string | null
  status:      string
  roleKey:     string
  roleName:    string
  lastLoginAt: string | null
  grantedAt:   string
}

const ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'platform_super_admin', label: 'Super Admin', description: 'Full access — secrets, billing, team management. Use sparingly.' },
  { value: 'platform_admin',       label: 'Admin',       description: 'Tenant management, plans, comp codes, A2P. Cannot edit credentials or manage other staff.' },
  { value: 'platform_support',     label: 'Support',     description: 'Read access + impersonation. Cannot perform privileged writes.' },
]

const ROLE_PILL: Record<string, { bg: string; fg: string }> = {
  platform_super_admin: { bg: 'oklch(95% 0.06 25)',  fg: 'oklch(35% 0.18 25)'  },
  platform_admin:       { bg: 'oklch(95% 0.06 270)', fg: 'oklch(35% 0.16 270)' },
  platform_support:     { bg: 'oklch(95% 0.06 230)', fg: 'oklch(35% 0.18 230)' },
}

function RolePill({ roleKey, roleName }: { roleKey: string; roleName: string }) {
  const s = ROLE_PILL[roleKey] ?? { bg: 'var(--surface-overlay)', fg: 'var(--text-secondary)' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {roleName}
    </span>
  )
}

export default function PlatformTeamPage() {
  const [staff, setStaff]     = useState<StaffMember[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState<string | null>(null)
  const [toast, setToast]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Grant form
  const [grantEmail, setGrantEmail] = useState('')
  const [grantRole, setGrantRole]   = useState<string>('platform_support')
  const [granting, setGranting]     = useState(false)

  async function load() {
    try {
      const list = await apiFetch<StaffMember[]>('/api/admin/platform-staff')
      setStaff(list)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => { void load() }, [])

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4500)
  }

  async function grant() {
    if (!grantEmail.trim()) return
    setGranting(true)
    try {
      await apiFetch('/api/admin/platform-staff/grant', {
        method: 'POST',
        body:   JSON.stringify({ email: grantEmail.trim(), roleKey: grantRole }),
      })
      showToast('success', `${grantEmail.trim()} granted ${ROLE_OPTIONS.find(r => r.value === grantRole)?.label}`)
      setGrantEmail('')
      await load()
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setGranting(false)
    }
  }

  async function changeRole(userId: string, email: string, newRole: string) {
    setBusy(userId)
    try {
      await apiFetch('/api/admin/platform-staff/grant', {
        method: 'POST',
        body:   JSON.stringify({ email, roleKey: newRole }),
      })
      showToast('success', `Role updated`)
      await load()
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function revoke(userId: string, email: string) {
    if (!window.confirm(`Revoke platform access from ${email}? They'll keep their account but lose all admin/support access.`)) return
    setBusy(userId)
    try {
      await apiFetch(`/api/admin/platform-staff/${userId}`, { method: 'DELETE' })
      showToast('success', `Revoked ${email}`)
      await load()
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (error) return <div className="p-8"><div className="alert-error">{error}</div></div>
  if (!staff) return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading platform team…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Platform Team
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Users who can access this admin dashboard. Each role has a different set of permissions — see the description on the role dropdown when granting access.
        </p>
      </div>

      {toast && (
        <div className={toast.type === 'success' ? 'alert-success' : 'alert-error'}>{toast.text}</div>
      )}

      {/* Grant role form */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Grant a platform role</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          The user must already have an account at <code>app.myorbisvoice.com</code>. Granting them a platform role lets them sign in and access the admin dashboard at this user's permission level.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="email"
            placeholder="user@example.com"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            className="input sm:col-span-1"
          />
          <select
            value={grantRole}
            onChange={(e) => setGrantRole(e.target.value)}
            className="input sm:col-span-1"
          >
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button
            onClick={grant}
            disabled={!grantEmail.trim() || granting}
            className="btn-primary sm:col-span-1"
          >
            {granting ? 'Granting…' : 'Grant role'}
          </button>
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-tertiary)' }}>
          {ROLE_OPTIONS.find(r => r.value === grantRole)?.description}
        </p>
      </div>

      {/* Current staff table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Current platform team ({staff.length})
          </h2>
        </div>
        {staff.length === 0 ? (
          <div className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
            No platform staff yet. Grant the first role above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-app)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>User</th>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Role</th>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Last login</th>
                <th className="text-left px-4 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Granted</th>
                <th className="text-right px-4 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s, i) => (
                <tr key={s.userId} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                  <td className="px-4 py-3">
                    <div style={{ color: 'var(--text-primary)' }}>{s.firstName || s.lastName ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() : s.username ?? s.email}</div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.email}</div>
                  </td>
                  <td className="px-4 py-3"><RolePill roleKey={s.roleKey} roleName={s.roleName} /></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(s.grantedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <select
                        value={s.roleKey}
                        onChange={(e) => changeRole(s.userId, s.email, e.target.value)}
                        disabled={busy === s.userId}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      >
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <button
                        onClick={() => revoke(s.userId, s.email)}
                        disabled={busy === s.userId}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: 'transparent',
                          border:     '1px solid oklch(70% 0.12 25)',
                          color:      'oklch(50% 0.18 25)',
                          opacity:    busy === s.userId ? 0.5 : 1,
                        }}
                      >
                        {busy === s.userId ? 'Working…' : 'Revoke'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
