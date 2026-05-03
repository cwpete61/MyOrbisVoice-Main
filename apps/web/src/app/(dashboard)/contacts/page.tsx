'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch, useApi } from '@/hooks/useApi'

interface Contact {
  id: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phoneE164: string | null
  source: string
  createdAt: string
  optedOutSms: boolean
  optedOutVoice: boolean
  optedOutEmail: boolean
  emailStatus: string | null
}

interface ContactList {
  items: Contact[]
  total: number
  page: number
  limit: number
}

const inp = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
const lbl = 'block text-xs font-medium mb-1'

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const { data, loading, error, reload } = useApi<ContactList>(
    `/api/contacts${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`,
    [searchQuery]
  )

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneE164: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // CSV import state
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvRows, setCsvRows] = useState<Array<{ firstName: string; lastName: string; email: string; phoneE164: string }>>([])
  const [rawCsv, setRawCsv]   = useState<string>('')
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; failed: number } | null>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(search)
  }

  async function createContact() {
    if (!form.firstName && !form.email && !form.phoneE164) {
      setFormError('Provide at least a name, email, or phone number.')
      return
    }
    setSaving(true); setFormError('')
    try {
      await apiFetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName || undefined,
          lastName:  form.lastName  || undefined,
          email:     form.email     || undefined,
          phoneE164: form.phoneE164 || undefined,
        }),
      })
      setForm({ firstName: '', lastName: '', email: '', phoneE164: '' })
      setShowForm(false)
      reload()
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  function parseCsv(text: string) {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return []
    const headers = lines[0]!.split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    const idx = (names: string[]) => names.reduce<number>((found, n) => found >= 0 ? found : headers.indexOf(n), -1)
    const fiIdx  = idx(['firstname', 'first', 'fname'])
    const laIdx  = idx(['lastname', 'last', 'lname'])
    const emIdx  = idx(['email', 'emailaddress'])
    const phIdx  = idx(['phone', 'phonee164', 'mobile', 'cell', 'telephone'])
    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return {
        firstName: fiIdx >= 0 ? (cols[fiIdx] ?? '') : '',
        lastName:  laIdx >= 0 ? (cols[laIdx] ?? '') : '',
        email:     emIdx >= 0 ? (cols[emIdx] ?? '') : '',
        phoneE164: phIdx >= 0 ? (cols[phIdx] ?? '') : '',
      }
    }).filter(r => r.firstName || r.email || r.phoneE164)
  }

  // Hold raw CSV text for the new bulk endpoint instead of pre-parsing
  // client-side row-by-row.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCsv(text)
      setCsvRows(rows)
      setRawCsv(text)
      setShowImport(true)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  async function runImport() {
    if (!rawCsv) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await apiFetch<{ created: number; skipped: number; errors: { row: number; reason: string }[] }>(
        '/api/contacts/import',
        { method: 'POST', body: JSON.stringify({ csv: rawCsv }) },
      )
      setImportResult({ ok: result.created, failed: result.skipped })
      if (result.created > 0) reload()
    } catch (err) {
      setImportResult({ ok: 0, failed: csvRows.length })
    } finally {
      setImporting(false)
    }
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' })
    reload()
  }

  const contacts = data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Contacts</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {data ? `${data.total} total` : 'Manage your contact list for outbound campaigns'}
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost">Import CSV</button>
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Add contact</button>
        </div>
      </div>

      {/* CSV import panel */}
      {showImport && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Import CSV — {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} detected
            </h2>
            <button onClick={() => { setShowImport(false); setCsvRows([]); setRawCsv(''); setImportResult(null); if (fileRef.current) fileRef.current.value = '' }}
              className="text-xs" style={{ color: 'var(--text-tertiary)' }}>✕ Close</button>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Expected columns (case-insensitive): <code className="font-mono">firstName, lastName, email, phone</code>
          </p>

          {csvRows.length > 0 && (
            <div className="rounded-lg overflow-hidden max-h-48 overflow-y-auto" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['First', 'Last', 'Email', 'Phone'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderBottom: i < Math.min(csvRows.length, 10) - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.firstName || '—'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{r.lastName  || '—'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{r.email     || '—'}</td>
                      <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{r.phoneE164 || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvRows.length > 10 && (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}>
                  …and {csvRows.length - 10} more rows
                </p>
              )}
            </div>
          )}

          {importResult && (
            <div className={importResult.failed === 0 ? 'alert-success' : 'alert-error'}>
              Imported {importResult.ok} contact{importResult.ok !== 1 ? 's' : ''}.
              {importResult.failed > 0 && ` ${importResult.failed} failed (duplicate or invalid data).`}
            </div>
          )}

          {!importResult && (
            <div className="flex gap-2">
              <button onClick={runImport} disabled={importing || csvRows.length === 0} className="btn-primary">
                {importing ? `Importing… (${csvRows.length} rows)` : `Import ${csvRows.length} contacts`}
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn-ghost">Choose different file</button>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone…"
          className={inp + ' max-w-sm'}
        />
        <button type="submit" className="btn-ghost">Search</button>
        {searchQuery && (
          <button type="button" onClick={() => { setSearch(''); setSearchQuery('') }} className="btn-ghost">Clear</button>
        )}
      </form>

      {/* Add contact form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New contact</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: 'var(--text-secondary)' }}>First name</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inp} placeholder="Jane" />
            </div>
            <div>
              <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Last name</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inp} placeholder="Smith" />
            </div>
            <div>
              <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} placeholder="jane@example.com" />
            </div>
            <div>
              <label className={lbl} style={{ color: 'var(--text-secondary)' }}>Phone (E.164)</label>
              <input value={form.phoneE164} onChange={(e) => setForm({ ...form, phoneE164: e.target.value })} className={inp} placeholder="+18005551234" />
            </div>
          </div>
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={createContact} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading && <div className="h-4 rounded animate-pulse w-48" style={{ background: 'var(--border-subtle)' }} />}
      {error   && <div className="alert-error">{error}</div>}

      {!loading && contacts.length === 0 && (
        <div className="py-16 text-center rounded-xl" style={{ border: '1px dashed var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No contacts yet. Add one above or import a list.</p>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Name', 'Email', 'Phone', 'Status', 'Source', 'Added', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < contacts.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    <Link href={`/contacts/${c.id}`} className="hover:underline">
                      {c.fullName ?? ([c.firstName, c.lastName].filter(Boolean).join(' ') || '—')}
                    </Link>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                    <span>{c.email ?? '—'}</span>
                    {c.emailStatus === 'invalid' && <span className="ml-1 text-xs text-red-500">✕</span>}
                    {c.emailStatus === 'valid' && <span className="ml-1 text-xs text-green-500">✓</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{c.phoneE164 ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {c.optedOutSms   && <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">SMS out</span>}
                      {c.optedOutVoice && <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">Voice out</span>}
                      {c.optedOutEmail && <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">Email out</span>}
                      {!c.optedOutSms && !c.optedOutVoice && !c.optedOutEmail && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-green-50 text-green-700">Active</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{c.source}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteContact(c.id)} className="text-xs hover:opacity-100 opacity-40 transition-opacity" style={{ color: 'var(--error-600)' }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
