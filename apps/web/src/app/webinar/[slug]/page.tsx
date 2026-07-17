'use client'

/**
 * MyOrbisWebinar — public registration + watch page (bilingual EN/ES).
 * Registration seeds the spine; watching emits real engagement events (join, watch
 * heartbeats, CTA, question) that score the lead live.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { VideoPlayer, type VideoProvider } from './VideoPlayer'

const TEAL = '#12a3a3'

interface PublicWebinar {
  id: string; slug: string; title: string; titleEs: string | null
  description: string | null; descriptionEs: string | null; coverImageUrl: string | null
  // The webinar itself. videoAssetRef is a provider-native id (never a URL) — the
  // player rebuilds the embed URL from a fixed template. Null until the tenant sets
  // one, which is why publishing without a video is blocked server-side.
  videoProvider: VideoProvider | null
  videoAssetRef: string | null
  // The offer. ctaUrl is where the button actually goes; CTA_CLICKED (the hero rule's
  // trigger) is emitted before we navigate.
  ctaLabel: string | null; ctaLabelEs: string | null; ctaUrl: string | null
  resourceUrl: string | null
  // The HOSTING TENANT's brand — this page belongs to them, not to us. Their
  // prospects see their name, never ours (white-label by default).
  brand: { name: string | null; logoUrl: string | null }
  // Lower tiers carry a small "Powered by MyOrbis" mark; paid tiers buy it away.
  // Server-resolved from the tenant's entitlements, not a client flag.
  poweredBy: boolean
  sessions: { id: string; kind: string; startsAt: string | null }[]
}

const COPY = {
  en: { register: 'Register free', name: 'Your name', email: 'Email', phone: 'Phone (optional)', watch: 'Watch now', registered: "You're registered!", play: '▶ Play webinar', ask: 'Ask a question', askPh: 'Type your question…', cta: 'Book a call', guide: 'Download the guide', sending: 'Registering…', langLabel: 'Español', poweredBy: 'Powered by',
        noVideo: 'The video for this session isn’t available right now.',
        voiceConsent: 'You can call me about this webinar', consentNote: 'Optional. Leave it unticked and we will never call you — you still get the webinar.' },
  es: { register: 'Regístrate gratis', name: 'Tu nombre', email: 'Correo', phone: 'Teléfono (opcional)', watch: 'Ver ahora', registered: '¡Estás registrado!', play: '▶ Reproducir webinar', ask: 'Haz una pregunta', askPh: 'Escribe tu pregunta…', cta: 'Agenda una llamada', guide: 'Descarga la guía', sending: 'Registrando…', langLabel: 'English', poweredBy: 'Con tecnología de',
        noVideo: 'El video de esta sesión no está disponible en este momento.',
        voiceConsent: 'Pueden llamarme sobre este seminario', consentNote: 'Opcional. Si no lo marcas, nunca te llamaremos — igual recibes el seminario.' },
}

export default function WebinarPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const [lang, setLang] = useState<'en' | 'es'>('en')
  const [w, setW] = useState<PublicWebinar | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [joinToken, setJoinToken] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<PublicWebinar>(`/api/public/webinar/${slug}`).then(setW).catch(e => setErr(e instanceof Error ? e.message : String(e)))
  }, [slug])

  const t = COPY[lang]
  const title = (lang === 'es' && w?.titleEs) || w?.title || ''
  const desc = (lang === 'es' && w?.descriptionEs) || w?.description || ''

  if (err) return <Centered><p style={{ color: '#dc2626' }}>{err}</p></Centered>
  if (!w) return <Centered><p style={{ color: '#666' }}>Loading…</p></Centered>

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8f8', color: '#111', fontFamily: '-apple-system,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          {/* The hosting tenant's brand — NOT ours. This was hardcoded to
              "MyOrbisAgents", which showed every tenant's prospects the wrong company. */}
          {w.brand.logoUrl
            ? <img src={w.brand.logoUrl} alt={w.brand.name ?? ''} style={{ height: 28, maxWidth: 200, objectFit: 'contain' }} />
            : <span style={{ fontWeight: 800, color: TEAL, letterSpacing: '-.01em' }}>{w.brand.name ?? ''}</span>}
          <button onClick={() => setLang(l => (l === 'en' ? 'es' : 'en'))} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 999, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: '#333' }}>{t.langLabel}</button>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.15, margin: '0 0 12px' }}>{title}</h1>
        {desc && <p style={{ fontSize: 16, color: '#444', lineHeight: 1.6, margin: '0 0 28px' }}>{desc}</p>}

        {!joinToken
          ? <RegisterForm slug={slug} sessionId={w.sessions[0]?.id} lang={lang} t={t} onRegistered={setJoinToken} />
          : <WatchRoom joinToken={joinToken} webinar={w} lang={lang} t={t} />}

        {/* Lower tiers carry the mark; paid tiers buy it away (webinar_white_label).
            Deliberately small and below the fold of the form — this is the tenant's
            page, and their prospect's attention belongs to them, not to us. */}
        {w.poweredBy && (
          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 12, color: '#9aa3a3' }}>
            {t.poweredBy}{' '}
            <a href="https://myorbisresults.com" target="_blank" rel="noopener noreferrer"
               style={{ color: '#7d8686', textDecoration: 'underline' }}>MyOrbis</a>
          </p>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f8f8' }}>{children}</div>
}

