'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/I18nProvider'
import { apiFetch } from '@/hooks/useApi'

const SAVED_KEY = 'mov_graphic_saved'

/**
 * Graphics sub-tab of the Inbound Evaluation campaign. Generates text-only post
 * graphics on a <canvas> at full platform resolution: NEON background, black or
 * white type, high contrast. Lines are grouped into testable campaign TRACKS
 * (beta-recruitment / phantom / competitor / honest-math / after-hours) so the
 * partner can A/B which angle pulls best. Per-platform sizes, Copy-text +
 * Download-PNG. Bilingual via useLocale (data-driven EN/ES).
 * Pairs with MarketingStrategy / docs/campaigns/inbound-eval-marketing-strategy.md
 */

type Bi = { en: string; es: string }
const pick = (b: Bi, L: 'en' | 'es') => (L === 'es' ? b.es : b.en)

const PLATFORMS = [
  { key: 'ig-square', label: { en: 'Instagram / FB · Square', es: 'Instagram / FB · Cuadrado' }, w: 1080, h: 1080 },
  { key: 'ig-story', label: { en: 'Story / Reel · 9:16', es: 'Historia / Reel · 9:16' }, w: 1080, h: 1920 },
  { key: 'linkedin', label: { en: 'LinkedIn / FB · Landscape', es: 'LinkedIn / FB · Horizontal' }, w: 1200, h: 627 },
  { key: 'x', label: { en: 'X (Twitter) · 16:9', es: 'X (Twitter) · 16:9' }, w: 1600, h: 900 },
] as const

// Neon backgrounds — type sits on top in black or white (toggle).
const THEMES = [
  { key: 'cyan', label: { en: 'Neon cyan', es: 'Cian neón' }, bg: '#00e5ff' },
  { key: 'magenta', label: { en: 'Hot magenta', es: 'Magenta intenso' }, bg: '#ff2bd6' },
  { key: 'lime', label: { en: 'Acid lime', es: 'Lima ácido' }, bg: '#c6ff00' },
  { key: 'yellow', label: { en: 'Volt yellow', es: 'Amarillo voltio' }, bg: '#ffe600' },
  { key: 'orange', label: { en: 'Blaze orange', es: 'Naranja fuego' }, bg: '#ff6a00' },
  { key: 'green', label: { en: 'Electric green', es: 'Verde eléctrico' }, bg: '#00ff88' },
  { key: 'blue', label: { en: 'Electric blue', es: 'Azul eléctrico' }, bg: '#3b5bff' },
  { key: 'pink', label: { en: 'Shock pink', es: 'Rosa shock' }, bg: '#ff2d6f' },
] as const

const TRACKS = [
  { key: 'beta', label: { en: 'Beta recruitment', es: 'Reclutamiento beta' }, blurb: { en: 'Honest "we need testers" ask — disarms, justifies the test call. Lead angle for cold.', es: 'Petición honesta "necesitamos testers" — baja la guardia, justifica la llamada. Ángulo principal en frío.' } },
  { key: 'phantom', label: { en: 'Phantom Customer', es: 'Cliente Fantasma' }, blurb: { en: 'Emotional pain — the customer you never knew you lost. Best for reinforcement / retarget.', es: 'Dolor emocional — el cliente que nunca supiste que perdiste. Ideal para refuerzo / retargeting.' } },
  { key: 'competitor', label: { en: 'Competitor steal', es: 'Robo del competidor' }, blurb: { en: 'Loss-aversion — the job went to whoever picked up first.', es: 'Aversión a la pérdida — el trabajo se fue con quien contestó primero.' } },
  { key: 'math', label: { en: 'Honest math', es: 'Números honestos' }, blurb: { en: 'Anti-hype — no fake stats, your own numbers. Builds trust.', es: 'Anti-exageración — sin estadísticas falsas, tus propios números. Genera confianza.' } },
  { key: 'afterhours', label: { en: 'After-hours self-test', es: 'Prueba fuera de horario' }, blurb: { en: 'Low-threat challenge — call your own line tonight.', es: 'Reto de baja presión — llama a tu propia línea hoy.' } },
] as const

