'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'

interface CallLogRow {
  id:              string
  startedAt:       string
  endedAt:         string | null
  channelType:     string
  direction:       string
  status:          string
  attentionLevel:  'NONE' | 'WATCH' | 'ALERT'
  attentionReason: string | null
  summary:         string | null
  scope:           'partner' | 'tenant'
  owner:           string
  caller:          string
  durationSeconds: number | null
  booked:          boolean
}

interface CallLogResponse {
  items:  CallLogRow[]
  total:  number
  limit:  number
  offset: number
}

const ROW_TINT: Record<CallLogRow['attentionLevel'], string> = {
  ALERT: 'bg-red-50',
  WATCH: 'bg-yellow-50',
  NONE:  'bg-white',
}

const ATTENTION_BADGE: Record<CallLogRow['attentionLevel'], string> = {
  ALERT: 'bg-red-100 text-red-800',
  WATCH: 'bg-yellow-100 text-yellow-800',
  NONE:  'bg-green-100 text-green-700',
}

function fmtDuration(secs: number | null): string {
  if (secs == null) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CallLogPage() {
  const [attention, setAttention] = useState('')
  const [scope, setScope] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
  if (attention) params.set('attention', attention)
  if (scope)     params.set('scope', scope)

  const { data, loading, error } = useApi<CallLogResponse>(`/api/admin/call-log?${params}`)
  const rows  = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Central Call Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every conversation across all partners and tenants. Red = a customer issue that needs review,
          yellow = mild concern. Flagged automatically by the AI conversation monitor.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Attention</label>
          <select
            value={attention}
            onChange={e => { setAttention(e.target.value); setOffset(0) }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All</option>
            <option value="ALERT">Alert — needs review</option>
            <option value="WATCH">Watch</option>
            <option value="NONE">Normal</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Scope</label>
          <select
            value={scope}
            onChange={e => { setScope(e.target.value); setOffset(0) }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All</option>
            <option value="partner">Partner</option>
            <option value="tenant">Tenant</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-gray-500 self-center">{total} conversation{total === 1 ? '' : 's'}</div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Failed to load the call log.</p>}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Caller</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Booked</th>
                <th className="px-3 py-2">Attention</th>
                <th className="px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No conversations.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className={`border-b border-gray-100 ${ROW_TINT[r.attentionLevel]}`}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900">{r.owner}</span>
                    <span className="ml-1 text-xs text-gray-400">{r.scope}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.caller}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.channelType} / {r.direction}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-600">{fmtDuration(r.durationSeconds)}</td>
                  <td className="px-3 py-2">{r.booked ? '✓' : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ATTENTION_BADGE[r.attentionLevel]}`}>
                      {r.attentionLevel}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-md">
                    {r.attentionReason && <div className="font-medium text-red-700 mb-0.5">{r.attentionReason}</div>}
                    <div className="line-clamp-2">{r.summary ?? '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMIT && (
        <div className="flex items-center gap-3 mt-4 text-sm">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            className="px-3 py-1.5 border border-gray-300 rounded disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-500">{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
          <button
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset(offset + LIMIT)}
            className="px-3 py-1.5 border border-gray-300 rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
