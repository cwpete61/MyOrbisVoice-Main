'use client'

import { useLocale } from '@/lib/i18n/I18nProvider'

/**
 * "Instructions" tab for the Inbound Evaluation campaign — the partner-facing
 * how-to from docs/campaigns/lead-eval-scoring-methodology.md. The scoring math
 * lives in the Inbound Evaluation tool tab; this is the run-the-campaign guide:
 * the 15-minute process, test-call scripts, ethics, and how to deliver the
 * scorecard. Bilingual EN/ES.
 */

type TR = { en: string; es: string }

const intro: TR = {
  en: 'The repeatable process behind the free 15-minute lead evaluation. A few test calls become a defensible Lead Capture Score (0–100) and a one-page scorecard the owner keeps. Phone-focused: the live test call, after-hours behavior, and the callback.',
  es: 'El proceso repetible detrás de la evaluación gratuita de leads de 15 minutos. Unas llamadas de prueba se convierten en un Puntaje de Captura defendible (0–100) y un reporte de una página que el dueño conserva. Enfocado en el teléfono: la llamada en vivo, el comportamiento fuera de horario y la devolución.',
}
const whyRigorous: TR = {
  en: 'The whole offer rests on the owner trusting the result. Every criterion is defined so the answer is observable, not opinion — two evaluators land on the same score.',
  es: 'Toda la oferta depende de que el dueño confíe en el resultado. Cada criterio está definido para que la respuesta sea observable, no opinión — dos evaluadores llegan al mismo puntaje.',
}

const STEPS: { time: TR; title: TR; desc: TR }[] = [
  { time: { en: '0–2 min', es: '0–2 min' }, title: { en: 'Prep', es: 'Preparación' },
    desc: { en: 'Pull their public phone number and listed hours. Note the current local time vs. their hours — you need to know if your call lands in- or after-hours. Use a normal mobile caller ID, not a blocked/unknown number.', es: 'Saca su número público y su horario. Anota la hora local actual vs. su horario — necesitas saber si tu llamada cae en horario o fuera de él. Usa un identificador de móvil normal, no un número bloqueado/desconocido.' } },
  { time: { en: '2–6 min', es: '2–6 min' }, title: { en: 'Call #1 — Business-hours call', es: 'Llamada #1 — en horario' },
    desc: { en: 'Call as a realistic prospect (see scripts). Count rings, note the greeting, note whether they capture your info and offer a next step. Hang up politely. Scores categories 1–4.', es: 'Llama como un prospecto realista (ver guiones). Cuenta los timbres, anota el saludo, anota si capturan tus datos y ofrecen un próximo paso. Cuelga con cortesía. Califica las categorías 1–4.' } },
  { time: { en: '6–9 min', es: '6–9 min' }, title: { en: 'Call #2 — After-hours test', es: 'Llamada #2 — fuera de horario' },
    desc: { en: 'If they are open now, call back and let it ring to voicemail (or the after-hours path). If they are closed, Call #1 was already after-hours — run a second call to a different staff path if one exists. Scores category 5.', es: 'Si están abiertos ahora, vuelve a llamar y deja que entre el buzón (o la ruta fuera de horario). Si están cerrados, la Llamada #1 ya fue fuera de horario — haz una segunda llamada a otra ruta si existe. Califica la categoría 5.' } },
  { time: { en: '9–12 min', es: '9–12 min' }, title: { en: 'Voicemail + notes', es: 'Buzón + notas' },
    desc: { en: 'If you reached voicemail, leave a short, genuine message with your name, number, and a clear request (so a callback is warranted). Start the callback timer. Write down specifics for the report.', es: 'Si llegaste al buzón, deja un mensaje breve y genuino con tu nombre, número y una petición clara (para que amerite devolución). Inicia el cronómetro de devolución. Anota detalles para el reporte.' } },
  { time: { en: '12–15 min', es: '12–15 min' }, title: { en: 'Score + draft', es: 'Calificar + borrador' },
    desc: { en: 'Enter the scores in the Inbound Evaluation tab. Note the 2–3 most important fixes.', es: 'Ingresa los puntajes en la pestaña Evaluación de entrada. Anota los 2–3 arreglos más importantes.' } },
  { time: { en: 'Next day', es: 'Día siguiente' }, title: { en: 'Callback check', es: 'Revisar devolución' },
    desc: { en: 'Did they call you back? How fast? Score category 6 and finalize.', es: '¿Te devolvieron la llamada? ¿Qué tan rápido? Califica la categoría 6 y finaliza.' } },
]