type TrackKey = (typeof TRACKS)[number]['key']

const LINES: { track: TrackKey; text: Bi; cta: Bi }[] = [
  // ── Beta recruitment ──
  { track: 'beta', text: { en: 'We need 25 local businesses\nto beta-test our software.\nFree.', es: 'Necesitamos 25 negocios locales\npara probar nuestro software.\nGratis.' }, cta: { en: 'Comment BETA', es: 'Escribe BETA' } },
  { track: 'beta', text: { en: 'New software.\nWe call your business.\nYou keep the report.', es: 'Software nuevo.\nLlamamos a tu negocio.\nTe quedas el reporte.' }, cta: { en: 'Comment BETA', es: 'Escribe BETA' } },
  { track: 'beta', text: { en: 'Help us prove it works.\nKeep the report\neither way.', es: 'Ayúdanos a probar que funciona.\nQuédate el reporte\nde todas formas.' }, cta: { en: 'Comment BETA', es: 'Escribe BETA' } },
  { track: 'beta', text: { en: 'Does your call become a sale —\nor quietly slip away?\nLet us test it. Free.', es: '¿Tu llamada se vuelve venta —\no se escapa en silencio?\nDéjanos probarlo. Gratis.' }, cta: { en: 'Comment BETA', es: 'Escribe BETA' } },

  // ── Phantom Customer ──
  { track: 'phantom', text: { en: 'A customer called at 6:50pm.\nYou’ll never know\ntheir name.', es: 'Un cliente llamó a las 6:50pm.\nNunca sabrás\nsu nombre.' }, cta: { en: 'Free eval · Comment TEST', es: 'Evaluación gratis · Escribe PRUEBA' } },
  { track: 'phantom', text: { en: 'Meet the customers\nyou never knew\nyou lost.', es: 'Conoce a los clientes\nque nunca supiste\nque perdiste.' }, cta: { en: 'Keep the report · Comment TEST', es: 'Quédate el reporte · Escribe PRUEBA' } },
  { track: 'phantom', text: { en: 'See where your customers\nslip out —\nbefore your competitor does.', es: 'Descubre por dónde\nse te escapan los clientes —\nantes que tu competencia.' }, cta: { en: 'Free 15-min eval · Comment TEST', es: 'Evaluación de 15 min · Escribe PRUEBA' } },

  // ── Competitor steal ──
  { track: 'competitor', text: { en: 'Your competitor answered\non the 2nd ring.\nYou went to voicemail.', es: 'Tu competencia contestó\nal 2º timbre.\nTú caíste en el buzón.' }, cta: { en: 'Comment WHO ANSWERS', es: 'Escribe QUIÉN CONTESTA' } },
  { track: 'competitor', text: { en: 'When the work is close,\nthe job goes to\nwhoever picks up first.', es: 'Cuando el trabajo es parecido,\nel cliente se va con\nel que contesta primero.' }, cta: { en: 'Comment WHO ANSWERS', es: 'Escribe QUIÉN CONTESTA' } },

  // ── Honest math ──
  { track: 'math', text: { en: 'No fake stats.\nYour own numbers.\nThe real leak.', es: 'Sin datos falsos.\nTus propios números.\nLa fuga real.' }, cta: { en: 'Comment MATH', es: 'Escribe NÚMEROS' } },
  { track: 'math', text: { en: 'We won’t scream\n“$4,800 lost.”\nWe’ll show YOUR math.', es: 'No vamos a gritar\n“perdiste $4,800.”\nMostramos TUS números.' }, cta: { en: 'Comment MATH', es: 'Escribe NÚMEROS' } },

  // ── After-hours self-test ──
  { track: 'afterhours', text: { en: 'Call your own business\nat 8pm.\nWhat do they hear?', es: 'Llama a tu propio negocio\na las 8pm.\n¿Qué escuchan?' }, cta: { en: 'Comment EVAL', es: 'Escribe EVAL' } },
  { track: 'afterhours', text: { en: 'No answer.\nNo customer.\nEvery time.', es: 'Sin respuesta.\nSin cliente.\nCada vez.' }, cta: { en: 'Free eval · Comment TEST', es: 'Evaluación gratis · Escribe PRUEBA' } },
]