function RegisterForm({ slug, sessionId, lang, t, onRegistered }: { slug: string; sessionId?: string; lang: 'en' | 'es'; t: typeof COPY['en']; onRegistered: (token: string) => void }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('')
  // Unticked by default and never auto-checked — an unticked box is a legally
  // meaningful "no". The API treats absent/false as "keep the wall up".
  const [voiceConsent, setVoiceConsent] = useState(false)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  const input: React.CSSProperties = { padding: '12px 14px', borderRadius: 8, border: '1px solid #d5dbdb', background: '#fff', fontSize: 15, width: '100%' }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      // Only claim consent when there's a number to call and the box is ticked.
      const r = await apiFetch<{ joinToken: string }>(`/api/public/webinar/${slug}/register`, { method: 'POST', body: JSON.stringify({ name, email, phone: phone || undefined, locale: lang, sessionId, voiceConsent: voiceConsent && !!phone }) })
      onRegistered(r.joinToken)
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e3e8e8', borderRadius: 16, padding: 24, display: 'grid', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
      <input style={input} placeholder={t.name} value={name} onChange={e => setName(e.target.value)} required maxLength={120} />
      <input style={input} type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)} required maxLength={320} />
      <input style={input} placeholder={t.phone} value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} />

      {/* Voice consent. Only offered once there's a number to call. Unticked = we
          never dial: the Contact stays optedOutVoice and the compliance gate in
          dispatchPendingCalls suppresses any attempt. */}
      {phone.trim() !== '' && (
        <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13.5, color: '#334', cursor: 'pointer', lineHeight: 1.45 }}>
          <input
            type="checkbox"
            checked={voiceConsent}
            onChange={e => setVoiceConsent(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
          />
          <span>
            {t.voiceConsent}
            <span style={{ display: 'block', color: '#8a9394', fontSize: 12, marginTop: 2 }}>{t.consentNote}</span>
          </span>
        </label>
      )}
      {err && <p style={{ color: '#dc2626', margin: 0, fontSize: 14 }}>{err}</p>}
      <button type="submit" disabled={busy} style={{ padding: '13px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? t.sending : t.register}</button>
    </form>
  )
}

/**
 * The watch room. Was `WatchStub`: a play button over nothing, whose heartbeat ran on a
 * timer regardless of whether anything played. The events it produced were the input to
 * every score and to the hero rule, so "the video is a stub" quietly meant "the lead
 * intelligence is fiction". The player now drives the beat — see VideoPlayer.tsx.
 */