const SCRIPTS: { vertical: TR; line: TR }[] = [
  { vertical: { en: 'Home services (HVAC / plumbing / electrical)', es: 'Servicios del hogar (climas / plomería / electricidad)' },
    line: { en: '"Hi — my [AC / water heater] started acting up and I\'m trying to find someone who can take a look. Do you handle that, and roughly what would it cost to come out?"', es: '"Hola — mi [aire / calentador] empezó a fallar y busco a alguien que lo revise. ¿Lo hacen, y más o menos cuánto costaría la visita?"' } },
  { vertical: { en: 'Dental / medical', es: 'Dental / médico' },
    line: { en: '"Hi, I\'m new to the area and looking for a [dentist]. Are you taking new patients, and how soon could I get in?"', es: '"Hola, soy nuevo en la zona y busco un [dentista]. ¿Están aceptando pacientes nuevos, y qué tan pronto me podrían atender?"' } },
  { vertical: { en: 'Salon / beauty', es: 'Salón / belleza' },
    line: { en: '"Hi — do you have any openings this week for a [cut / color], and what are your prices?"', es: '"Hola — ¿tienen algún espacio esta semana para un [corte / tinte], y cuáles son sus precios?"' } },
  { vertical: { en: 'Legal', es: 'Legal' },
    line: { en: '"Hi, I had a [car accident / issue] last week and I\'m trying to figure out my options. Do you do free consultations?"', es: '"Hola, tuve un [accidente / problema] la semana pasada y trato de ver mis opciones. ¿Dan consultas gratis?"' } },
  { vertical: { en: 'Generic', es: 'Genérico' },
    line: { en: '"Hi — I\'m looking into [service]. Are you taking new clients, and what\'s the next step to get started?"', es: '"Hola — estoy buscando [servicio]. ¿Aceptan clientes nuevos, y cuál es el siguiente paso para empezar?"' } },
]

const ethics: TR = {
  en: 'Run a real test as a real potential customer with a need you could plausibly have. Do not fake an emergency, do not book an appointment you will not keep, and if they ask, you can be upfront that you are evaluating responsiveness. Measure their normal behavior — do not trick them.',
  es: 'Haz una prueba real como un cliente potencial real con una necesidad que de verdad podrías tener. No finjas una emergencia, no agendes una cita que no cumplirás, y si preguntan, puedes ser honesto en que evalúas su capacidad de respuesta. Mide su comportamiento normal — no los engañes.',
}

const DELIVERY: TR[] = [
  { en: 'Lead with the headline number + grade, then the single biggest leak.', es: 'Empieza con el número principal + la calificación, luego la mayor fuga.' },
  { en: 'Be specific and replayable: "At 7:48pm I called and reached a voicemail that didn\'t state your hours or promise a callback — and no one called back by the next afternoon." Specifics prove you did the work.', es: 'Sé específico y verificable: "A las 7:48pm llamé y entró un buzón que no decía tu horario ni prometía devolución — y nadie llamó de vuelta hasta la tarde siguiente." Los detalles prueban que hiciste el trabajo.' },
  { en: 'Give 2–3 fixes, ranked by impact. Usually: after-hours coverage > callback speed > lead-capture discipline.', es: 'Da 2–3 arreglos, ordenados por impacto. Normalmente: cobertura fuera de horario > velocidad de devolución > disciplina de captura.' },
  { en: 'No hard pitch in the scorecard itself. The honest evaluation is the value — the solution comes up only if they want it.', es: 'Sin venta dura en el reporte mismo. La evaluación honesta es el valor — la solución surge solo si la quieren.' },
  { en: 'Deliver the summary in the owner\'s language (EN or ES).', es: 'Entrega el resumen en el idioma del dueño (EN o ES).' },
]

