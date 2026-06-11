/**
 * Lead Capture Evaluation — customer-facing report (HTML, doubles as PDF via print).
 * Public, no login: the partner shares a token link; the owner views the report.
 * Renders fully via CSS so headless print produces a clean PDF. Bilingual EN/ES.
 * Data comes from the saved Contact.metadataJson (score, grade, per-category points).
 */

type Lang = 'en' | 'es'

interface Grade { min: number; letter: string; en: string; es: string; color: string }
const GRADES: Grade[] = [
  { min: 90, letter: 'A', en: 'Locked Tight', es: 'Bien cerrado',          color: '#22A565' },
  { min: 75, letter: 'B', en: 'Solid — Minor Leaks', es: 'Sólido — fugas menores', color: '#27B08A' },
  { min: 60, letter: 'C', en: 'Leaking Leads', es: 'Perdiendo clientes',    color: '#C99A1E' },
  { min: 40, letter: 'D', en: 'Major Leaks', es: 'Fugas importantes',       color: '#D87A2B' },
  { min: 0,  letter: 'F', en: 'Critical', es: 'Crítico',                    color: '#D6453A' },
]
function gradeFor(s: number): Grade { return GRADES.find((g) => s >= g.min) ?? GRADES[GRADES.length - 1]! }

const VERDICTS: Record<string, { en: string; es: string }> = {
  A: { en: 'Your phones rarely let a lead slip. Keep it up and keep an eye on after-hours coverage.',
       es: 'Tus teléfonos casi nunca dejan escapar un lead. Sigue así y vigila la cobertura fuera de horario.' },
  B: { en: 'Strong core. One or two fixable gaps (usually after-hours or follow-up) are costing you a few jobs.',
       es: 'Base sólida. Una o dos fugas arreglables (normalmente fuera de horario o seguimiento) te están costando algunos trabajos.' },
  C: { en: 'Business hours hold up, but real money slips through the gaps — mostly after-hours and follow-up.',
       es: 'El horario de atención aguanta, pero se escapa dinero real por las fugas — sobre todo fuera de horario y seguimiento.' },
  D: { en: 'Your phones do the basics during business hours, but a real share of callers slip away. That is recoverable — a pool of jobs sitting on the table, not lost demand.',
       es: 'Tus teléfonos hacen lo básico en horario, pero se escapa una parte real de los que llaman. Eso es recuperable — trabajos sobre la mesa, no demanda perdida.' },
  F: { en: 'Most callers who try to reach you are lost right now. That is the highest-upside fix you have — the demand is already there.',
       es: 'Ahora mismo se pierde a la mayoría de los que intentan llamarte. Es el arreglo de mayor impacto que tienes — la demanda ya está ahí.' },
}

