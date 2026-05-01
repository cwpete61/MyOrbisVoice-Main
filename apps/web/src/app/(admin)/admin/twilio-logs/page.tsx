'use client'

import { useState } from 'react'
import { useApi } from '@/hooks/useApi'

interface TwilioEvent {
  id: string
  tenantId: string
  tenant: { displayName: string } | null
  callSid: string | null
  direction: string
  eventType: string
  callStatus: string | null
  answeredBy: string | null
  fromNumber: string | null
  toNumber: string | null
  durationSecs: number | null
  outcomeCode: string | null
  errorMessage: string | null
  occurredAt: string
}

interface EventsResponse {
  items: TwilioEvent[]
  total: number
  limit: number
  offset: number
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  amd:              'AMD',
  status:           'Status',
  inbound_received: 'Inbound',
  error:            'Error',
  dispatch:         'Dispatched',
}

const DIRECTION_COLORS: Record<string, string> = {
  INBOUND:  'bg-blue-100 text-blue-800',
  OUTBOUND: 'bg-purple-100 text-purple-800',
}

const STATUS_COLORS: Record<string, string> = {
  completed:  'bg-green-100 text-green-800',
  failed:     'bg-red-100 text-red-800',
  busy:       'bg-yellow-100 text-yellow-800',
  'no-answer':'bg-gray-100 text-gray-700',
  canceled:   'bg-gray-100 text-gray-700',
  initiated:  'bg-blue-50 text-blue-600',
  ringing:    'bg-blue-50 text-blue-600',
  voicemail:  'bg-orange-100 text-orange-800',
  human:      'bg-green-50 text-green-700',
}

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color ?? 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  )
}

export default function TwilioLogsPage() {
  const [tenantFilter, setTenantFilter] = useState('')
  const [directionFilter, setDirectionFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
  if (tenantFilter)    params.set('tenantId', tenantFilter)
  if (directionFilter) params.set('direction', directionFilter)
  if (eventTypeFilter) params.set('eventType', eventTypeFilter)

  const { data, loading, error } = useApi<EventsResponse>(`/api/admin/twilio-logs?${params}`)
  const events = data?.items ?? []
  const total  = data?.total ?? 0

  function applyFilters() { setOffset(0) }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Twilio Call Logs</h1>
        <p className="mt-1 text-sm text-gray-500">All Twilio events across tenants — AMD results, call status, and errors.</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tenant ID</label>
          <input
            type="text"
            placeholder="Paste tenant ID..."
            value={tenantFilter}
            onChange={e => setTenantFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Direction</label>
          <select
            value={directionFilter}
            onChange={e => setDirectionFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All</option>
            <option value="INBOUND">Inbound</option>
            <option value="OUTBOUND">Outbound</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Event Type</label>
          <select
            value={eventTypeFilter}
            onChange={e => setEventTypeFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All</option>
            <option value="amd">AMD</option>
            <option value="status">Status</option>
            <option value="inbound_received">Inbound Received</option>
            <option value="error">Errors Only</option>
            <option value="dispatch">Dispatched</option>
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="px-4 py-1.5 bg-teal-600 text-white rounded text-sm font-medium hover:bg-teal-700"
        >
          Filter
        </button>
        <button
          onClick={() => { setTenantFilter(''); setDirectionFilter(''); setEventTypeFilter(''); setOffset(0) }}
          className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200"
        >
          Clear
        </button>
        <span className="ml-auto text-sm text-gray-500 self-center">{total} events</span>
      </div>

      {/* Table */}
      {loading && <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>}
      {error   && <div className="text-sm text-red-600 py-8 text-center">{error}</div>}
      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Dir</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Event</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">From → To</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status / AMD</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Duration</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Call SID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">No events found.</td>
                  </tr>
                )}
                {events.map(ev => {
                  const statusLabel = ev.answeredBy ?? ev.callStatus ?? ev.outcomeCode ?? '—'
                  const statusColor = STATUS_COLORS[statusLabel] ?? 'bg-gray-100 text-gray-600'
                  const isError = ev.eventType === 'error'
                  return (
                    <tr key={ev.id} className={isError ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {new Date(ev.occurredAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        <div className="font-medium text-gray-800 truncate">{ev.tenant?.displayName ?? '—'}</div>
                        <div className="text-xs text-gray-400 truncate">{ev.tenantId}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge label={ev.direction} color={DIRECTION_COLORS[ev.direction]} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge label={EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType} color={isError ? 'bg-red-100 text-red-800' : undefined} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap text-xs">
                        {ev.fromNumber ?? '—'}<span className="text-gray-400 mx-1">→</span>{ev.toNumber ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {statusLabel !== '—' && <Badge label={statusLabel} color={statusColor} />}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {ev.durationSecs != null ? `${ev.durationSecs}s` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono truncate max-w-[120px]" title={ev.callSid ?? ''}>
                        {ev.callSid ? ev.callSid.slice(0, 14) + '…' : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-red-600 max-w-[200px] truncate" title={ev.errorMessage ?? ''}>
                        {ev.errorMessage ?? ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  disabled={offset + LIMIT >= total}
                  onClick={() => setOffset(o => o + LIMIT)}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
