'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/lib/i18n/I18nProvider'
import { apiFetch } from '@/hooks/useApi'

/**
 * My Groups — partner FB-group tracker + compliant cadence coach.
 * Tracks groups the partner MANUALLY joined + posts they MANUALLY made, for
 * attribution (opt-ins per group) and anti-spam pacing (cooldown + throttle +
 * content rotation). The platform never auto-joins/posts/engages — it paces the
 * human. See docs/campaigns/campaign-automation-roadmap.md.
 */

type Bi = { en: string; es: string }
const pick = (b: Bi, L: 'en' | 'es') => (L === 'es' ? b.es : b.en)

interface Group {
  id: string; name: string; url: string | null; niche: string | null
  memberCount: number | null; promoRule: string | null; status: string
  optins: number; postCount: number; lastPostedAt: string | null
  coolingDown: boolean; nextAllowedAt: string | null
}

const TRACKS: { key: string; label: Bi; kw: string }[] = [
  { key: 'beta', label: { en: 'Beta recruitment', es: 'Reclutamiento beta' }, kw: 'BETA' },
  { key: 'phantom', label: { en: 'Phantom Customer', es: 'Cliente Fantasma' }, kw: 'TEST' },
  { key: 'competitor', label: { en: 'Competitor steal', es: 'Robo del competidor' }, kw: 'WHO ANSWERS' },
  { key: 'math', label: { en: 'Honest math', es: 'Números honestos' }, kw: 'MATH' },
  { key: 'afterhours', label: { en: 'After-hours self-test', es: 'Prueba fuera de horario' }, kw: 'EVAL' },
  { key: 'quiz', label: { en: 'Quiz', es: 'Quiz' }, kw: 'QUIZ' },
]