interface Cat { key: string; max: number; en: string; es: string; levels: { pts: number; en: string; es: string }[] }
const CATS: Cat[] = [
  { key: 'speed', max: 20, en: 'Speed to Answer', es: 'Velocidad de respuesta', levels: [
    { pts: 20, en: 'Answered live within ~4 rings.', es: 'Contestaron en vivo en ~4 timbres.' },
    { pts: 13, en: 'Answered live, but in 5–8 rings.', es: 'Contestaron en vivo, pero en 5–8 timbres.' },
    { pts: 8,  en: 'Answered after a long hold or transfers.', es: 'Contestaron tras una espera larga o transferencias.' },
    { pts: 4,  en: 'Went to voicemail during open hours.', es: 'Fue a buzón en horario de atención.' },
    { pts: 0,  en: 'Rang out — no answer, no voicemail.', es: 'Sonó sin respuesta ni buzón.' } ] },
  { key: 'greeting', max: 15, en: 'Greeting & Professionalism', es: 'Saludo y profesionalismo', levels: [
    { pts: 15, en: 'Warm branded greeting with a name and an offer to help.', es: 'Saludo cálido con marca, un nombre y oferta de ayuda.' },
    { pts: 10, en: 'Business name stated and professional, but no name or offer to help.', es: 'Dijeron el nombre del negocio, profesional, pero sin nombre ni oferta de ayuda.' },
    { pts: 5,  en: 'Generic greeting — unclear if you reached the right place.', es: 'Saludo genérico — no quedó claro si era el lugar correcto.' },
    { pts: 2,  en: 'Rushed, distracted, or unprofessional.', es: 'Apurado, distraído o poco profesional.' } ] },
  { key: 'capture', max: 20, en: 'Lead Capture', es: 'Captura del lead', levels: [
    { pts: 20, en: 'Captured a name, a number, and the need.', es: 'Capturaron nombre, teléfono y la necesidad.' },
    { pts: 12, en: 'Captured the need and one contact detail, but not a full name + number.', es: 'Capturaron la necesidad y un dato de contacto, pero no nombre completo + número.' },
    { pts: 5,  en: 'Talked through the need but took no contact info.', es: 'Hablaron de la necesidad pero no tomaron contacto.' },
    { pts: 0,  en: 'Ended the call without capturing anything.', es: 'Colgaron sin capturar nada.' } ] },
  { key: 'conversion', max: 20, en: 'Conversion Action', es: 'Acción de conversión', levels: [
    { pts: 20, en: 'Offered a concrete next step — booked or a set time to talk.', es: 'Ofrecieron un próximo paso concreto — cita u hora fija para hablar.' },
    { pts: 12, en: 'Soft next step — a callback with a name or timeframe.', es: 'Paso suave — una devolución con nombre o tiempo.' },
    { pts: 6,  en: 'Vague — "call us back if you want to schedule" puts the work on the caller.', es: 'Vago — "llámanos si quieres agendar" le deja el trabajo a quien llama.' },
    { pts: 0,  en: 'No next step offered at all.', es: 'No ofrecieron ningún próximo paso.' } ] },
  { key: 'afterhours', max: 15, en: 'After-Hours Coverage', es: 'Cobertura fuera de horario', levels: [
    { pts: 15, en: 'Live answer or smart routing that can book or triage.', es: 'Respuesta en vivo o ruteo inteligente que agenda o tría.' },
    { pts: 10, en: 'Professional voicemail with name, hours, and a callback promise.', es: 'Buzón profesional con nombre, horario y promesa de devolver la llamada.' },
    { pts: 5,  en: 'Generic voicemail with no useful info.', es: 'Buzón genérico sin información útil.' },
    { pts: 0,  en: 'Rang out — no voicemail, no hours, no callback path. Every after-hours caller is lost.', es: 'Sonó sin parar — sin buzón, sin horario, sin ruta de devolución. Cada llamada fuera de horario se pierde.' } ] },
  { key: 'followup', max: 10, en: 'Follow-Up & Callback', es: 'Seguimiento y devolución', levels: [
    { pts: 10, en: 'Called or texted back within ~1 business hour.', es: 'Llamaron o enviaron texto en ~1 hora hábil.' },
    { pts: 6,  en: 'Called back the same day — solid, but not within the first hour.', es: 'Devolvieron la llamada el mismo día — bien, pero no en la primera hora.' },
    { pts: 3,  en: 'Called back the next day.', es: 'Devolvieron la llamada al día siguiente.' },
    { pts: 0,  en: 'Never followed up (by 48h).', es: 'Nunca dieron seguimiento (en 48h).' } ] },
]