export function GraphicsStudio() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [trackKey, setTrackKey] = useState<TrackKey>('beta')
  const [lineIdx, setLineIdx] = useState(0)
  const [platIdx, setPlatIdx] = useState(0)
  const [themeIdx, setThemeIdx] = useState(0)
  const [textColor, setTextColor] = useState<'black' | 'white'>('black')
  const [custom, setCustom] = useState('')
  const [copied, setCopied] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const [saved, setSaved] = useState<string[]>([])

  useEffect(() => {
    try { const r = localStorage.getItem(SAVED_KEY); if (r) setSaved(JSON.parse(r)) } catch { /* ignore */ }
  }, [])

  function persistSaved(next: string[]) {
    setSaved(next)
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const track = TRACKS.find((t) => t.key === trackKey)!
  const lines = LINES.filter((l) => l.track === trackKey)
  const safeIdx = Math.min(lineIdx, lines.length - 1)
  const plat = PLATFORMS[platIdx]!
  const theme = THEMES[themeIdx]!
  const fg = textColor === 'black' ? '#000000' : '#ffffff'
  const headline = custom.trim() || pick(lines[safeIdx]!.text, L)
  const cta = custom.trim() ? '' : pick(lines[safeIdx]!.cta, L)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const { w, h } = plat
    cv.width = w; cv.height = h

    // neon background
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, w, h)
    // contrasting frame in the type color
    ctx.strokeStyle = fg
    ctx.lineWidth = Math.max(4, w * 0.006)
    const inset = w * 0.035
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)

    const padX = w * 0.10
    const brandY = inset + h * 0.06
    const ctaH = cta ? h * 0.10 : h * 0.04
    const topReserve = brandY + h * 0.04
    const maxW = w - padX * 2
    const maxH = h - topReserve - ctaH - inset

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // brand label (stays English per brand rule)
    ctx.shadowBlur = 0
    ctx.fillStyle = fg
    ctx.font = `700 ${Math.round(h * 0.026)}px "Arial", system-ui, sans-serif`
    ctx.fillText('M Y O R B I S V O I C E', w / 2, brandY)

    // headline — auto-fit + wrap (respects explicit \n)
    const fit = fitHeadline(ctx, headline, maxW, maxH, h)
    ctx.font = `900 ${fit.size}px "Arial Black", "Arial", Impact, system-ui, sans-serif`
    const lineH = fit.size * 1.12
    const blockH = fit.lines.length * lineH
    let y = topReserve + (maxH - blockH) / 2 + lineH / 2
    // subtle separation shadow (opposite of type color) so edges pop on neon
    ctx.shadowColor = textColor === 'black' ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = fit.size * 0.06
    ctx.fillStyle = fg
    for (const line of fit.lines) {
      ctx.fillText(line, w / 2, y)
      y += lineH
    }
    ctx.shadowBlur = 0

    // CTA footer (pill in type color, text in bg neon for contrast)
    if (cta) {
      ctx.font = `800 ${Math.round(h * 0.030)}px "Arial", system-ui, sans-serif`
      const tw = ctx.measureText(cta).width
      const pillH = h * 0.066
      const pillW = tw + h * 0.06
      const px = (w - pillW) / 2
      const py = h - inset - ctaH * 0.55 - pillH / 2
      ctx.fillStyle = fg
      roundRect(ctx, px, py, pillW, pillH, pillH / 2)
      ctx.fill()
      ctx.fillStyle = theme.bg
      ctx.fillText(cta, w / 2, py + pillH / 2)
    }
  }, [trackKey, lineIdx, platIdx, themeIdx, textColor, headline, cta, plat, theme, fg])

  function download() {
    const cv = canvasRef.current
    if (!cv) return
    cv.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `myorbisvoice-${trackKey}-${plat.key}-${custom.trim() ? 'custom' : safeIdx + 1}.png`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  async function copyText() {
    const txt = cta ? `${headline}\n\n${cta}` : headline
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  async function generateAi() {
    const idea = custom.trim()
    if (!idea) { setAiErr(L === 'es' ? 'Escribe una idea primero.' : 'Type an idea first.'); return }
    setAiBusy(true); setAiErr('')
    try {
      const d = await apiFetch<{ text?: string }>('/api/partner/graphics/ai-line', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idea, lang: L, track: trackKey }),
      })
      if (d?.text) setCustom(d.text)
      else setAiErr(L === 'es' ? 'La IA no devolvió texto.' : 'AI returned no text.')
    } catch (e) {
      const msg = (e instanceof Error ? e.message : '').toLowerCase()
      if (msg.includes('quota') || msg.includes('billing') || msg.includes('credit') || msg.includes('not_configured') || msg.includes('429')) {
        setAiErr(L === 'es'
          ? 'IA no disponible (créditos de OpenAI agotados). Escribe tu propia línea por ahora.'
          : 'AI unavailable (OpenAI credits exhausted). Type your own line for now.')
      } else {
        setAiErr(L === 'es' ? 'No se pudo generar. Intenta de nuevo.' : 'Could not generate. Try again.')
      }
    } finally { setAiBusy(false) }
  }

  function saveCurrent() {
    const txt = headline.trim()
    if (!txt || saved.includes(txt)) return
    persistSaved([txt, ...saved].slice(0, 50))
  }
  function loadSaved(s: string) { setCustom(s) }
  function removeSaved(i: number) { persistSaved(saved.filter((_, j) => j !== i)) }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {L === 'es' ? 'Gráficos' : 'Graphics'}
        </h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'Crea gráficos de texto en neón para tus publicaciones. Elige el ángulo de campaña, la línea, la plataforma y el color; luego copia el texto o descarga el PNG en alta resolución. Prueba varios ángulos para ver cuál convierte mejor.'
            : 'Build text-only neon post graphics. Pick a campaign angle, line, platform, and color, then copy the text or download a full-resolution PNG. Test multiple angles to see which converts best.'}
        </p>
      </div>

      {/* Campaign track selector */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
          {L === 'es' ? 'Ángulo de campaña (prueba A/B)' : 'Campaign angle (A/B test)'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TRACKS.map((tr) => (
            <Chip key={tr.key} active={tr.key === trackKey} onClick={() => { setTrackKey(tr.key); setLineIdx(0); setCustom('') }}>
              {pick(tr.label, L)}
            </Chip>
          ))}
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>{pick(track.blurb, L)}</p>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)' }}>
        {/* Preview */}
        <div className="rounded-xl p-3 flex items-center justify-center" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', maxWidth: plat.w >= plat.h ? '100%' : '320px', height: 'auto', borderRadius: 10, display: 'block' }}
          />
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Field label={L === 'es' ? 'Línea' : 'Line'}>
            <select value={safeIdx} onChange={(e) => { setLineIdx(Number(e.target.value)); setCustom('') }} style={selStyle}>
              {lines.map((l, i) => (
                <option key={i} value={i}>{`${i + 1}. ${pick(l.text, L).replace(/\n/g, ' ').slice(0, 42)}…`}</option>
              ))}
            </select>
          </Field>

          <Field label={L === 'es' ? 'Texto propio / idea para IA (opcional)' : 'Custom text / AI idea (optional)'}>
            <textarea
              value={custom} onChange={(e) => setCustom(e.target.value)} rows={3}
              placeholder={L === 'es' ? 'Escribe una idea y pulsa Generar, o tu propia línea…' : 'Type an idea and hit Generate, or your own line…'}
              style={{ ...selStyle, resize: 'vertical', lineHeight: 1.4 }}
            />
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={generateAi} disabled={aiBusy}
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--brand-500, oklch(55% 0.11 193))', color: '#fff', opacity: aiBusy ? 0.7 : 1 }}
              >
                {aiBusy ? (L === 'es' ? 'Generando…' : 'Generating…') : (L === 'es' ? '✨ Generar con IA' : '✨ Generate with AI')}
              </button>
              <button
                onClick={saveCurrent}
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                {L === 'es' ? 'Guardar línea' : 'Save line'}
              </button>
            </div>
            {aiErr && <p className="text-xs mt-1" style={{ color: '#c0392b' }}>{aiErr}</p>}
          </Field>

          {saved.length > 0 && (
            <Field label={L === 'es' ? 'Líneas guardadas' : 'Saved lines'}>
              <div className="space-y-1">
                {saved.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                    <button onClick={() => loadSaved(s)} className="flex-1 text-left text-xs px-2.5 py-1.5 truncate" style={{ color: 'var(--text-secondary)' }} title={s}>
                      {s.replace(/\n/g, ' ')}
                    </button>
                    <button onClick={() => removeSaved(i)} className="px-2 py-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }} title={L === 'es' ? 'Eliminar' : 'Remove'}>✕</button>
                  </div>
                ))}
              </div>
            </Field>
          )}

          <Field label={L === 'es' ? 'Plataforma' : 'Platform'}>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p, i) => (
                <Chip key={p.key} active={i === platIdx} onClick={() => setPlatIdx(i)}>{pick(p.label, L)}</Chip>
              ))}
            </div>
          </Field>

          <Field label={L === 'es' ? 'Fondo neón' : 'Neon background'}>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((th, i) => (
                <button
                  key={th.key} onClick={() => setThemeIdx(i)} title={pick(th.label, L)}
                  style={{
                    width: 34, height: 34, borderRadius: 8, cursor: 'pointer', background: th.bg,
                    border: `2px solid ${i === themeIdx ? fg : 'var(--border-subtle)'}`,
                    boxShadow: i === themeIdx ? `0 0 0 2px ${th.bg}` : 'none',
                  }}
                />
              ))}
            </div>
          </Field>

          <Field label={L === 'es' ? 'Color del texto' : 'Text color'}>
            <div className="flex gap-1.5">
              <Chip active={textColor === 'black'} onClick={() => setTextColor('black')}>{L === 'es' ? 'Negro' : 'Black'}</Chip>
              <Chip active={textColor === 'white'} onClick={() => setTextColor('white')}>{L === 'es' ? 'Blanco' : 'White'}</Chip>
            </div>
          </Field>

          <div className="flex gap-2 pt-1">
            <button onClick={download} className="btn-primary flex-1">{L === 'es' ? 'Descargar PNG' : 'Download PNG'}</button>
            <button
              onClick={copyText}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: copied ? 'var(--brand-500, oklch(55% 0.11 193))' : 'var(--text-secondary)' }}
            >
              {copied ? (L === 'es' ? '¡Copiado!' : 'Copied!') : (L === 'es' ? 'Copiar texto' : 'Copy text')}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {L === 'es'
              ? `Tamaño de descarga: ${plat.w}×${plat.h}px. Texto solo, alto contraste — fondo neón, texto ${textColor === 'black' ? 'negro' : 'blanco'}.`
              : `Download size: ${plat.w}×${plat.h}px. Text-only, high-contrast — neon background, ${textColor} type.`}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Find the largest font size where the text (honoring \n) wraps within the box. */
function fitHeadline(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, h: number) {
  const hard = text.split('\n')
  for (let size = Math.round(h * 0.15); size >= Math.round(h * 0.03); size -= 2) {
    ctx.font = `900 ${size}px "Arial Black", "Arial", Impact, system-ui, sans-serif`
    const lineH = size * 1.12
    const lines: string[] = []
    let ok = true
    for (const seg of hard) {
      const words = seg.split(' ')
      let cur = ''
      for (const word of words) {
        const test = cur ? `${cur} ${word}` : word
        if (ctx.measureText(test).width <= maxW) { cur = test }
        else {
          if (cur) lines.push(cur)
          if (ctx.measureText(word).width > maxW) { ok = false; break }
          cur = word
        }
      }
      if (cur) lines.push(cur)
      if (!ok) break
    }
    if (ok && lines.length * lineH <= maxH) return { size, lines }
  }
  const size = Math.round(h * 0.03)
  ctx.font = `900 ${size}px "Arial Black", "Arial", Impact, system-ui, sans-serif`
  return { size, lines: hard }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
      style={{
        background: active ? 'var(--brand-500, oklch(55% 0.11 193))' : 'var(--surface-raised)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {children}
    </button>
  )
}

const selStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
  background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
}
