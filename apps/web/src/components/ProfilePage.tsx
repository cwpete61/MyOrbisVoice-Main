'use client'

import { useState, useEffect } from 'react'
import { apiFetch, apiFetchRaw, useApi } from '@/hooks/useApi'
import { getTokenPayload } from '@/lib/auth'

interface UserMe {
  user: {
    id: string
    email: string
    username: string | null
    firstName: string | null
    lastName: string | null
    status: string
    createdAt: string
    lastLoginAt: string | null
  }
  memberships: {
    tenantId: string
    tenantName: string
    roleKey: string
    isPlatformRole: boolean
    isOwner: boolean
  }[]
}

interface BillingData {
  subscription: {
    status: string
    plan: { name: string; interval: string } | null
  } | null
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Toast({ type, text }: { type: 'success' | 'error'; text: string }) {
  return <div className={type === 'success' ? 'alert-success mb-4' : 'alert-error mb-4'}>{text}</div>
}

interface ProfilePageProps {
  showBilling?: boolean
}

export function ProfilePage({ showBilling = false }: ProfilePageProps) {
  const { data: meData, loading: meLoading, reload } = useApi<UserMe>('/api/auth/me')
  const { data: billingData } = useApi<BillingData>(showBilling ? '/api/billing/subscription' : '')

  // Profile form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileToast, setProfileToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordToast, setPasswordToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const user = meData?.user

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setUsername(user.username ?? '')
    }
  }, [user])

  function toast(setter: typeof setProfileToast, type: 'success' | 'error', text: string) {
    setter({ type, text })
    setTimeout(() => setter(null), 5000)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: firstName || undefined, lastName: lastName || undefined, username: username || undefined }),
      })
      reload()
      toast(setProfileToast, 'success', 'Profile updated.')
    } catch (err) {
      toast(setProfileToast, 'error', err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast(setPasswordToast, 'error', 'New passwords do not match')
      return
    }
    setPasswordSaving(true)
    try {
      await apiFetch('/api/auth/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast(setPasswordToast, 'success', 'Password changed. Other sessions have been signed out.')
    } catch (err) {
      toast(setPasswordToast, 'error', err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function openBillingPortal() {
    try {
      const res = await apiFetchRaw('/api/billing/portal-session', { method: 'POST' })
      const json = (await res.json()) as { data?: { url: string }; errors?: { message: string }[] }
      if (!res.ok) { toast(setProfileToast, 'error', json.errors?.[0]?.message ?? 'Failed'); return }
      window.open(json.data!.url, '_blank')
    } catch {
      toast(setProfileToast, 'error', 'Failed to open billing portal')
    }
  }

  const payload = getTokenPayload() as { email?: string } | null
  const initials = (user?.username ?? user?.email ?? '??').slice(0, 2).toUpperCase()
  const membership = meData?.memberships[0]

  if (meLoading) return <div className="h-4 w-48 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your account details and security.</p>
      </div>

      {/* Avatar + identity summary */}
      <div className="rounded-xl px-6 py-5 flex items-center gap-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'oklch(55% 0.11 193 / 0.18)', color: 'oklch(72% 0.12 193)' }}
        >
          {initials}
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || user?.email}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
          {membership && (
            <span className="badge mt-1.5 capitalize" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
              {membership.roleKey.replace(/_/g, ' ')}
              {membership.tenantName ? ` · ${membership.tenantName}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Personal info */}
      <Section title="Personal Information" description="Your name is shown in audit logs and admin views.">
        {profileToast && <Toast {...profileToast} />}
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First name</label>
              <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="janesmith" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Letters, numbers, and underscores only. Used to log in.</p>
          </div>
          <div>
            <label className="label">Email address</label>
            <input className="input" value={user?.email ?? ''} disabled style={{ opacity: 0.5 }} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Contact support to change your email address.</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={profileSaving} className="btn-primary">
              {profileSaving ? 'Saving…' : 'Save changes'}
            </button>
            {user?.lastLoginAt && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Last login {new Date(user.lastLoginAt).toLocaleString()}
              </p>
            )}
          </div>
        </form>
      </Section>

      {/* Password */}
      <Section title="Password" description="After changing your password, all other active sessions will be signed out.">
        {passwordToast && <Toast {...passwordToast} />}
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input type="password" className="input" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" className="input" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="input" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" disabled={passwordSaving} className="btn-primary">
            {passwordSaving ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </Section>

      {/* Billing — tenant users only */}
      {showBilling && (
        <Section title="Billing &amp; Subscription" description="Manage your plan, payment method, and billing history via the Stripe portal.">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {billingData?.subscription?.plan?.name ?? 'No active plan'}
              </p>
              <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                {billingData?.subscription?.status?.toLowerCase() ?? 'No subscription'}
                {billingData?.subscription?.plan?.interval ? ` · billed ${billingData.subscription.plan.interval.toLowerCase()}` : ''}
              </p>
            </div>
            <span
              className="badge"
              style={billingData?.subscription?.status === 'ACTIVE'
                ? { background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }
                : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
              }
            >
              {billingData?.subscription?.status ?? 'Trial'}
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={openBillingPortal} className="btn-ghost">
              Manage billing &amp; payment method →
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
            Payment methods, invoices, and card details are managed securely via Stripe. We never store card numbers.
          </p>
        </Section>
      )}

      {/* Account info */}
      <Section title="Account">
        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Account ID</dt>
            <dd className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{user?.id}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Member since</dt>
            <dd className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Status</dt>
            <dd>
              <span className="badge capitalize" style={{ background: 'oklch(19% 0.04 193)', color: 'oklch(72% 0.12 193)' }}>
                {user?.status?.toLowerCase()}
              </span>
            </dd>
          </div>
        </dl>
      </Section>
    </div>
  )
}
