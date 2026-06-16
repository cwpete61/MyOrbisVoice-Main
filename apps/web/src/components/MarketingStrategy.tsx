'use client'

import { useState } from 'react'
import { useLocale } from '@/lib/i18n/I18nProvider'
import { useApi } from '@/hooks/useApi'

/**
 * Marketing Strategy sub-tab of the Inbound Evaluation campaign.
 * Partner-facing playbook for the "Phantom Customer" beta campaign — big idea,
 * offer + beta framing, copy-paste polls/posts/quiz/DM, 4-week calendar, honesty
 * rules. Bilingual via useLocale (data-driven EN/ES, no hardcoded-JSX flags).
 * Source of truth: docs/campaigns/inbound-eval-marketing-strategy.md
 */

type Bi = { en: string; es: string }
const pick = (b: Bi, L: 'en' | 'es') => (L === 'es' ? b.es : b.en)

export function MarketingStrategy() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'
  const { data: me } = useApi<{ partner?: { referralCode?: string } }>('/api/partner/me', [])
  const code = me?.partner?.referralCode || ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const LINK_TRACKS: { key: string; label: Bi; kw: string }[] = [
    { key: 'beta', label: { en: 'Beta recruitment', es: 'Reclutamiento beta' }, kw: 'BETA' },
    { key: 'phantom', label: { en: 'Phantom Customer', es: 'Cliente Fantasma' }, kw: 'TEST' },
    { key: 'competitor', label: { en: 'Competitor steal', es: 'Robo del competidor' }, kw: 'WHO ANSWERS' },
    { key: 'math', label: { en: 'Honest math', es: 'Números honestos' }, kw: 'MATH' },
    { key: 'afterhours', label: { en: 'After-hours self-test', es: 'Prueba fuera de horario' }, kw: 'EVAL' },
  ]

  const TAGLINES: Bi[] = [
    { en: 'See where your customers slip out — before your competitor does.', es: 'Descubre por dónde se te escapan los clientes — antes que tu competencia.' },
    { en: 'Meet the customers you never knew you lost.', es: 'Conoce a los clientes que nunca supiste que perdiste.' },
    { en: 'Find your leaks in 15 minutes. Keep the report forever.', es: 'Encuentra tus fugas en 15 minutos. Quédate el reporte para siempre.' },
  ]

  const NORTH_STAR: Bi = {
    en: 'We place one real test call to your business, like a customer would — then hand you a free scorecard showing exactly where a paying customer would slip away. No pitch. You keep it either way.',
    es: 'Hacemos una llamada de prueba real a tu negocio, como lo haría un cliente — y te entregamos un reporte gratis que muestra exactamente por dónde se te escaparía un cliente que paga. Sin venta. El reporte es tuyo de todas formas.',
  }

  const POLLS: { title: Bi; channel: string; q: Bi; opts: Bi; note: Bi; keyword: string }[] = [
    {
      title: { en: 'The 7pm Saturday Call', es: 'La llamada del sábado a las 7pm' }, channel: 'FB + LinkedIn',
      q: { en: 'A customer calls your business at 7pm on a Saturday. What actually happens?', es: 'Un cliente llama a tu negocio un sábado a las 7pm. ¿Qué pasa de verdad?' },
      opts: { en: 'A real person answers · Goes to voicemail · Rings out / not sure · I never thought about it', es: 'Contesta una persona real · Cae en el buzón · Suena y nadie contesta / no estoy seguro · Nunca lo había pensado' },
      note: { en: 'Lowest-threat opener. The "not sure" options self-identify the owner the eval converts.', es: 'Apertura de menor presión. Las opciones "no estoy seguro" identifican al dueño que convierte la evaluación.' },
      keyword: 'TEST / PRUEBA',
    },
    {
      title: { en: 'Out of 10 calls, how many become customers?', es: 'De cada 10 llamadas, ¿cuántas se vuelven clientes?' }, channel: 'LinkedIn',
      q: { en: 'Out of 10 calls, how many become customers?', es: 'De cada 10 llamadas, ¿cuántas se vuelven clientes?' },
      opts: { en: '7+ · 4–6 · 1–3 · Honestly, no idea', es: '7 o más · 4–6 · 1–3 · La verdad, ni idea' },
      note: { en: 'Benchmark self-rating over-indexes on LinkedIn; "no idea" qualifies owners who lack measurement.', es: 'La autoevaluación funciona mejor en LinkedIn; "ni idea" califica a dueños sin medición.' },
      keyword: 'TEST / PRUEBA',
    },
    {
      title: { en: 'How fast do you call a missed lead back?', es: '¿Qué tan rápido devuelves una llamada perdida?' }, channel: 'FB + LinkedIn',
      q: { en: 'You miss a call from a potential customer. How fast do you call back?', es: 'Pierdes la llamada de un cliente potencial. ¿Qué tan rápido devuelves la llamada?' },
      opts: { en: 'Within the hour · Same day · Next day · When I get to it / never', es: 'En menos de una hora · El mismo día · Al día siguiente · Cuando puedo / nunca' },
      note: { en: 'The options ARE the scorecard bands — voters self-score and want the real number.', es: 'Las opciones SON las bandas del reporte — el dueño se autoevalúa y quiere el número real.' },
      keyword: 'TEST / PRUEBA',
    },
    {
      title: { en: 'What costs you more leads? (closer)', es: '¿Qué te cuesta más clientes? (cierre)' }, channel: 'FB + LinkedIn',
      q: { en: 'If your business loses leads, where’s the leak?', es: 'Si tu negocio pierde clientes, ¿dónde está la fuga?' },
      opts: { en: 'Calls missed during the day · Slow / no callbacks · After-hours + weekends · Genuinely not sure', es: 'Llamadas perdidas durante el día · Devoluciones lentas o nulas · Fuera de horario + fines de semana · De verdad no estoy seguro' },
      note: { en: 'Use to CLOSE a poll rotation — invites the eval as the resolution to earlier polls.', es: 'Úsala para CERRAR una serie de encuestas — invita la evaluación como solución a las anteriores.' },
      keyword: 'TEST / PRUEBA',
    },
  ]

  const TRACKS: { name: Bi; tests: Bi; lead: boolean }[] = [
    { name: { en: 'Beta recruitment', es: 'Reclutamiento beta' }, tests: { en: 'Honest "we need testers" ask. Disarms, justifies the test call, turns "new company" into the reason to say yes. Recommended lead angle for cold audiences.', es: 'Petición honesta "necesitamos testers". Baja la guardia, justifica la llamada, convierte "empresa nueva" en la razón para decir que sí. Ángulo principal recomendado en frío.' }, lead: true },
    { name: { en: 'Phantom Customer (pain)', es: 'Cliente Fantasma (dolor)' }, tests: { en: 'Emotional loss — the customer you never knew you lost. Best as reinforcement and retargeting once the beta ask has run.', es: 'Pérdida emocional — el cliente que nunca supiste que perdiste. Mejor como refuerzo y retargeting después de la petición beta.' }, lead: false },
    { name: { en: 'Competitor steal', es: 'Robo del competidor' }, tests: { en: 'Loss-aversion — the job went to whoever picked up first. Sharp, slightly more aggressive.', es: 'Aversión a la pérdida — el trabajo se fue con quien contestó primero. Directo, algo más agresivo.' }, lead: false },
    { name: { en: 'Honest math', es: 'Números honestos' }, tests: { en: 'Anti-hype — no fake stats, your own numbers. Differentiator and trust builder; converts skeptics.', es: 'Anti-exageración — sin datos falsos, tus propios números. Diferenciador y generador de confianza; convierte escépticos.' }, lead: false },
    { name: { en: 'After-hours self-test', es: 'Prueba fuera de horario' }, tests: { en: 'Low-threat challenge — call your own line tonight. Great top-of-funnel engagement.', es: 'Reto de baja presión — llama a tu propia línea hoy. Excelente para enganchar al inicio del embudo.' }, lead: false },
  ]

  const POSTS: { title: Bi; channel: string; keyword: string; body: Bi }[] = [
    {
      title: { en: 'We need businesses to beta-test our software (beta recruitment, lead angle)', es: 'Necesitamos negocios para probar nuestro software (reclutamiento beta, ángulo principal)' }, channel: 'FB + LinkedIn', keyword: 'BETA',
      body: {
        en: 'Honest ask: MyOrbisVoice is brand new. We built a system that catches the customer calls businesses lose — missed calls, after-hours, no follow-up — and we need real local businesses to test it on. The deal: let us place a few test calls to your line, like a customer would. We score what happens — does the call turn into a booked sale, or quietly slip away? You get a free report with exactly what we found and how to fix it. Yours to keep whether we ever work together or not. Taking 25 businesses this round. Comment BETA.',
        es: 'Petición honesta: MyOrbisVoice es completamente nueva. Construimos un sistema que captura las llamadas de clientes que los negocios pierden — llamadas perdidas, fuera de horario, sin seguimiento — y necesitamos negocios locales reales para probarlo. El trato: déjanos hacer unas llamadas de prueba a tu línea, como lo haría un cliente. Calificamos qué pasa — ¿la llamada se vuelve una venta agendada, o se escapa en silencio? Recibes un reporte gratis con exactamente lo que encontramos y cómo arreglarlo. Es tuyo trabajemos juntos o no. Tomamos 25 negocios esta ronda. Escribe BETA.',
      },
    },
    {
      title: { en: 'Does your call become a sale — or slip away? (beta, direct)', es: '¿Tu llamada se vuelve venta — o se escapa? (beta, directo)' }, channel: 'FB + LinkedIn', keyword: 'BETA',
      body: {
        en: 'Quick question every owner should be able to answer but most can’t: when a new customer calls you, does that call become a booked sale — or does it quietly slip away? We’re a new company beta-testing software that catches lost calls, and we’ll find out for you, free. We place a few real test calls to your business and send you a one-page report: what happened, where you’re leaking, and the 2–3 fixes that matter most. No pitch, you keep it. We need real businesses to test on — 25 spots this round. Comment BETA.',
        es: 'Pregunta rápida que todo dueño debería poder responder pero casi ninguno puede: cuando un cliente nuevo te llama, ¿esa llamada se vuelve una venta agendada — o se escapa en silencio? Somos una empresa nueva probando un software que captura llamadas perdidas, y lo averiguamos por ti, gratis. Hacemos unas llamadas de prueba reales a tu negocio y te mandamos un reporte de una página: qué pasó, dónde estás perdiendo, y las 2–3 mejoras que más importan. Sin venta, te lo quedas. Necesitamos negocios reales para probar — 25 lugares esta ronda. Escribe BETA.',
      },
    },
    {
      title: { en: 'The 6:50pm Voicemail (missed-call story)', es: 'El buzón de las 6:50pm (historia de llamada perdida)' }, channel: 'Facebook', keyword: 'TEST / PRUEBA',
      body: {
        en: 'A customer called your shop last Tuesday at 6:50pm. They had a job for you. Real money. They let it ring, got the voicemail, hung up, and called the next name on Google. You never heard the phone. You’ll never know their name. There’s no report that shows you that one — it just quietly didn’t happen. That’s the before. The after I keep seeing once an owner plugs the gap: the 6:50pm call gets caught, the next step gets offered, and the job that would’ve walked stays on the books. The bridge is just knowing where YOUR gap is. So this week I’m doing free 15-minute lead evaluations — I call your line like a regular customer, then send you a one-page scorecard. You keep it either way. No pitch. Comment TEST.',
        es: 'Un cliente llamó a tu negocio el martes pasado a las 6:50pm. Tenía trabajo para ti. Dinero de verdad. Dejó sonar, cayó en el buzón, colgó y llamó al siguiente de Google. Nunca escuchaste el teléfono. Nunca sabrás su nombre. No hay ningún reporte que te muestre esa llamada — simplemente no pasó, en silencio. Ese es el antes. El después que sigo viendo cuando un dueño cierra la fuga: la llamada de las 6:50pm se contesta, se ofrece el siguiente paso, y el trabajo que se iba a ir se queda. El puente es simplemente saber dónde está TU fuga. Por eso esta semana estoy haciendo evaluaciones de 15 minutos gratis — llamo a tu línea como un cliente normal y te mando un reporte de una página. Es tuyo de todas formas. Sin venta. Escribe PRUEBA.',
      },
    },
    {
      title: { en: 'Call your own business at 8pm (after-hours)', es: 'Llama a tu propio negocio a las 8pm (fuera de horario)' }, channel: 'LinkedIn (dental/legal-safe)', keyword: 'EVAL',
      body: {
        en: 'Try this tonight. Call your own business line at 8pm. Whatever you hear in those 20 seconds is exactly what a customer with money and a need hears. A clean voicemail with your name, hours, and "we’ll call you back"? Good — that’s a lead you can still save. A full mailbox, a line that rings forever, or a recording that says nothing useful? That customer is already dialing someone else. After hours is where most local businesses bleed the most. I’m a new company and I run a free 15-minute lead evaluation that maps exactly that. Comment EVAL or message me.',
        es: 'Haz esto hoy en la noche. Llama a tu propia línea a las 8pm. Lo que escuches en esos 20 segundos es exactamente lo que escucha un cliente con dinero y una necesidad. ¿Un buzón claro con tu nombre, tu horario y "te llamamos de vuelta"? Bien — ese cliente todavía lo puedes salvar. ¿Un buzón lleno, una línea que suena para siempre, o una grabación que no dice nada útil? Ese cliente ya está marcando a otro. Fuera de horario es donde más sangran los negocios locales. Soy una empresa nueva y hago una evaluación gratis de 15 minutos que mapea justo eso. Comenta EVAL o mándame un mensaje.',
      },
    },
    {
      title: { en: 'Your competitor answered on the second ring', es: 'Tu competencia contestó al segundo timbre' }, channel: 'Facebook', keyword: 'WHO ANSWERS / QUIÉN CONTESTA',
      body: {
        en: 'Uncomfortable truth: most of the time a customer picks a competitor over you, it has nothing to do with price, reviews, or quality. They called you. It went to voicemail. They called the next shop. Someone answered on the second ring, booked them, done. You were never even in the running — and you’d swear you never lost that customer, because you never knew they called. When the work is close, the business goes to whoever picks up first. I’ll show you exactly what happens when someone calls YOUR line — free 15-min eval, no pitch, I’m new and learning from real owners. Comment WHO ANSWERS.',
        es: 'Una verdad incómoda: la mayoría de las veces que un cliente elige a tu competencia en vez de a ti, no tiene nada que ver con precio, reseñas o calidad. Te llamaron. Cayó en el buzón. Llamaron al siguiente negocio. Alguien contestó al segundo timbre, los agendó, listo. Ni siquiera estabas en la carrera — y jurarías que nunca perdiste a ese cliente, porque nunca supiste que llamó. Cuando el trabajo es parecido, el negocio se va con el que contesta primero. Te muestro exactamente qué pasa cuando alguien llama a TU línea — evaluación gratis de 15 min, sin venta, soy nuevo y estoy aprendiendo de dueños reales. Escribe QUIÉN CONTESTA.',
      },
    },
    {
      title: { en: 'Founding 25: being brand new is the reason to say yes', es: 'Fundadores 25: ser nuevo es la razón para decir que sí' }, channel: 'LinkedIn + FB', keyword: 'FOUNDING / FUNDADOR',
      body: {
        en: 'Most companies hide that they’re brand new. I’m leading with it. MyOrbisVoice is in beta — I’m not trying to close you, I’m trying to learn from real local owners what actually breaks when a customer calls. In exchange for 15 honest minutes you get a branded Lead Capture Scorecard: I place a live test call, score six things — speed to answer, greeting, lead capture, next step, after-hours, follow-up — and send you the 2–3 fixes that matter most. Yours to keep whether we ever work together or not. I’m taking a small founding group this week so each scorecard gets real attention — not a fake countdown, an actual cap I’ll honor. Comment FOUNDING.',
        es: 'La mayoría de las empresas esconde que son nuevas. Yo lo digo de frente. MyOrbisVoice está en beta — no estoy tratando de cerrarte una venta, estoy tratando de aprender de dueños locales reales qué se rompe cuando un cliente llama. A cambio de 15 minutos honestos recibes un Reporte de Captura de Clientes con marca: hago una llamada de prueba real, evalúo seis cosas — rapidez al contestar, saludo, captura, siguiente paso, fuera de horario, seguimiento — y te mando las 2–3 mejoras que más importan. Es tuyo trabajemos juntos o no. Estoy tomando un grupo fundador pequeño esta semana para que cada reporte reciba atención real — no es un reloj falso, es un límite real que voy a respetar. Comenta FUNDADOR.',
      },
    },
    {
      title: { en: "It's not a guess, here's the math", es: 'No es una adivinanza, estos son los números' }, channel: 'FB + LinkedIn', keyword: 'MATH / NÚMEROS',
      body: {
        en: 'You’ve seen ads scream "You’re losing $4,800 a month!" I won’t do that — I don’t know your numbers, and neither do they. Here’s the honest version. The free eval ends with an optional estimate built from YOUR three numbers: how many calls a week, your close rate, your average job value. We multiply those by how many leads the test call shows are slipping, and you get a labeled estimate of what’s leaking each month. Not a stat I made up — your own math, in front of you. If it’s small, great, that’s money you’re keeping. If it’s big, now you can see it. Comment MATH.',
        es: 'Seguro has visto anuncios que gritan "¡Estás perdiendo $4,800 al mes!" Yo no voy a hacer eso — no conozco tus números, y ellos tampoco. Esta es la versión honesta. La evaluación gratis termina con un estimado opcional construido con TUS tres números: cuántas llamadas por semana, tu tasa de cierre, tu valor promedio por trabajo. Los multiplicamos por cuántos clientes muestra la llamada de prueba que se están escapando, y obtienes un estimado etiquetado de lo que se fuga cada mes. No es un dato que inventé — son tus propios números, frente a ti. Si es poco, perfecto, ese dinero lo estás reteniendo. Si es mucho, ahora lo puedes ver. Comenta NÚMEROS.',
      },
    },
    {
      title: { en: "The honest pitch: I'd rather you keep the report than buy", es: 'La oferta honesta: prefiero que te quedes el reporte a que compres' }, channel: 'LinkedIn (dental/legal-safe)', keyword: 'HONEST / HONESTO',
      body: {
        en: 'Weird thing for a founder to say: right now I don’t need you to buy anything. I need proof that the free Lead Capture Evaluation actually helps real owners. So the deal is one-directional: I call your line like a customer, score six things, hand you a one-page report with your biggest leak and the 2–3 fixes that matter. You keep it. We may never talk again — that’s fine. If it shows you’re locked tight, you’ll sleep better. If it shows leaks, you can fix most of them yourself with what’s on the page. Comment HONEST.',
        es: 'Algo raro de decir para un fundador: ahora mismo no necesito que me compres nada. Necesito pruebas de que la Evaluación de Captura de Clientes gratis de verdad ayuda a dueños reales. Así que el trato es de una sola dirección: llamo a tu línea como un cliente, evalúo seis cosas, y te entrego un reporte de una página con tu fuga más grande y las 2–3 mejoras que importan. Te lo quedas. Quizás nunca volvamos a hablar — está bien. Si muestra que estás bien sellado, dormirás mejor. Si muestra fugas, la mayoría las puedes arreglar tú mismo con lo que está en la página. Comenta HONESTO.',
      },
    },
  ]

  const QUIZ_TIERS: { range: string; tier: Bi; msg: Bi }[] = [
    { range: '85–100', tier: { en: 'Sealed Tight', es: 'Bien Sellado' }, msg: { en: 'Few phantom customers escape you. A real test call confirms it — want proof on paper?', es: 'Pocos clientes fantasma se te escapan. Una llamada de prueba lo confirma — ¿quieres la prueba en papel?' } },
    { range: '65–84', tier: { en: 'Minor Leaks', es: 'Fugas Menores' }, msg: { en: 'A few customers are slipping out. The free eval pinpoints which gap and how to close it.', es: 'Algunos clientes se están escapando. La evaluación gratis identifica cuál fuga y cómo cerrarla.' } },
    { range: '40–64', tier: { en: 'Leaking', es: 'Con Fugas' }, msg: { en: 'Paying customers are getting away. The scorecard ranks your top 2–3 fixes by impact.', es: 'Clientes que pagan se están yendo. El reporte ordena tus 2–3 mejoras por impacto.' } },
    { range: '0–39', tier: { en: 'Wide Open', es: 'Abierto de Par en Par' }, msg: { en: 'Good news — the most recoverable kind of problem. Let’s run a real test call and map it.', es: 'Buenas noticias — el tipo de problema más recuperable. Hagamos una llamada de prueba real y mapeémoslo.' } },
  ]

  const FORMATS: { title: Bi; desc: Bi }[] = [
    { title: { en: 'Video 1 — "We go first" method demo (45–75s)', es: 'Video 1 — Demo del método "nosotros vamos primero" (45–75s)' }, desc: { en: 'Reels/TikTok/Shorts. Founder runs the exact test on a demo line, on camera, then shows the 6-category A–F scorecard. No fake emergency, no pitch. EN voiceover + ES subtitles.', es: 'Reels/TikTok/Shorts. El fundador hace la prueba exacta en una línea demo, en cámara, y muestra el reporte A–F de 6 categorías. Sin emergencia falsa, sin venta. Voz en inglés + subtítulos en español.' } },
    { title: { en: 'Video 2 — "We called 10 local [vertical]s"', es: 'Video 2 — "Llamamos a 10 [vertical]s locales"' }, desc: { en: 'Anonymized, one per vertical. Numbers self-sourced from the founder’s own calls (honest, observable). Doubles as partner proof. Keyword SCORE.', es: 'Anonimizado, uno por vertical. Los números salen de las propias llamadas del fundador (honesto, verificable). Sirve también como prueba para socios. Palabra clave SCORE.' } },
    { title: { en: 'Carousel — "The 6 things we score" (8 slides)', es: 'Carrusel — "Las 6 cosas que evaluamos" (8 láminas)' }, desc: { en: 'One slide per category with its point value. Text-as-overlay so one design serves EN + ES via a swapped text layer.', es: 'Una lámina por categoría con su puntaje. Texto sobrepuesto para que un diseño sirva EN + ES cambiando solo la capa de texto.' } },
    { title: { en: 'Carousel — Sample scorecard reveal', es: 'Carrusel — Reporte de muestra' }, desc: { en: 'Annotated fictional scorecard, clearly labeled hypothetical. Dollar box fills only from the owner’s numbers, labeled estimate.', es: 'Reporte ficticio anotado, claramente etiquetado como hipotético. El recuadro de dólares se llena solo con los números del dueño, etiquetado como estimado.' } },
    { title: { en: 'DM opt-in sequence (3 messages)', es: 'Secuencia de mensajes directos (3 mensajes)' }, desc: { en: '1) Welcome + ask best number & 15-min window. 2) Call-recording consent ("if I record, I’ll tell you and you can say no"). 3) Scorecard attached, yours to keep. EN + ES.', es: '1) Bienvenida + pide mejor número y ventana de 15 min. 2) Consentimiento de grabación ("si grabo, te aviso y puedes decir que no"). 3) Reporte adjunto, es tuyo. EN + ES.' } },
  ]

  const CALENDAR: { week: Bi; items: Bi[] }[] = [
    { week: { en: 'Week 1 — Warm the audience (name the phantom)', es: 'Semana 1 — Calienta la audiencia (nombra al fantasma)' }, items: [
      { en: 'Mon · FB+LI: Poll 1 (7pm Saturday) — lowest-threat opener', es: 'Lun · FB+LI: Encuesta 1 (sábado 7pm) — apertura de menor presión' },
      { en: 'Tue · Reels: Video 1 ("We go first" demo)', es: 'Mar · Reels: Video 1 (demo "nosotros vamos primero")' },
      { en: 'Thu · FB: Post 1 (6:50pm Voicemail) → TEST', es: 'Jue · FB: Post 1 (buzón 6:50pm) → PRUEBA' },
      { en: 'Fri · IG/LinkedIn: Carousel "6 things we score"', es: 'Vie · IG/LinkedIn: Carrusel "6 cosas que evaluamos"' },
    ] },
    { week: { en: 'Week 2 — Agitate the leak + introduce the offer', es: 'Semana 2 — Agita la fuga + presenta la oferta' }, items: [
      { en: 'Mon · LinkedIn: Poll 2 (10 calls → customers)', es: 'Lun · LinkedIn: Encuesta 2 (10 llamadas → clientes)' },
      { en: 'Tue · FB: Post 3 (competitor answered) → WHO ANSWERS', es: 'Mar · FB: Post 3 (la competencia contestó) → QUIÉN CONTESTA' },
      { en: 'Wed · Reels: Video 2 ("We called 10 [vertical]s") → SCORE', es: 'Mié · Reels: Video 2 ("Llamamos a 10 [vertical]s") → SCORE' },
      { en: 'Fri · LinkedIn+FB: Post 4 (Founding 25) → FOUNDING. Launch slot counter.', es: 'Vie · LinkedIn+FB: Post 4 (Fundadores 25) → FUNDADOR. Lanza el contador de cupos.' },
    ] },
    { week: { en: 'Week 3 — Honesty as the differentiator', es: 'Semana 3 — La honestidad como diferenciador' }, items: [
      { en: 'Mon · FB+LI: Poll 3 (callback speed)', es: 'Lun · FB+LI: Encuesta 3 (rapidez de devolución)' },
      { en: 'Tue · FB+LinkedIn: Post 5 (the math) → MATH. Link the quiz.', es: 'Mar · FB+LinkedIn: Post 5 (los números) → NÚMEROS. Enlaza el quiz.' },
      { en: 'Thu · LinkedIn: Post 2 (call your own line at 8pm) → EVAL', es: 'Jue · LinkedIn: Post 2 (llama a tu línea a las 8pm) → EVAL' },
      { en: 'Fri · IG: Carousel — Sample scorecard reveal', es: 'Vie · IG: Carrusel — Reporte de muestra' },
    ] },
    { week: { en: 'Week 4 — Close the loop + scarcity (only if real)', es: 'Semana 4 — Cierra el ciclo + escasez (solo si es real)' }, items: [
      { en: 'Mon · FB+LI: Poll 4 (diagnostic closer)', es: 'Lun · FB+LI: Encuesta 4 (diagnóstico de cierre)' },
      { en: 'Tue · Site/all: push the quiz ("How leaky is your phone?")', es: 'Mar · Sitio/todos: empuja el quiz ("¿Qué tan fugado está tu teléfono?")' },
      { en: 'Thu · LinkedIn: Post 6 (honest trust-close) → HONEST', es: 'Jue · LinkedIn: Post 6 (cierre honesto de confianza) → HONESTO' },
      { en: 'Fri · All: Founding 25 status ("X of 25 left") + recap best post', es: 'Vie · Todos: estado Fundadores 25 ("quedan X de 25") + resumen del mejor post' },
    ] },
  ]

  const GUARDRAILS: Bi[] = [
    { en: 'No fabricated stats — ever. Any "lost revenue" figure is an estimate built from the owner’s own numbers, explicitly labeled an estimate.', es: 'Nunca inventes estadísticas. Cualquier cifra de "ingresos perdidos" es un estimado construido con los propios números del dueño, etiquetado como estimado.' },
    { en: 'The test call is real. Observations are facts ("at 7:48pm I hit a voicemail that didn’t state your hours"), not claims.', es: 'La llamada de prueba es real. Las observaciones son hechos ("a las 7:48pm caí en un buzón que no decía tu horario"), no afirmaciones.' },
    { en: 'Scarcity must be enforceable. "Founding 25" is a real, honored cap. No fake countdowns, no fake reopens.', es: 'La escasez debe ser real. "Fundadores 25" es un límite real y respetado. Sin relojes falsos, sin reaperturas falsas.' },
    { en: 'Call-recording consent. If a call is recorded, tell the owner and let them decline — captured in the DM sequence.', es: 'Consentimiento de grabación. Si se graba la llamada, avisa al dueño y deja que diga que no — se captura en la secuencia de mensajes.' },
    { en: 'No hard pitch in the report. The scorecard is self-sufficient value; the owner keeps it regardless. Invited conversation only.', es: 'Sin venta agresiva en el reporte. El reporte vale por sí solo; el dueño se lo queda igual. Solo conversación si la invita.' },
    { en: 'Bilingual parity. EN + ES ship together on every post, poll, quiz, video, carousel, and DM.', es: 'Paridad bilingüe. EN + ES salen juntos en cada post, encuesta, quiz, video, carrusel y mensaje.' },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {L === 'es' ? 'Estrategia de marketing' : 'Marketing Strategy'}
        </h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'Manual de la campaña beta "Cliente Fantasma". Copia y pega encuestas y publicaciones, sigue el calendario de 4 semanas, y respeta las reglas de honestidad. Todo bilingüe EN + ES.'
            : 'Playbook for the "Phantom Customer" beta campaign. Copy-paste the polls and posts, follow the 4-week calendar, and keep the honesty rules. All bilingual EN + ES.'}
        </p>
      </div>

      {/* Opt-in links — partner-attributed, lands in your CRM */}
      <Section title={L === 'es' ? 'Tus enlaces de captación' : 'Your opt-in links'}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'Cada enlace está marcado contigo — los registros caen en tu CRM (pestaña Contactos), etiquetados por ángulo. Flujo: publica el gráfico, di "comenta la PALABRA y toca mi enlace", pega el enlace en tu bio o en el primer comentario.'
            : 'Each link is tagged to you — sign-ups land in your CRM (Contacts tab), labeled by angle. Flow: post the graphic, say "comment the KEYWORD, then tap my link," drop the link in your bio or first comment.'}
        </p>
        {!code ? (
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            {L === 'es' ? 'Cargando tus enlaces…' : 'Loading your links…'}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {LINK_TRACKS.map((tr) => (
              <div key={tr.key} className="rounded-lg p-2.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pick(tr.label, L)}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{L === 'es' ? 'Palabra: ' : 'Keyword: '}{tr.kw}</span>
                </div>
                <CopyRow text={`${origin}/beta/${code}?t=${tr.key}`} L={L} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Big idea */}
      <Section title={L === 'es' ? 'La gran idea' : 'The Big Idea'}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'El Cliente Fantasma: el prospecto real que ya llamó, ya quería comprar, y se fue en silencio por una fuga — sin respuesta, devolución tardía, línea muerta fuera de horario. Es invisible (nunca aparece en ningún reporte) pero cuesta dinero real, y la fuga se puede arreglar. La Evaluación de Captura de Clientes gratis es la radiografía que lo hace visible.'
            : 'The Phantom Customer: the real prospect who already called, already wanted to buy, and left silently through a gap — no answer, late callback, dead after-hours line. Invisible (never shows up in any report) but costs real money, and the leak is fixable. The free Lead Capture Evaluation is the X-ray that makes it visible.'}
        </p>
        <div className="mt-3 space-y-2">
          {TAGLINES.map((t, i) => <CopyRow key={i} text={pick(t, L)} L={L} />)}
        </div>
        <div className="mt-3">
          <Label L={L} en="North-star line (site hero + pitch)" es="Frase guía (hero del sitio + pitch)" />
          <CopyRow text={pick(NORTH_STAR, L)} L={L} />
        </div>
      </Section>

      {/* Offer + beta */}
      <Section title={L === 'es' ? 'La oferta + encuadre beta' : 'The Offer + Beta Framing'}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'Evaluación gratis de 15 minutos: hacemos una llamada de prueba real (más una verificación fuera de horario) y calificamos 6 categorías sobre 100. El dueño recibe un reporte con marca: calificación A–F, la fuga más grande, las 2–3 mejoras de mayor impacto, y un estimado opcional con sus propios números. El reporte es el entregable — se lo queda hablemos o no.'
            : 'A free 15-minute eval: we place a real test call (plus an after-hours check) and score 6 categories out of 100. The owner gets a branded scorecard: A–F grade, biggest leak, top 2–3 fixes, and an optional estimate from their own numbers. The eval IS the deliverable — kept whether we talk again or not.'}
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          <strong>{L === 'es' ? 'Ser nuevo es el mecanismo de confianza, no la disculpa.' : '"New company" is the trust mechanism, not the apology.'}</strong>{' '}
          {L === 'es'
            ? 'Lo decimos de frente: somos nuevos, ganamos confianza dando una evaluación útil gratis. Reciprocidad + Unidad (dueño a dueño).'
            : 'We say it plainly: we’re new, we earn trust by giving a genuinely useful free eval. Reciprocity + Unity (owner-to-owner).'}
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          <strong>{L === 'es' ? 'Mecánica de opt-in:' : 'Opt-in mechanic:'}</strong>{' '}
          {L === 'es'
            ? 'comenta una palabra clave → se dispara un mensaje directo. Cupo "Fundadores 25" al mes con contador real. Línea de reciprocidad en cada superficie: "El reporte es tuyo de todas formas."'
            : 'comment a keyword → triggers a DM. "Founding 25" monthly cap with a real counter. Reciprocity line on every surface: "You keep the scorecard either way."'}
        </p>
      </Section>

      {/* A/B campaign tracks */}
      <Section title={L === 'es' ? 'Ángulos de campaña para probar (A/B)' : 'Campaign angles to test (A/B)'}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? 'Cinco ángulos distintos del mismo embudo. Prueba cuál genera más opt-ins. El generador de Gráficos tiene cada ángulo como pista — crea arte que combine.'
            : 'Five distinct angles into the same funnel. Test which pulls the most opt-ins. The Graphics generator has each angle as a track — make matching art.'}
        </p>
        <div className="mt-3 space-y-2">
          {TRACKS.map((tr, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pick(tr.name, L)}</span>
                {tr.lead && (
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--brand-500, oklch(55% 0.11 193))', color: '#fff' }}>
                    {L === 'es' ? 'Principal' : 'Lead'}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{pick(tr.tests, L)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Polls */}
      <Section title={L === 'es' ? 'Encuestas (top 4)' : 'Polls (top 4)'}>
        <div className="space-y-3">
          {POLLS.map((p, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pick(p.title, L)}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{p.channel}</span>
              </div>
              <CopyRow text={`${pick(p.q, L)}\n${pick(p.opts, L)}`} L={L} className="mt-2" />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>{pick(p.note, L)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{L === 'es' ? 'Palabra clave: ' : 'Keyword: '}<strong>{p.keyword}</strong></p>
            </div>
          ))}
        </div>
      </Section>

      {/* Posts */}
      <Section title={L === 'es' ? 'Publicaciones (top 6)' : 'Post Series (top 6)'}>
        <div className="space-y-3">
          {POSTS.map((p, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pick(p.title, L)}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{p.channel}</span>
              </div>
              <CopyRow text={pick(p.body, L)} L={L} className="mt-2" multiline />
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{L === 'es' ? 'Palabra clave: ' : 'Keyword: '}<strong>{p.keyword}</strong></p>
            </div>
          ))}
        </div>
      </Section>

      {/* Quiz */}
      <Section title={L === 'es' ? 'Quiz — "¿Qué tan fugado está tu teléfono?"' : 'Quiz — "How leaky is your phone?"'}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {L === 'es'
            ? '6 preguntas (una por categoría), cada una puntuada al peso de su categoría. Termina en un nivel de resultado + un estimado opcional con los 3 números del dueño (llamadas/semana, tasa de cierre, valor promedio), etiquetado como estimado.'
            : '6 questions (one per category), each scored to its category’s weight. Ends in a result tier + an optional estimate from the owner’s 3 numbers (calls/week, close rate, avg value), labeled an estimate.'}
        </p>
        <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          {QUIZ_TIERS.map((q, i) => (
            <div key={i} className="flex gap-3 p-2.5 text-sm" style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined, background: i % 2 ? 'var(--surface-raised)' : 'transparent' }}>
              <span className="font-mono text-xs w-14 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{q.range}</span>
              <span className="font-medium w-32 shrink-0" style={{ color: 'var(--text-primary)' }}>{pick(q.tier, L)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{pick(q.msg, L)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Formats */}
      <Section title={L === 'es' ? 'Video · carrusel · mensajes directos' : 'Video · Carousel · DM'}>
        <div className="space-y-2.5">
          {FORMATS.map((f, i) => (
            <div key={i}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pick(f.title, L)}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{pick(f.desc, L)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Calendar */}
      <Section title={L === 'es' ? 'Calendario de lanzamiento (4 semanas)' : '4-Week Launch Calendar'}>
        <div className="space-y-3">
          {CALENDAR.map((w, i) => (
            <div key={i}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{pick(w.week, L)}</p>
              <ul className="mt-1 space-y-0.5">
                {w.items.map((it, j) => (
                  <li key={j} className="text-sm" style={{ color: 'var(--text-secondary)' }}>· {pick(it, L)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Guardrails */}
      <Section title={L === 'es' ? 'Reglas de honestidad y confianza' : 'Honesty + Trust Guardrails'}>
        <ul className="space-y-1.5">
          {GUARDRAILS.map((g, i) => (
            <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--brand-500, oklch(55% 0.11 193))' }}>✓</span>
              <span>{pick(g, L)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {children}
    </section>
  )
}

function Label({ L, en, es }: { L: 'en' | 'es'; en: string; es: string }) {
  return <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{L === 'es' ? es : en}</p>
}

function CopyRow({ text, L, className, multiline }: { text: string; L: 'en' | 'es'; className?: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }
  return (
    <div className={`flex gap-2 items-start ${className ?? ''}`}>
      <p className="text-sm flex-1" style={{ color: 'var(--text-secondary)', whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>{text}</p>
      <button
        onClick={copy}
        className="text-xs px-2 py-1 rounded shrink-0 transition-colors"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: copied ? 'var(--brand-500, oklch(55% 0.11 193))' : 'var(--text-tertiary)' }}
      >
        {copied ? (L === 'es' ? '¡Copiado!' : 'Copied!') : (L === 'es' ? 'Copiar' : 'Copy')}
      </button>
    </div>
  )
}
