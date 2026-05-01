'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetchRaw } from '@/hooks/useApi'

interface Notification {
  id: string
  type: string
  priority: string
  title: string
  body: string
  linkPath: string | null
  readAt: string | null
  createdAt: string
}

interface NotifData {
  items: Notification[]
  unreadCount: number
}

const PRIORITY_ORDER = { critical: 0, warning: 1, info: 2 }

function priorityColor(priority: string) {
  if (priority === 'critical') return '#ef4444'
  if (priority === 'warning')  return '#f59e0b'
  return 'var(--text-tertiary)'
}

function priorityDot(priority: string) {
  if (priority === 'critical') return 'bg-red-500'
  if (priority === 'warning')  return 'bg-amber-400'
  return 'bg-gray-300'
}

export function NotificationBell() {
  const [open, setOpen]         = useState(false)
  const [data, setData]         = useState<NotifData | null>(null)
  const [loading, setLoading]   = useState(false)
  const panelRef                = useRef<HTMLDivElement>(null)
  const router                  = useRouter()

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetchRaw('/api/notifications')
      if (res.ok) {
        const json = await res.json() as { data: NotifData }
        setData(json.data)
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [])

  // Poll every 60 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function markRead(id: string) {
    await apiFetchRaw(`/api/notifications/${id}/read`, { method: 'POST' })
    setData(prev => prev ? {
      ...prev,
      unreadCount: Math.max(0, prev.unreadCount - 1),
      items: prev.items.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
    } : prev)
  }

  async function markAllRead() {
    await apiFetchRaw('/api/notifications/read-all', { method: 'POST' })
    setData(prev => prev ? {
      unreadCount: 0,
      items: prev.items.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    } : prev)
  }

  async function handleClick(notif: Notification) {
    if (!notif.readAt) await markRead(notif.id)
    if (notif.linkPath) {
      setOpen(false)
      router.push(notif.linkPath)
    }
  }

  const unread   = data?.unreadCount ?? 0
  const sorted   = [...(data?.items ?? [])].sort((a, b) => {
    // Unread first, then by priority, then by date
    if (!a.readAt && b.readAt) return -1
    if (a.readAt && !b.readAt) return 1
    const pa = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 2
    const pb = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 2
    if (pa !== pb) return pa - pb
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications() }}
        className="relative p-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-red-500 text-white leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl z-50 overflow-hidden"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Notifications {unread > 0 && <span className="text-xs font-normal text-red-500 ml-1">{unread} unread</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-96">
            {loading && !data && (
              <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
            )}
            {!loading && sorted.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No notifications yet
              </div>
            )}
            {sorted.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className="w-full text-left px-4 py-3 flex gap-3 transition-colors hover:opacity-90"
                style={{
                  background: !n.readAt ? 'var(--surface-overlay)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                {/* Priority dot */}
                <div className="pt-1 flex-shrink-0">
                  <span className={`block w-2 h-2 rounded-full ${priorityDot(n.priority)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{ color: priorityColor(n.priority) }}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {n.body}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.readAt && (
                  <div className="flex-shrink-0 pt-1">
                    <span className="block w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