export function GroupsManager() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const [groups, setGroups] = useState<Group[]>([])
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', url: '', niche: '', memberCount: '', promoRule: '' })
  const [adding, setAdding] = useState(false)
  const [track, setTrack] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string; link?: string }>>({})
  const [copied, setCopied] = useState('')

  async function load() {
    try {
      const [g, me] = await Promise.all([
        apiFetch<Group[]>('/api/partner/groups'),
        apiFetch<{ partner?: { referralCode?: string } }>('/api/partner/me'),
      ])
      setGroups(g || [])
      setCode(me?.partner?.referralCode || '')
    } catch { /* surfaced via empty state */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function addGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setAdding(true)
    try {
      await apiFetch('/api/partner/groups', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name, url: form.url || undefined, niche: form.niche || undefined,
          memberCount: form.memberCount ? Number(form.memberCount) : undefined,
          promoRule: form.promoRule || undefined,
        }),
      })
      setForm({ name: '', url: '', niche: '', memberCount: '', promoRule: '' })
      await load()
    } catch { /* ignore */ } finally { setAdding(false) }
  }

  async function delGroup(id: string) {
    try { await apiFetch(`/api/partner/groups/${id}`, { method: 'DELETE' }); await load() } catch { /* ignore */ }
  }

  async function logPost(g: Group) {
    const tk = track[g.id] || 'beta'
    setMsg((m) => ({ ...m, [g.id]: { ok: true, text: L === 'es' ? 'Registrando…' : 'Logging…' } }))
    try {
      await apiFetch(`/api/partner/groups/${g.id}/log-post`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ track: tk, keyword: TRACKS.find((t) => t.key === tk)?.kw }),
      })
      const link = tk === 'quiz' ? `${origin}/quiz/${code}?g=${g.id}` : `${origin}/beta/${code}?t=${tk}&g=${g.id}`
      setMsg((m) => ({ ...m, [g.id]: { ok: true, text: L === 'es' ? 'Listo — pega este enlace en el grupo:' : 'Logged — paste this link in the group:', link } }))
      await load()
    } catch (e) {
      const text = e instanceof Error ? e.message : (L === 'es' ? 'Error' : 'Error')
      setMsg((m) => ({ ...m, [g.id]: { ok: false, text } }))
    }
  }

  function copy(link: string) {
    navigator.clipboard.writeText(link).then(() => { setCopied(link); setTimeout(() => setCopied(''), 1500) }).catch(() => {})
  }

  const inp = { padding: '8px 10px', borderRadius: 8, fontSize: 13, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as React.CSSProperties

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {L === 'es' ? 'Mis Grupos' : 'My Groups'}
        </h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'Registra los grupos de Facebook a los que te uniste y cada publicación que haces. La plataforma marca el ritmo (para mantenerte bajo el radar de spam de FB) y rastrea qué grupos convierten. Tú haces las publicaciones — nunca automatizamos uniones, publicaciones ni interacciones.'
            : 'Track the Facebook groups you joined and each post you make. The platform paces you (to stay under FB’s spam radar) and tracks which groups convert. You do the posting — we never auto-join, auto-post, or auto-engage.'}
        </p>
      </div>

      {/* Warm-up coach */}
      <div className="rounded-xl p-4 text-sm" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
        <p className="font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{L === 'es' ? 'Antes de publicar (calentamiento)' : 'Before you post (warm-up)'}</p>
        <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
          {(L === 'es'
            ? ['Dale like / comenta en 2-3 publicaciones del grupo primero — sé un miembro real.',
               'No publiques en varios grupos seguidos; espácialos ~90 min.',
               'Usa una línea/gráfico distinto por grupo (no copies-pegues lo mismo).',
               'Respeta las reglas del grupo (días de promoción).']
            : ['Like / comment on 2–3 posts in the group first — be a real member.',
               'Don’t post to several groups back-to-back; space them ~90 min apart.',
               'Use a different line/graphic per group (no identical cross-posting).',
               'Respect the group’s rules (promo days).']
          ).map((s, i) => <li key={i}>· {s}</li>)}
        </ul>
      </div>

      {/* Add group */}
      <form onSubmit={addGroup} className="rounded-xl p-4 grid gap-2 sm:grid-cols-2" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <input style={inp} placeholder={L === 'es' ? 'Nombre del grupo *' : 'Group name *'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input style={inp} placeholder={L === 'es' ? 'URL del grupo' : 'Group URL'} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input style={inp} placeholder={L === 'es' ? 'Nicho (HVAC, dental…)' : 'Niche (HVAC, dental…)'} value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
        <input style={inp} type="number" placeholder={L === 'es' ? 'Miembros' : 'Members'} value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })} />
        <input style={inp} placeholder={L === 'es' ? 'Reglas de promoción (ej. viernes)' : 'Promo rule (e.g. fridays)'} value={form.promoRule} onChange={(e) => setForm({ ...form, promoRule: e.target.value })} />
        <button type="submit" disabled={adding} className="btn-primary">{adding ? (L === 'es' ? 'Agregando…' : 'Adding…') : (L === 'es' ? 'Agregar grupo' : 'Add group')}</button>
      </form>

      {/* Group list */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{L === 'es' ? 'Cargando…' : 'Loading…'}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{L === 'es' ? 'Aún no hay grupos. Agrega los grupos a los que te uniste arriba.' : 'No groups yet. Add the groups you’ve joined above.'}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const m = msg[g.id]
            return (
              <div key={g.id} className="rounded-xl p-3.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {[g.niche, g.memberCount ? `${g.memberCount.toLocaleString()} ${L === 'es' ? 'miembros' : 'members'}` : null, g.promoRule].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="text-right text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    <div><strong style={{ color: 'var(--brand-500, oklch(55% 0.11 193))' }}>{g.optins}</strong> {L === 'es' ? 'opt-ins' : 'opt-ins'} · {g.postCount} {L === 'es' ? 'posts' : 'posts'}</div>
                    <button onClick={() => delGroup(g.id)} className="mt-1" style={{ color: '#DC2626' }}>{L === 'es' ? 'Eliminar' : 'Remove'}</button>
                  </div>
                </div>

                {g.coolingDown ? (
                  <p className="text-xs mt-2" style={{ color: '#b7791f' }}>
                    {L === 'es' ? 'En enfriamiento — próximo permitido: ' : 'Cooling down — next allowed: '}
                    {g.nextAllowedAt ? new Date(g.nextAllowedAt).toLocaleDateString(L === 'es' ? 'es-MX' : 'en-US') : ''}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <select value={track[g.id] || 'beta'} onChange={(e) => setTrack((t) => ({ ...t, [g.id]: e.target.value }))} style={{ ...inp, padding: '6px 8px' }}>
                      {TRACKS.map((t) => <option key={t.key} value={t.key}>{pick(t.label, L)} · {t.kw}</option>)}
                    </select>
                    <button onClick={() => logPost(g)} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: 'var(--brand-500, oklch(55% 0.11 193))', color: '#fff' }}>
                      {L === 'es' ? 'Registrar publicación' : 'Log post'}
                    </button>
                    {g.url && <a href={g.url} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{L === 'es' ? 'Abrir grupo ↗' : 'Open group ↗'}</a>}
                  </div>
                )}

                {m && (
                  <div className="mt-2 text-xs" style={{ color: m.ok ? 'var(--text-secondary)' : '#DC2626' }}>
                    <p>{m.text}</p>
                    {m.link && (
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 truncate px-2 py-1 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-primary)' }}>{m.link}</code>
                        <button onClick={() => copy(m.link!)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--border-subtle)', color: copied === m.link ? 'var(--brand-500, oklch(55% 0.11 193))' : 'var(--text-tertiary)' }}>
                          {copied === m.link ? (L === 'es' ? '¡Copiado!' : 'Copied!') : (L === 'es' ? 'Copiar' : 'Copy')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
