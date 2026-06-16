'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

/**
 * Public "How leaky is your phone?" self-assessment quiz. Partner-attributed via
 * [code] (referralCode/slug). 6 questions, one per Lead Capture Evaluation
 * category, each scored to its weight. Ends in a result tier + opt-in form that
 * POSTs /api/public/lead-optin (track=quiz, score in metadata) -> partner CRM.
 * Standalone, light mode, bilingual EN/ES. Honesty: no fabricated stats — the
 * score is the owner's own self-rating; the real number comes from the eval.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? ''
type L = 'en' | 'es'

interface Q { cat: { en: string; es: string }; q: { en: string; es: string }; opts: { en: string; es: string; pts: number }[] }

const QUESTIONS: Q[] = [
  { cat: { en: 'Speed to Answer', es: 'Rapidez al contestar' }, q: { en: 'When a brand-new customer calls during business hours, they usually…', es: 'Cuando un cliente nuevo llama en horario laboral, normalmente…' }, opts: [
    { en: 'Reach a live person in seconds', es: 'Habla con una persona en segundos', pts: 20 },
    { en: 'Wait through several rings', es: 'Espera varios timbres', pts: 12 },
    { en: 'Get voicemail', es: 'Cae en el buzón', pts: 4 },
    { en: 'Not sure', es: 'No estoy seguro', pts: 0 } ] },
  { cat: { en: 'Greeting', es: 'Saludo' }, q: { en: 'A stranger calling hears, in the first 5 seconds…', es: 'Un desconocido que llama escucha, en los primeros 5 segundos…' }, opts: [
    { en: 'A name + warm "how can I help?"', es: 'Un nombre + "¿cómo te ayudo?"', pts: 15 },
    { en: 'Just the business name', es: 'Solo el nombre del negocio', pts: 9 },
    { en: 'A quick "Hello?"', es: 'Un rápido "¿Aló?"', pts: 5 },
    { en: 'A recording / no idea', es: 'Una grabación / ni idea', pts: 0 } ] },
  { cat: { en: 'Lead Capture', es: 'Captura del cliente' }, q: { en: 'When a new caller hangs up without booking, do you have their name + number?', es: 'Cuando un cliente nuevo cuelga sin agendar, ¿tienes su nombre + número?' }, opts: [
    { en: 'Always', es: 'Siempre', pts: 20 },
    { en: 'Usually', es: 'Casi siempre', pts: 13 },
    { en: 'Only if they booked', es: 'Solo si agendó', pts: 5 },
    { en: 'Often not', es: 'Muchas veces no', pts: 0 } ] },
  { cat: { en: 'Next Step', es: 'Siguiente paso' }, q: { en: 'At the end of a new-customer call, someone…', es: 'Al final de una llamada con cliente nuevo, alguien…' }, opts: [
    { en: 'Offers a clear next step every time', es: 'Ofrece un siguiente paso claro siempre', pts: 20 },
    { en: 'Usually', es: 'Casi siempre', pts: 13 },
    { en: 'Only if asked', es: 'Solo si lo piden', pts: 6 },
    { en: 'Rarely', es: 'Rara vez', pts: 0 } ] },
  { cat: { en: 'After-Hours', es: 'Fuera de horario' }, q: { en: 'A customer calling after close gets…', es: 'Un cliente que llama después de cerrar recibe…' }, opts: [
    { en: 'A 24/7 answer or clean callback path', es: 'Respuesta 24/7 o devolución clara', pts: 15 },
    { en: 'A clear voicemail with hours', es: 'Un buzón claro con el horario', pts: 9 },
    { en: 'A full / old mailbox', es: 'Un buzón lleno / viejo', pts: 3 },
    { en: 'No idea', es: 'Ni idea', pts: 0 } ] },
  { cat: { en: 'Follow-Up', es: 'Seguimiento' }, q: { en: 'You miss a call from a potential customer. You call back…', es: 'Pierdes la llamada de un cliente potencial. Devuelves la llamada…' }, opts: [
    { en: 'Within the hour', es: 'En menos de una hora', pts: 10 },
    { en: 'Same day', es: 'El mismo día', pts: 6 },
    { en: 'Next day', es: 'Al día siguiente', pts: 3 },
    { en: 'When I get to it / never', es: 'Cuando puedo / nunca', pts: 0 } ] },
]

const TIERS = [
  { min: 85, en: { t: 'Sealed Tight', m: 'Few customers escape you. A real test call confirms it — want proof on paper?' }, es: { t: 'Bien Sellado', m: 'Pocos clientes se te escapan. Una llamada de prueba lo confirma — ¿quieres la prueba en papel?' } },
  { min: 65, en: { t: 'Minor Leaks', m: 'A few customers are slipping out. The free eval pinpoints which gap and how to close it.' }, es: { t: 'Fugas Menores', m: 'Algunos clientes se escapan. La evaluación gratis identifica cuál fuga y cómo cerrarla.' } },
  { min: 40, en: { t: 'Leaking', m: 'Paying customers are getting away. The scorecard ranks your top 2–3 fixes by impact.' }, es: { t: 'Con Fugas', m: 'Clientes que pagan se están yendo. El reporte ordena tus 2–3 mejoras por impacto.' } },
  { min: 0,  en: { t: 'Wide Open', m: 'Good news — the most recoverable kind of problem. Let’s run a real test call and map it.' }, es: { t: 'Abierto de Par en Par', m: 'Buenas noticias — el problema más recuperable. Hagamos una llamada de prueba real y mapeémoslo.' } },
]

const T = {
  en: { title: 'How leaky is your phone?', sub: '6 quick questions. Get your leak score — then a free real-world test call if you want the real number.',
    q: 'Question', of: 'of', back: 'Back', your: 'Your leak score', want: 'Want the real number?', wantSub: 'That score is your own estimate. The free evaluation places a real test call and hands you a branded scorecard — yours to keep, no pitch.',
    business: 'Business name', name: 'Your name', email: 'Email', phone: 'Best phone', niche: 'Type of business',
    consent: 'I’d like a free evaluation and agree to be contacted about it.', submit: 'Get my free evaluation', sending: 'Sending…',
    okH: 'You’re on the list.', okSub: 'We’ll reach out to set up your free evaluation. The report is yours to keep.', err: 'Something went wrong. Try again.', retake: 'Retake quiz' },
  es: { title: '¿Qué tan fugado está tu teléfono?', sub: '6 preguntas rápidas. Obtén tu puntaje de fugas — y una llamada de prueba real y gratis si quieres el número de verdad.',
    q: 'Pregunta', of: 'de', back: 'Atrás', your: 'Tu puntaje de fugas', want: '¿Quieres el número real?', wantSub: 'Ese puntaje es tu propio estimado. La evaluación gratis hace una llamada de prueba real y te entrega un reporte con marca — es tuyo, sin venta.',
    business: 'Nombre del negocio', name: 'Tu nombre', email: 'Correo', phone: 'Mejor teléfono', niche: 'Tipo de negocio',
    consent: 'Quiero una evaluación gratis y acepto que me contacten sobre ella.', submit: 'Quiero mi evaluación gratis', sending: 'Enviando…',
    okH: 'Ya estás en la lista.', okSub: 'Te contactaremos para coordinar tu evaluación gratis. El reporte es tuyo.', err: 'Algo salió mal. Intenta de nuevo.', retake: 'Repetir quiz' },
}

export default function QuizPage() {
  const params = useParams()
  const sp = useSearchParams()
  const code = (params.code as string) || ''
  const [lang, setLang] = useState<L>(sp.get('lang') === 'es' ? 'es' : 'en')
  const t = T[lang]

  const [step, setStep] = useState(0) // 0..5 questions, 6 = result
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(-1))
  const [f, setF] = useState({ businessName: '', contactName: '', email: '', phone: '', niche: '' })
  const [consent, setConsent] = useState(true)
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [founding, setFounding] = useState<{ remaining: number; cap: number; full: boolean } | null>(null)

  useEffect(() => {
    if (!code) return
    fetch(`${API}/api/public/founding-status/${encodeURIComponent(code)}`)
      .then((r) => r.json()).then((d) => setFounding(d.data)).catch(() => {})
  }, [code])

  const score = useMemo(() => answers.reduce((s, a, i) => s + (a >= 0 ? QUESTIONS[i]!.opts[a]!.pts : 0), 0), [answers])
  const tier = TIERS.find((x) => score >= x.min)!
  const tierTxt = tier[lang]

  function answer(optIdx: number) {
    const next = [...answers]; next[step] = optIdx; setAnswers(next)
    setTimeout(() => setStep((s) => s + 1), 150)
  }
  function set(k: keyof typeof f, v: string) { setF((s) => ({ ...s, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.businessName && !f.contactName && !f.email && !f.phone) { setState('err'); return }
    setState('sending')
    try {
      const r = await fetch(`${API}/api/public/lead-optin`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, track: 'quiz', ...f, locale: lang, consent, quizScore: score, quizTier: tier.en.t }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setState('ok')
    } catch { setState('err') }
  }

  const pct = Math.round(((step) / QUESTIONS.length) * 100)

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f7', color: '#0a201f', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <strong style={{ fontSize: 18, color: '#0e8f8f' }}>MyOrbisVoice</strong>
        <button onClick={() => setLang(lang === 'en' ? 'es' : 'en')} style={{ fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #cde0df', background: '#fff', cursor: 'pointer', color: '#0a201f' }}>
          {lang === 'en' ? 'Español' : 'English'}
        </button>
      </div>

      <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #d8e6e5', borderRadius: 18, padding: 28, boxShadow: '0 20px 50px -35px rgba(0,0,0,.3)' }}>
        {step < QUESTIONS.length && (
          <>
            {step === 0 && <>
              {founding && !founding.full && (
                <div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 12, background: '#e8f6f5', color: '#0c6f6e' }}>
                  {lang === 'es' ? `🔥 ${founding.remaining} de ${founding.cap} cupos de fundadores este mes` : `🔥 ${founding.remaining} of ${founding.cap} founding spots left this month`}
                </div>
              )}
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>{t.title}</h1><p style={{ fontSize: 15, color: '#3f615f', lineHeight: 1.5, margin: '0 0 20px' }}>{t.sub}</p></>}
            <div style={{ height: 6, background: '#e3eeec', borderRadius: 99, marginBottom: 18 }}><div style={{ width: `${pct}%`, height: '100%', background: '#0e8f8f', borderRadius: 99, transition: 'width .2s' }} /></div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#0e8f8f', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{QUESTIONS[step]![lang === 'es' ? 'cat' : 'cat'][lang]} · {t.q} {step + 1} {t.of} {QUESTIONS.length}</p>
            <h2 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3, margin: '0 0 16px' }}>{QUESTIONS[step]!.q[lang]}</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {QUESTIONS[step]!.opts.map((o, i) => (
                <button key={i} onClick={() => answer(i)} style={{ textAlign: 'left', padding: '13px 16px', borderRadius: 11, border: `1px solid ${answers[step] === i ? '#0e8f8f' : '#cde0df'}`, background: answers[step] === i ? '#e8f6f5' : '#fff', fontSize: 15, color: '#0a201f', cursor: 'pointer' }}>
                  {o[lang]}
                </button>
              ))}
            </div>
            {step > 0 && <button onClick={() => setStep((s) => s - 1)} style={{ marginTop: 16, fontSize: 13, color: '#3f615f', background: 'none', border: 'none', cursor: 'pointer' }}>← {t.back}</button>}
          </>
        )}

        {step >= QUESTIONS.length && state !== 'ok' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 13, color: '#3f615f', margin: 0 }}>{t.your}</p>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#0e8f8f', lineHeight: 1.1 }}>{score}<span style={{ fontSize: 22, color: '#6b8a88' }}>/100</span></div>
              <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 999, background: '#e8f6f5', color: '#0c6f6e', fontWeight: 700, fontSize: 14, marginTop: 4 }}>{tierTxt.t}</div>
              <p style={{ fontSize: 15, color: '#3f615f', lineHeight: 1.5, margin: '12px 0 0' }}>{tierTxt.m}</p>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e3eeec', margin: '20px 0' }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>{t.want}</h2>
            <p style={{ fontSize: 13, color: '#3f615f', lineHeight: 1.5, margin: '0 0 16px' }}>{t.wantSub}</p>
            <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
              <Input label={t.business} value={f.businessName} onChange={(v) => set('businessName', v)} />
              <Input label={t.name} value={f.contactName} onChange={(v) => set('contactName', v)} />
              <Input label={t.email} type="email" value={f.email} onChange={(v) => set('email', v)} />
              <Input label={t.phone} type="tel" value={f.phone} onChange={(v) => set('phone', v)} />
              <Input label={t.niche} value={f.niche} onChange={(v) => set('niche', v)} />
              <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#3f615f' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2 }} />
                <span>{t.consent}</span>
              </label>
              {state === 'err' && <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{t.err}</p>}
              <button type="submit" disabled={state === 'sending'} style={{ marginTop: 4, padding: '12px 16px', borderRadius: 11, border: 'none', background: 'linear-gradient(100deg, #0e8f8f, #0c6f6e)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: state === 'sending' ? 0.7 : 1 }}>
                {state === 'sending' ? t.sending : t.submit}
              </button>
            </form>
            <button onClick={() => { setStep(0); setAnswers(Array(QUESTIONS.length).fill(-1)); setState('idle') }} style={{ marginTop: 14, fontSize: 13, color: '#3f615f', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>↻ {t.retake}</button>
          </>
        )}

        {state === 'ok' && (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>{t.okH}</h1>
            <p style={{ fontSize: 15, color: '#3f615f', lineHeight: 1.5 }}>{t.okSub}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#3f615f' }}>
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #cde0df', fontSize: 15, background: '#fff', color: '#0a201f' }} />
    </label>
  )
}