function WatchRoom({ joinToken, webinar, lang, t }: { joinToken: string; webinar: PublicWebinar; lang: 'en' | 'es'; t: typeof COPY['en'] }) {
  const [question, setQuestion] = useState('')
  const [done, setDone] = useState<string[]>([])

  const emit = useCallback(async (type: string, meta?: Record<string, unknown>) => {
    try { await apiFetch('/api/public/webinar/event', { method: 'POST', body: JSON.stringify({ joinToken, type, meta }) }) } catch { /* best-effort telemetry */ }
  }, [joinToken])

  const mark = (k: string) => setDone(d => (d.includes(k) ? d : [...d, k]))
  const ctaLabel = (lang === 'es' && webinar.ctaLabelEs) || webinar.ctaLabel || t.cta

  /**
   * CTA. Emit BEFORE navigating — this event is the hero rule's trigger, and a
   * fire-and-forget POST is not guaranteed to survive the page unload. We await it,
   * then open in a new tab so the webinar keeps playing behind them (a lead who clicks
   * the offer and loses the video is a lead who watched less).
   */
  async function clickCta() {
    mark('cta')
    await emit('CTA_CLICKED', { ctaId: 'primary', url: webinar.ctaUrl })
    if (webinar.ctaUrl) window.open(webinar.ctaUrl, '_blank', 'noopener,noreferrer')
  }

  async function clickResource() {
    mark('guide')
    await emit('DOWNLOADED', { assetId: 'primary', url: webinar.resourceUrl })
    if (webinar.resourceUrl) window.open(webinar.resourceUrl, '_blank', 'noopener,noreferrer')
  }

  const hasVideo = !!(webinar.videoProvider && webinar.videoAssetRef)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e3e8e8', borderRadius: 16, padding: 20 }}>
        <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 12 }}>✓ {t.registered}</div>
        {hasVideo
          ? <VideoPlayer
              provider={webinar.videoProvider!}
              videoRef={webinar.videoAssetRef!}
              onFirstPlay={() => void emit('JOINED')}
              onWatched={seconds => void emit('WATCHED', { seconds })}
            />
          // Publishing without a video is blocked server-side, so this is only
          // reachable if the field was cleared while the webinar was live. Say what
          // happened instead of showing a dead frame.
          : <div style={{ aspectRatio: '16/9', borderRadius: 12, background: '#0b2b2b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8fb2ad', fontSize: 15, textAlign: 'center', padding: 20 }}>
              {t.noVideo}
            </div>}
      </div>

      {/* The offer + the engagement surface. Shown once they're in the room, not gated
          on play: someone who registers and scrolls should still be able to convert. */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {webinar.ctaUrl && (
            <button onClick={() => void clickCta()} style={{ padding: '11px 18px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              {ctaLabel}{done.includes('cta') && ' ✓'}
            </button>
          )}
          {/* Null hides it. The old build shipped this button unconditionally and it
              downloaded nothing — a DOWNLOADED event with no download behind it. */}
          {webinar.resourceUrl && (
            <button onClick={() => void clickResource()} style={{ padding: '11px 18px', borderRadius: 8, border: '1px solid #d5dbdb', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              {t.guide}{done.includes('guide') && ' ✓'}
            </button>
          )}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (question.trim()) { void emit('QUESTION_ASKED', { text: question.trim() }); setQuestion(''); mark('q') } }} style={{ display: 'flex', gap: 8 }}>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder={t.askPh} style={{ flex: 1, padding: '11px 14px', borderRadius: 8, border: '1px solid #d5dbdb', fontSize: 15 }} />
          <button type="submit" style={{ padding: '11px 16px', borderRadius: 8, border: '1px solid #d5dbdb', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>{t.ask}</button>
        </form>
      </div>
    </div>
  )
}
