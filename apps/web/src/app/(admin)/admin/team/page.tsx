'use client'

/**
 * Platform Users management page — Super Admin only.
 *
 * Lists current platform-staff members (users with platform_super_admin,
 * platform_admin, or platform_support role assignments) and lets the
 * Super Admin grant/change/revoke roles, edit user info, trigger
 * password resets, and disable accounts. URL stays /admin/team for
 * backward compatibility with bookmarks; sidebar label is "Users".
 */

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/hooks/useApi'

interface StaffMember {
  userId:      string
  email:       string
  username:    string | null
  firstName:   string | null
  lastName:    string | null
  status:      'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED'
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

const STATUS_PILL: Record<StaffMember['status'], { bg: string; fg: string }> = {
  ACTIVE:    { bg: 'oklch(95% 0.05 145)', fg: 'oklch(35% 0.16 145)' },
  INVITED:   { bg: 'oklch(95% 0.05 75)',  fg: 'oklch(35% 0.16 75)'  },
  SUSPENDED: { bg: 'oklch(95% 0.05 25)',  fg: 'oklch(35% 0.18 25)'  },
  DISABLED:  { bg: 'var(--surface-overlay)', fg: 'var(--text-tertiary)' },
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

function StatusPill({ status }: { status: StaffMember['status'] }) {
  const s = STATUS_PILL[status]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {status}
    </span>
  )
}

function fullName(s: StaffMember): string {
  const composed = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
  return composed || s.username || s.email
}

type SortKey = 'name' | 'email' | 'role' | 'status' | 'lastLoginAt' | 'grantedAt'
type SortDir = 'asc' | 'desc'

export default function PlatformTeamPage() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy]   = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Search + filter + sort
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFltr] = useState<string>('all')
  const [sortKey, setSortKey]     = useState<SortKey>('grantedAt')
  const [sortDir, setSortDir]     = useState<SortDir>('desc')

  // Grant form
  const [grantEmail, setGrantEmail] = useState('')
  const [grantRole, setGrantRole]   = useState<string>('platform_support')
  const [granting, setGranting]     = useState(false)

  // Edit modal
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [editForm, setEditForm] = useState<{ firstName: string; lastName: string; username: string; email: string; status: StaffMember['status'] }>({ firstName: '', lastName: '', username: '', email: '', status: 'ACTIVE' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)

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

  function clickSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Apply search + filter + sort
  const visible = useMemo(() => {
    if (!staff) return []
    let rows = staff
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(s => (
        s.email.toLowerCase().includes(q) ||
        (s.username ?? '').toLowerCase().includes(q) ||
        fullName(s).toLowerCase().includes(q)
      ))
    }
    if (roleFilter !== 'all') {
      rows = rows.filter(s => s.roleKey === roleFilter)
    }
    const sorted = [...rows].sort((a, b) => {
      let av: string | number | null = ''
      let bv: string | number | null = ''
      switch (sortKey) {
        case 'name':        av = fullName(a).toLowerCase(); bv = fullName(b).toLowerCase(); break
        case 'email':       av = a.email.toLowerCase();     bv = b.email.toLowerCase();     break
        case 'role':        av = a.roleName;                bv = b.roleName;                break
        case 'status':      av = a.status;                  bv = b.status;                  break
        case 'lastLoginAt': av = a.lastLoginAt ?? '';       bv = b.lastLoginAt ?? '';       break
        case 'grantedAt':   av = a.grantedAt;               bv = b.grantedAt;               break
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [staff, search, roleFilter, sortKey, sortDir])

  async function grant() {
    if (!grantEmail.trim()) return
    // Strong confirmation when granting Super Admin — it's a one-way
    // door (cannot be revoked from the UI, only via direct DB access).
    if (grantRole === 'platform_super_admin') {
      const ok = window.confirm(
        `Grant Super Admin to ${grantEmail.trim()}?\n\n` +
        `⚠ Super Admin cannot be revoked from the UI. Once granted, the only ` +
        `way to remove this role is direct database access.\n\n` +
        `Click OK to proceed.`,
      )
      if (!ok) return
    }
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

  async function changeRole(_userId: string, email: string, newRole: string) {
    setBusy(_userId)
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
    if (!window.confirm(`Revoke platform access from ${email}? They'll keep their account but lose all admin/support access. (To fully disable the account, use Edit → Status → DISABLED.)`)) return
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

  function openEdit(s: StaffMember) {
    setEditing(s)
    setEditForm({
      firstName: s.firstName ?? '',
      lastName:  s.lastName  ?? '',
      username:  s.username  ?? '',
      email:     s.email,
      status:    s.status,
    })
    setEditError(null)
  }

  async function saveEdit() {
    if (!editing) return
    setEditSaving(true)
    setEditError(null)
    try {
      const body: Record<string, string> = {}
      if (editForm.firstName !== (editing.firstName ?? '')) body['firstName'] = editForm.firstName
      if (editForm.lastName  !== (editing.lastName  ?? '')) body['lastName']  = editForm.lastName
      if (editForm.username  !== (editing.username  ?? '')) body['username']  = editForm.username
      if (editForm.email     !== editing.email)             body['email']     = editForm.email
      if (editForm.status    !== editing.status)            body['status']    = editForm.status
      if (Object.keys(body).length === 0) {
        setEditing(null)
        return
      }
      await apiFetch(`/api/admin/platform-staff/${editing.userId}`, {
        method: 'PATCH',
        body:   JSON.stringify(body),
      })
      showToast('success', `Updated ${editing.email}`)
      setEditing(null)
      await load()
    } catch (e) {
      setEditError((e as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  async function sendPasswordReset(s: StaffMember) {
    if (!window.confirm(`Send password reset email to ${s.email}? They'll receive a link valid for 15 minutes.`)) return
    setBusy(s.userId)
    try {
      await apiFetch(`/api/admin/platform-staff/${s.userId}/password-reset`, { method: 'POST' })
      showToast('success', `Password reset sent to ${s.email}`)
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function disableUser(s: StaffMember) {
    if (!window.confirm(`Disable account ${s.email}? They won't be able to sign in. This is reversible — you can re-enable via Edit → Status → ACTIVE.`)) return
    setBusy(s.userId)
    try {
      await apiFetch(`/api/admin/platform-staff/${s.userId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ status: 'DISABLED' }),
      })
      showToast('success', `Disabled ${s.email}`)
      await load()
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const isActive = sortKey === k
    const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
    return (
      <th
        onClick={() => clickSort(k)}
        className="text-left px-4 py-2 text-xs uppercase tracking-wide cursor-pointer select-none"
        style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
      >
        {label}{arrow}
      </th>
    )
  }

  if (error) return <div className="p-8"><div className="alert-error">{error}</div></div>
  if (!staff) return <div className="p-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading users…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Users
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Platform-side staff (Super Admin, Admin, Support) who can access the admin dashboard. Tenant users and partners are managed elsewhere.
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

      {/* Toolbar — search + filter */}
      <div className="rounded-xl p-3 flex items-center gap-3 flex-wrap" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <input
          type="text"
          placeholder="Search by name, email, or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[200px]"
          style={{ maxWidth: '400px' }}
        />
        <div className="flex items-center gap-1.5">
          {[
            { value: 'all', label: 'All' },
            { value: 'platform_super_admin', label: 'Super' },
            { value: 'platform_admin', label: 'Admin' },
            { value: 'platform_support', label: 'Support' },
          ].map(chip => {
            const active = roleFilter === chip.value
            return (
              <button
                key={chip.value}
                onClick={() => setRoleFltr(chip.value)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{
                  background: active ? 'oklch(55% 0.11 193)' : 'var(--surface-overlay)',
                  color:      active ? 'white' : 'var(--text-secondary)',
                  border:     '1px solid var(--border-subtle)',
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          Showing {visible.length} of {staff.length}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        {visible.length === 0 ? (
          <div className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
            {staff.length === 0 ? 'No platform staff yet. Grant the first role above.' : 'No users match your search/filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-app)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <SortHeader label="User"        k="name" />
                  <SortHeader label="Email"       k="email" />
                  <SortHeader label="Role"        k="role" />
                  <SortHeader label="Status"      k="status" />
                  <SortHeader label="Last login"  k="lastLoginAt" />
                  <SortHeader label="Granted"     k="grantedAt" />
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr key={s.userId} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--text-primary)' }}>{fullName(s)}</div>
                      {s.username && <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>@{s.username}</div>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{s.email}</td>
                    <td className="px-4 py-3"><RolePill roleKey={s.roleKey} roleName={s.roleName} /></td>
                    <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(s.grantedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5 flex-wrap justify-end">
                        {s.roleKey === 'platform_super_admin' ? (
                          // Super Admin is locked from team-management actions
                          // (intentional, see CLAUDE.md / assertNotSuperAdmin in
                          // admin.ts). Only password reset is available.
                          <button
                            onClick={() => sendPasswordReset(s)}
                            disabled={busy === s.userId || s.status === 'DISABLED' || s.status === 'SUSPENDED'}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: s.status === 'DISABLED' || s.status === 'SUSPENDED' ? 0.4 : 1 }}
                            title="Send password reset email — the only admin-side action permitted on a Super Admin"
                          >
                            Reset password
                          </button>
                        ) : (
                          <>
                            <select
                              value={s.roleKey}
                              onChange={(e) => changeRole(s.userId, s.email, e.target.value)}
                              disabled={busy === s.userId}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                              title="Change role"
                            >
                              {/* Cannot promote to Super Admin from this dropdown
                                  either — Super Admin is granted only by another
                                  Super Admin via the explicit grant form above. */}
                              {ROLE_OPTIONS.filter(r => r.value !== 'platform_super_admin').map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <button
                              onClick={() => openEdit(s)}
                              disabled={busy === s.userId}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                              title="Edit name, email, status"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => sendPasswordReset(s)}
                              disabled={busy === s.userId || s.status === 'DISABLED' || s.status === 'SUSPENDED'}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', opacity: s.status === 'DISABLED' || s.status === 'SUSPENDED' ? 0.4 : 1 }}
                              title="Send password reset email"
                            >
                              Reset password
                            </button>
                            {s.status !== 'DISABLED' && (
                              <button
                                onClick={() => disableUser(s)}
                                disabled={busy === s.userId}
                                className="text-xs px-2 py-1 rounded"
                                style={{ background: 'transparent', border: '1px solid oklch(70% 0.12 75)', color: 'oklch(50% 0.18 75)' }}
                                title="Disable account (reversible)"
                              >
                                Disable
                              </button>
                            )}
                            <button
                              onClick={() => revoke(s.userId, s.email)}
                              disabled={busy === s.userId}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'transparent', border: '1px solid oklch(70% 0.12 25)', color: 'oklch(50% 0.18 25)' }}
                              title="Revoke platform role (keeps account)"
                            >
                              {busy === s.userId ? 'Working…' : 'Revoke'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => !editSaving && setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Edit user
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First name</label>
                  <input className="input" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input className="input" value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} placeholder="(none)" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as StaffMember['status'] }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INVITED">Invited</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DISABLED">Disabled</option>
                </select>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  Suspended/Disabled users can&apos;t sign in. Disabled is the standard soft-delete state.
                </p>
              </div>
              {editError && <div className="alert-error text-xs">{editError}</div>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => !editSaving && setEditing(null)}
                disabled={editSaving}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button onClick={saveEdit} disabled={editSaving} className="btn-primary">
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
