'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/useApi'

interface StorageInfo {
  storageTier: string | null
  storageQuotaBytes: string | null
  storageUsedBytes: string
  storageGracePeriodEndsAt: string | null
}

interface ConversationItem {
  id: string
  channelType: string
  direction: string
  status: string
  startedAt: string
  endedAt: string | null
  summaryText: string | null
  recordingStatus: string | null
  contact: { firstName: string | null; lastName: string | null; email: string | null } | null
}

interface ConvData { items: ConversationItem[]; total: number }

interface Stats {
  conversations: number
  contacts: number
  appointments: number
}

function StorageBar({ used, quota, pct }: { used: string; quota: string | null; pct: number }) {
  const color = pct >= 100 ? '#ef4444' : pct >= 90 ? '#f59e0b' : 'oklch(55% 0.11 193)'
  const usedGb  = (Number(used)  / 1024 / 1024 / 1024).toFixed(2)
  const quotaGb = quota ? (Number(quota) / 1024 / 1024 / 1024).toFixed(1) : null

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>Recording storage</span>
        <span>{usedGb} GB{quotaGb ? ` / ${quotaGb} GB` : ''} used</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'var(--border-subtle)' }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
      {pct >= 90 && (
        <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${pct >= 100 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <span className="text-base leading-none">{pct >= 100 ? '🚫' : '⚠️'}</span>
          <div>
            <p className="font-semibold">{pct >= 100 ? 'Storage full — recordings paused' : `Storage at ${Math.round(pct)}% — upgrade soon`}</p>
            <p className="mt-0.5 opacity-80">
              {pct >= 100
                ? 'New recordings are paused. '
                : 'You are approaching your storage limit. '}
              <Link href="/billing" className="underline font-medium">View upgrade options →</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function channelIcon(channel: string) {
  if (channel === 'WIDGET')   return '🌐'
  if (channel === 'INBOUND')  return '📞'
  if (channel === 'OUTBOUND') return '📤'
  return '💬'
}

function statusColor(status: string): string {
  if (status === 'COMPLETED') return 'bg-green-50 text-green-700'
  if (status === 'ACTIVE')    return 'bg-blue-50 text-blue-700'
  if (status === 'MISSED')    return 'bg-red-50 text-red-700'
  if (status === 'FAILED')    return 'bg-red-50 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function contactName(c: ConversationItem['contact']) {
  if (!c) return 'Unknown'
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown'
}

function timeSince(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardPage() {
  const { data: storage } = useApi<StorageInfo>('/api/tenants/current')
  const { data: convData, reload: reloadConvs } = useApi<ConvData>('/api/conversations?limit=20')
  const { data: statsData } = useApi<{ data: Stats }>('/api/tenants/current')

  // Auto-refresh conversations every 30s
  useEffect(() => {
    const interval = setInterval(() => reloadConvs(), 30_000)
    return () => clearInterval(interval)
  }, [reloadConvs])

  const usedBytes  = storage?.storageUsedBytes  ?? '0'
  const quotaBytes = storage?.storageQuotaBytes ?? null
  const pct        = quotaBytes
    ? Math.round(Number(usedBytes) / Number(quotaBytes) * 100)
    : 0

  const conversations = convData?.items ?? []
  const activeConvs   = conversations.filter(c => c.status === 'ACTIVE')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Platform overview</p>
        </div>
        {activeConvs.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {activeConvs.length} active {activeConvs.length === 1 ? 'conversation' : 'conversations'}
          </div>
        )}
      </div>

      {/* Storage bar — only show if quota is set */}
      {quotaBytes && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Recording Storage
              {storage?.storageTier && (
                <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
                  {storage.storageTier}
                </span>
              )}
            </h2>
            {storage?.storageGracePeriodEndsAt && (
              <span className="text-xs text-amber-600">
                Grace period until {new Date(storage.storageGracePeriodEndsAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <StorageBar used={usedBytes} quota={quotaBytes} pct={pct} />
        </div>
      )}

      {/* Conversation activity feed */}
      <div className="rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Recent Conversations</h2>
          <Link href="/conversations" className="text-xs" style={{ color: 'var(--text-tertiary)' }}>View all →</Link>
        </div>

        {conversations.length === 0 && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No conversations yet. They will appear here as calls and messages come in.
          </div>
        )}

        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {conversations.map(c => (
            <Link
              key={c.id}
              href={`/conversations/${c.id}`}
              className="flex items-start gap-4 px-5 py-3.5 hover:opacity-80 transition-opacity"
            >
              {/* Channel icon */}
              <div className="text-xl leading-none pt-0.5 flex-shrink-0">{channelIcon(c.channelType)}</div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {contactName(c.contact)}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                  {c.status === 'ACTIVE' && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                    </span>
                  )}
                  {c.recordingStatus === 'stored' && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>🎙 Recorded</span>
                  )}
                </div>
                {c.summaryText && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{c.summaryText}</p>
                )}
              </div>

              {/* Meta */}
              <div className="text-right flex-shrink-0">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{timeSince(c.startedAt)}</p>
                <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                  {c.channelType.toLowerCase()} · {c.direction.toLowerCase()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