const L = {
  docKicker: { en: 'Lead Capture Evaluation', es: 'Evaluación de captura de leads' },
  partnerLine: { en: 'Lead evaluation by your local growth partner', es: 'Evaluación de leads por tu socio de crecimiento local' },
  preparedFor: { en: 'Prepared for the owner', es: 'Preparado para el dueño' },
  subhead: { en: 'How many of your phone leads actually get captured — scored from real test calls.', es: 'Cuántos de tus leads telefónicos realmente se capturan — evaluado con llamadas de prueba reales.' },
  scorecard: { en: 'The 6-point scorecard', es: 'La tarjeta de 6 puntos' },
  biggest: { en: 'Biggest leak', es: 'Mayor fuga' },
  costH: { en: 'What the leak is costing', es: 'Cuánto te cuesta la fuga' },
  missed: { en: 'Est. missed leads / month', es: 'Leads perdidos estimados / mes' },
  lost: { en: 'Est. lost revenue / month', es: 'Ingresos perdidos estimados / mes' },
  costNote: { en: 'Estimate from your own numbers — not a claimed statistic. Change any input and it updates.', es: 'Estimación con tus propios números — no una estadística. Cambia cualquier dato y se actualiza.' },
  addendumKicker: { en: 'Addendum', es: 'Apéndice' },
  addendumTitle: { en: 'What you can do about it', es: 'Qué puedes hacer al respecto' },
  addendumLead: { en: 'Three honest paths. The score above is the same no matter which you pick — this is just what it takes to close the gap.', es: 'Tres caminos honestos. El puntaje de arriba es el mismo elijas el que elijas — esto es solo lo que toma cerrar la brecha.' },
  best: { en: 'Recommended', es: 'Recomendado' },
  rWho: { en: 'Who runs it', es: 'Quién lo opera' },
  rSetup: { en: 'Setup effort', es: 'Esfuerzo de configuración' },
  rTtv: { en: 'Time to value', es: 'Tiempo a resultados' },
  rAfter: { en: 'After-hours', es: 'Fuera de horario' },
  rFollow: { en: 'Follow-up speed', es: 'Velocidad de seguimiento' },
  rOngoing: { en: 'Ongoing work', es: 'Trabajo continuo' },
  optDoNothing: { en: 'Do nothing', es: 'No hacer nada' },
  optDoNothingSub: { en: 'Keep things as they are.', es: 'Dejar las cosas como están.' },
  dnWho: { en: 'No one new', es: 'Nadie nuevo' }, dnSetup: { en: 'None', es: 'Ninguno' },
  dnTtv: { en: 'Never', es: 'Nunca' }, dnAfter: { en: 'Still leaking', es: 'Sigue fugando' },
  dnFollow: { en: 'Whenever staff can', es: 'Cuando el personal pueda' }, dnOngoing: { en: '—', es: '—' },
  dnBottom: { en: 'The leak keeps costing you', es: 'La fuga te sigue costando' },
  optDiy: { en: 'DIY platform', es: 'Plataforma por tu cuenta' },
  optDiySub: { en: 'Like GoHighLevel — you build it and run it.', es: 'Como GoHighLevel — tú lo construyes y lo operas.' },
  diyWho: { en: 'You + your staff', es: 'Tú + tu personal' }, diySetup: { en: 'Weeks of config', es: 'Semanas de configuración' },
  diyTtv: { en: 'Once you finish building', es: 'Cuando termines de construirlo' }, diyAfter: { en: 'If you wire it', es: 'Si lo configuras' },
  diyFollow: { en: 'Automations you maintain', es: 'Automatizaciones que mantienes' }, diyOngoing: { en: 'You own it all', es: 'Todo recae en ti' },
  diyBottom: { en: 'Powerful, but it is a second job', es: 'Potente, pero es un segundo trabajo' },
  orbySub: { en: 'Done-for-you. Orby answers, books, and follows up 24/7 — in English and Spanish.', es: 'Hecho por nosotros. Orby contesta, agenda y da seguimiento 24/7 — en inglés y español.' },
  orbyWho: { en: 'We do', es: 'Nosotros' }, orbySetup: { en: 'Days, done for you', es: 'Días, hecho por nosotros' },
  orbyTtv: { en: 'This week', es: 'Esta semana' }, orbyAfter: { en: '24/7, never misses', es: '24/7, nunca falla' },
  orbyFollow: { en: 'Within minutes, automatic', es: 'En minutos, automático' }, orbyOngoing: { en: 'None — we run it', es: 'Ninguno — lo operamos' },
  orbyBottom: { en: 'Plug the leak, keep the jobs', es: 'Tapa la fuga, conserva los trabajos' },
  cta: { en: 'Get started with Orby', es: 'Empieza con Orby' },
  ctaFine: { en: 'No card to start. Your details are already on file — setup takes minutes.', es: 'Sin tarjeta para empezar. Tus datos ya están en archivo — la configuración toma minutos.' },
  footBrand: { en: 'MyOrbisResults · MyOrbisVoice', es: 'MyOrbisResults · MyOrbisVoice' },
  footNote: { en: 'This evaluation is independent and based on real test calls.', es: 'Esta evaluación es independiente y se basa en llamadas de prueba reales.' },
}