const SAFEGUARDS: TR[] = [
  { en: 'Always run Call #1 during their posted open hours.', es: 'Haz siempre la Llamada #1 en su horario de atención publicado.' },
  { en: 'Use a normal caller ID; blocked/unknown numbers change behavior and bias the test.', es: 'Usa un identificador normal; los números bloqueados/desconocidos cambian el comportamiento y sesgan la prueba.' },
  { en: 'Score from notes taken during the call, not from memory afterward.', es: 'Califica con notas tomadas durante la llamada, no de memoria después.' },
  { en: 'One leak = one category. Do not double-penalize the same failure.', es: 'Una fuga = una categoría. No penalices dos veces la misma falla.' },
  { en: 'Re-run the exact same six categories every time.', es: 'Repite exactamente las mismas seis categorías cada vez.' },
]

const T = {
  heading: { en: 'How to run the evaluation', es: 'Cómo hacer la evaluación' },
  whyTitle: { en: 'Why it has to be rigorous', es: 'Por qué debe ser riguroso' },
  processTitle: { en: 'The 15-minute process', es: 'El proceso de 15 minutos' },
  scriptsTitle: { en: 'Test-call scripts', es: 'Guiones de llamada' },
  scriptsHint: { en: 'Pick the one that fits their vertical. Keep it natural — you are a new customer with a common need.', es: 'Elige el que encaje con su giro. Mantenlo natural — eres un cliente nuevo con una necesidad común.' },
  ethicsTitle: { en: 'Honesty rule', es: 'Regla de honestidad' },
  deliveryTitle: { en: 'Delivering the scorecard', es: 'Entregar el reporte' },
  safeguardsTitle: { en: 'Consistency safeguards', es: 'Salvaguardas de consistencia' },
}

export function EvaluationInstructions() {
  const { locale } = useLocale()
  const L: 'en' | 'es' = locale === 'es' ? 'es' : 'en'
  const tr = (o: TR) => o[L]

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{tr(T.heading)}</h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>{tr(intro)}</p>
      </div>

      {/* Why rigorous */}
      <div className="rounded-xl p-4" style={{ background: 'color-mix(in oklab, var(--brand-500, oklch(55% 0.11 193)) 7%, transparent)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--brand-600, var(--brand-500, oklch(50% 0.11 193)))' }}>{tr(T.whyTitle)}</h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tr(whyRigorous)}</p>
      </div>

      {/* Process timeline */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{tr(T.processTitle)}</h3>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="relative flex gap-3.5">
              <span className="shrink-0 z-10 w-8 h-8 rounded-full grid place-items-center text-xs font-bold tabular-nums" style={{ background: 'var(--surface-raised)', border: '1.5px solid var(--brand-500, oklch(55% 0.11 193))', color: 'var(--brand-600, var(--brand-500, oklch(50% 0.11 193)))' }}>{i + 1}</span>
              <div className="rounded-xl p-3.5 flex-1" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tr(s.title)}</h4>
                  <span className="text-xs font-medium shrink-0 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>{tr(s.time)}</span>
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{tr(s.desc)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Scripts */}
      <section>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tr(T.scriptsTitle)}</h3>
        <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-tertiary)' }}>{tr(T.scriptsHint)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCRIPTS.map((s, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{tr(s.vertical)}</div>
              <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>{tr(s.line)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ethics callout */}
      <div className="rounded-xl p-4 flex gap-3" style={{ background: 'var(--surface-raised)', borderLeft: '3px solid var(--brand-500, oklch(55% 0.11 193))', border: '1px solid var(--border-subtle)' }}>
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{tr(T.ethicsTitle)}</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tr(ethics)}</p>
        </div>
      </div>

      {/* Delivery + safeguards */}
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{tr(T.deliveryTitle)}</h3>
          <ol className="space-y-2">
            {DELIVERY.map((d, i) => (
              <li key={i} className="flex gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="shrink-0 tabular-nums font-semibold" style={{ color: 'var(--brand-600, var(--brand-500, oklch(50% 0.11 193)))' }}>{i + 1}.</span>
                <span>{tr(d)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{tr(T.safeguardsTitle)}</h3>
          <ul className="space-y-2">
            {SAFEGUARDS.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-500, oklch(55% 0.11 193))' }} />
                <span>{tr(s)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