export interface LeadReportInput {
  businessName: string
  score: number
  grade?: string | null
  scores: Record<string, number>
  locale: Lang
  signupUrl: string
  reportDate: string
  costPerWeek?: number | null
  closeRate?: number | null
  avgValue?: number | null
  notCaptured?: number | null
  pdfUrl?: string | null
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export function renderLeadReportHtml(input: LeadReportInput): string {
  const lang = input.locale === 'es' ? 'es' : 'en'
  const t = (o: { en: string; es: string }) => o[lang]
  const g = gradeFor(input.score)
  const gradeLabel = t(g)

  // Per-category rows.
  const rows = CATS.map((c) => {
    const pts = input.scores[c.key]
    const has = typeof pts === 'number'
    const pct = has ? Math.max(2, Math.round((pts / c.max) * 100)) : 0
    const col = has ? gradeFor(Math.round((pts / c.max) * 100)).color : '#6B7C86'
    const lvl = has ? (c.levels.find((l) => l.pts === pts) ?? c.levels.find((l) => pts >= l.pts)) : null
    const lost = has ? c.max - pts : -1
    return { c, pts, has, pct, col, note: lvl ? t(lvl) : '', lost }
  })
  const leak = rows.filter((r) => r.has && r.lost > 0).sort((a, b) => b.lost - a.lost)[0]

  const rowHtml = rows.map((r) => `
    <div class="row${leak && r.c.key === leak.c.key ? ' leak' : ''}">
      <div class="name">${esc(t(r.c))}${leak && r.c.key === leak.c.key ? ` <span class="flag">${esc(t(L.biggest))}</span>` : ''}</div>
      <div class="pts" style="color:${r.has ? r.col : '#9aa'}">${r.has ? `${r.pts} / ${r.c.max}` : '—'}</div>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
      <div class="bar"><i style="width:${r.pct}%;background:${r.col}"></i></div>
    </div>`).join('')

  // Cost of the leak — only when the owner provided inputs at eval time.
  const notCap = input.notCaptured ?? (input.score >= 90 ? 5 : input.score >= 75 ? 15 : input.score >= 60 ? 30 : input.score >= 40 ? 45 : 60)
  const cpw = input.costPerWeek
  const missed = (cpw != null && cpw > 0) ? cpw * 4.33 * (notCap / 100) : null
  const lost = (missed != null && input.closeRate != null && input.avgValue != null) ? missed * (input.closeRate / 100) * input.avgValue : null
  const money = (v: number) => `$${Math.round(v).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}`
  const costHtml = missed != null ? `
  <h2 class="sec-h">${esc(t(L.costH))}</h2>
  <div class="cost">
    <div class="stat"><div class="k">${esc(t(L.missed))}</div><div class="v">~${Math.round(missed)}</div></div>
    ${lost != null ? `<div class="stat"><div class="k">${esc(t(L.lost))}</div><div class="v red">~${money(lost)}</div></div>` : ''}
  </div>
  <p class="cost-note">${esc(t(L.costNote))}</p>` : ''

  const cmpRow = (label: { en: string; es: string }, dn: string, diy: string, orby: string, dnCls = '', diyCls = '', orbyCls = 'yes') => ({ label: t(label), dn, diy, orby, dnCls, diyCls, orbyCls })
  const cmp = [
    cmpRow(L.rWho, t(L.dnWho), t(L.diyWho), t(L.orbyWho), '', '', ''),
    cmpRow(L.rSetup, t(L.dnSetup), t(L.diySetup), t(L.orbySetup), '', 'meh', 'yes'),
    cmpRow(L.rTtv, t(L.dnTtv), t(L.diyTtv), t(L.orbyTtv), 'no', 'meh', 'yes'),
    cmpRow(L.rAfter, t(L.dnAfter), t(L.diyAfter), t(L.orbyAfter), 'no', '', 'yes'),
    cmpRow(L.rFollow, t(L.dnFollow), t(L.diyFollow), t(L.orbyFollow), 'meh', '', 'yes'),
    cmpRow(L.rOngoing, t(L.dnOngoing), t(L.diyOngoing), t(L.orbyOngoing), '', 'meh', 'yes'),
  ]
  const cell = (v: string, cls: string) => cls ? `<span class="${cls}">${esc(v)}</span>` : esc(v)
  const colRows = (which: 'dn' | 'diy' | 'orby') => cmp.map((r) => {
    const v = r[which]; const cls = which === 'dn' ? r.dnCls : which === 'diy' ? r.diyCls : r.orbyCls
    return `<div class="crow"><div class="rl">${esc(r.label)}</div>${cell(v, cls)}</div>`
  }).join('')

  return `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>${esc(t(L.docKicker))} — ${esc(input.businessName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#0B1A22;--ink-2:#3B4D57;--ink-3:#6B7C86;--line:#E4EAEE;--line-2:#EEF2F5;--bg:#FBFCFD;--panel:#FFF;--brand:#13A1A1;--brand-ink:#0C7C7C;--brand-wash:#E7F5F5;--shadow:0 1px 2px rgba(11,26,34,.04),0 8px 24px rgba(11,26,34,.06)}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font-family:Inter,system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:840px;margin:0 auto;padding:40px 28px 64px}
h1,h2{font-family:Sora,Inter,sans-serif;letter-spacing:-.01em}
a{color:var(--brand-ink);text-decoration:none}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid var(--line);padding-bottom:18px}
.brand{display:flex;align-items:center;gap:10px}
.logo{width:30px;height:30px;border-radius:8px;background:radial-gradient(circle at 30% 30%,#1ED0D0,#0C7C7C);position:relative}
.logo::after{content:"";position:absolute;inset:9px;border-radius:50%;background:#fff;opacity:.92}
.brand b{font-family:Sora;font-weight:700;font-size:15px}.brand span{display:block;font-size:11px;color:var(--ink-3);margin-top:1px}
.meta{text-align:right;font-size:12px;color:var(--ink-3)}
.doc-kicker{font-size:12px;font-weight:600;color:var(--brand-ink);text-transform:uppercase;letter-spacing:.08em;margin-top:22px}
h1{font-size:26px;font-weight:700;margin:8px 0 2px}.biz{font-size:15px;color:var(--ink-2)}
.hero{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;margin:22px 0 8px;padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}
.ring{width:128px;height:128px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${g.color} ${input.score}%,var(--line-2) 0)}
.ring .in{width:104px;height:104px;border-radius:50%;background:var(--panel);display:grid;place-items:center;text-align:center}
.ring .sc{font-family:Sora;font-weight:800;font-size:34px;line-height:1}.ring .of{font-size:11px;color:var(--ink-3);margin-top:2px}
.grade{display:inline-flex;align-items:center;gap:8px;font-family:Sora;font-weight:700;font-size:17px;color:${g.color}}
.pill{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:color-mix(in srgb,${g.color} 14%,#fff);color:${g.color}}
.verdict p{margin:8px 0 0;font-size:15px;color:var(--ink-2);max-width:48ch}
.sec-h{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-3);margin:30px 0 12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.row{display:grid;grid-template-columns:1fr auto;gap:4px 14px;padding:14px 18px;border-bottom:1px solid var(--line-2)}
.row:last-child{border-bottom:0}.row.leak{background:color-mix(in srgb,#D6453A 5%,#fff)}
.row .name{font-weight:600;font-size:14.5px;display:flex;align-items:center;gap:8px}
.row .pts{font-family:Sora;font-weight:700;font-size:14px;white-space:nowrap}
.row .note{grid-column:1/2;font-size:12.5px;color:var(--ink-3);margin-top:1px}
.bar{grid-column:1/3;height:6px;border-radius:999px;background:var(--line-2);overflow:hidden;margin-top:8px}.bar i{display:block;height:100%;border-radius:999px}
.flag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#D6453A;background:color-mix(in srgb,#D6453A 12%,#fff);padding:2px 7px;border-radius:999px}
.cost{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:var(--shadow)}
.stat .k{font-size:12px;color:var(--ink-3)}.stat .v{font-family:Sora;font-weight:800;font-size:26px;margin-top:4px}.stat .v.red{color:#D6453A}
.cost-note{font-size:11.5px;color:var(--ink-3);margin-top:8px}
.addendum{break-before:page;page-break-before:always;margin-top:40px}
.add-lead{font-size:14.5px;color:var(--ink-2);max-width:62ch;margin:6px 0 18px}
.cmp{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:var(--shadow);background:var(--panel)}
.cmp .col{border-left:1px solid var(--line-2)}.cmp .col:first-child{border-left:0}
.cmp .col.win{background:var(--brand-wash);border-left:2px solid var(--brand);box-shadow:inset 0 3px 0 var(--brand)}
.ch{padding:16px;border-bottom:1px solid var(--line-2)}.ch .opt{font-family:Sora;font-weight:700;font-size:15px}.ch .sub{font-size:11.5px;color:var(--ink-3);margin-top:3px;min-height:30px}
.col.win .ch .opt{color:var(--brand-ink)}
.badge-best{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#fff;background:var(--brand);padding:2px 7px;border-radius:999px;margin-bottom:6px}
.crow{padding:11px 16px;border-bottom:1px solid var(--line-2);font-size:12.5px}.crow:last-child{border-bottom:0}
.crow .rl{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3)}
.col.win .crow{font-weight:600}.yes{color:#22A565;font-weight:700}.no{color:#D6453A;font-weight:700}.meh{color:#C99A1E;font-weight:700}
.cta{margin-top:24px;text-align:center}
.cta a{display:inline-block;background:var(--brand);color:#fff;font-family:Sora;font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px;box-shadow:0 6px 18px rgba(19,161,161,.32)}
.cta .fine{font-size:11.5px;color:var(--ink-3);margin-top:9px}
.foot{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-size:11px;color:var(--ink-3);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.printbtn{position:fixed;top:16px;right:16px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 14px;font:600 13px Inter,sans-serif;color:var(--ink-2);cursor:pointer;box-shadow:var(--shadow)}
@media (max-width:640px){.hero{grid-template-columns:1fr;text-align:center;justify-items:center}.cmp{grid-template-columns:1fr}.cmp .col{border-left:0;border-top:1px solid var(--line-2)}.cmp .col:first-child{border-top:0}}
@media print{body{background:#fff}.wrap{max-width:none;padding:0 8mm}.card,.stat,.hero,.cmp,.cta a{box-shadow:none}.printbtn{display:none}}
</style></head><body>
<button class="printbtn" onclick="window.print()">${lang === 'es' ? 'Descargar PDF' : 'Download PDF'}</button>
<div class="wrap">
  <header class="top">
    <div class="brand"><div class="logo"></div><div><b>MyOrbisResults</b><span>${esc(t(L.partnerLine))}</span></div></div>
    <div class="meta">${esc(input.reportDate)}<br>${esc(t(L.preparedFor))}</div>
  </header>
  <div class="doc-kicker">${esc(t(L.docKicker))}</div>
  <h1>${esc(input.businessName)}</h1>
  <div class="biz">${esc(t(L.subhead))}</div>
  <section class="hero">
    <div class="ring"><div class="in"><div><div class="sc">${input.score}</div><div class="of">/ 100</div></div></div></div>
    <div class="verdict"><span class="grade">${g.letter} <span class="pill">${esc(gradeLabel)}</span></span><p>${esc(t(VERDICTS[g.letter]!))}</p></div>
  </section>
  <h2 class="sec-h">${esc(t(L.scorecard))}</h2>
  <div class="card">${rowHtml}</div>
  ${costHtml}
  <section class="addendum">
    <div class="doc-kicker">${esc(t(L.addendumKicker))}</div>
    <h2 style="font-size:22px;font-weight:700;margin:8px 0 2px">${esc(t(L.addendumTitle))}</h2>
    <p class="add-lead">${esc(t(L.addendumLead))}</p>
    <div class="cmp">
      <div class="col"><div class="ch"><div class="opt">${esc(t(L.optDoNothing))}</div><div class="sub">${esc(t(L.optDoNothingSub))}</div></div>${colRows('dn')}<div class="crow" style="font-weight:700;color:#D6453A">${esc(t(L.dnBottom))}</div></div>
      <div class="col"><div class="ch"><div class="opt">${esc(t(L.optDiy))}</div><div class="sub">${esc(t(L.optDiySub))}</div></div>${colRows('diy')}<div class="crow" style="font-weight:600">${esc(t(L.diyBottom))}</div></div>
      <div class="col win"><div class="ch"><span class="badge-best">${esc(t(L.best))}</span><div class="opt">MyOrbisVoice</div><div class="sub">${esc(t(L.orbySub))}</div></div>${colRows('orby')}<div class="crow" style="font-weight:700;color:var(--brand-ink)">${esc(t(L.orbyBottom))}</div></div>
    </div>
    <div class="cta"><a href="${esc(input.signupUrl)}">${esc(t(L.cta))}</a><div class="fine">${esc(t(L.ctaFine))}</div></div>
  </section>
  <footer class="foot"><span>${esc(t(L.footBrand))}</span><span>${esc(t(L.footNote))}</span></footer>
</div></body></html>`
}
