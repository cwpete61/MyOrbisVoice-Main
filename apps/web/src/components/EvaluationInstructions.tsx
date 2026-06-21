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

// Full start-to-finish partner protocol, ManyChat-first. The whole loop in order.
const PLAYBOOK: { title: TR; desc: TR }[] = [
  { title: { en: 'Connect ManyChat (one-time)', es: 'Conecta ManyChat (una vez)' },
    desc: { en: 'Marketing Strategy tab → "Auto-DM with ManyChat": create a ManyChat account, connect YOUR Facebook Page / Instagram, build the keyword flow (greet → ask business/name/phone → consent), and add the External Request action with the URL + JSON body shown (your referral code is pre-filled). Test by commenting your keyword on your own Page post → a lead should appear in Contacts. ManyChat auto-DMs on your Page/IG only — never on group comments.', es: 'Pestaña Estrategia de marketing → "Auto-DM con ManyChat": crea una cuenta de ManyChat, conecta TU página de Facebook / Instagram, arma el flujo por palabra clave (saluda → pide negocio/nombre/teléfono → consentimiento), y agrega la acción External Request con la URL + cuerpo JSON que se muestran (tu código ya está). Prueba comentando tu palabra clave en una publicación de tu propia página → debe aparecer un lead en Contactos. ManyChat solo escribe DM en tu página/IG — nunca en comentarios de grupos.' } },
  { title: { en: 'Build your content', es: 'Crea tu contenido' },
    desc: { en: 'Graphics tab → pick a campaign angle → pick a line or type an idea + Generate with AI → platform + neon color → Download PNG (make 2–3, Save the good lines). Then Marketing Strategy → copy the matching post text (EN or ES) and note the keyword (BETA / TEST / WHO ANSWERS / MATH / EVAL / QUIZ).', es: 'Pestaña Gráficos → elige un ángulo de campaña → elige una línea o escribe una idea + Generar con IA → plataforma + color neón → Descargar PNG (haz 2–3, Guarda las buenas líneas). Luego Estrategia de marketing → copia el texto de la publicación (EN o ES) y anota la palabra clave (BETA / TEST / QUIÉN CONTESTA / MATH / EVAL / QUIZ).' } },
  { title: { en: 'Find + add your groups', es: 'Encuentra + agrega tus grupos' },
    desc: { en: 'Join niche + local Facebook groups (target high-value niches: HVAC, roofing, plumbing, electrical, remodeling, legal, dental, med spas, etc.). Then My Groups tab → Add group for each one (name, URL, niche, members, promo rule).', es: 'Únete a grupos de Facebook por nicho y locales (apunta a nichos de alto valor: HVAC, techos, plomería, electricidad, remodelación, legal, dental, med spas, etc.). Luego pestaña Mis Grupos → Agregar grupo para cada uno (nombre, URL, nicho, miembros, regla de promoción).' } },
  { title: { en: 'Post + paced distribution', es: 'Publica + distribución a ritmo' },
    desc: { en: 'Post the graphic + text to your Page/IG (keyword comments → auto-DM). In My Groups: warm up first (like/comment 2–3 posts in the group), then Log post → the system paces you (per-group cooldown + hourly throttle) and returns your attributed opt-in link — paste it in the group. Space groups ~90 min apart; vary the angle/graphic per group.', es: 'Publica el gráfico + texto en tu página/IG (comentarios con palabra clave → auto-DM). En Mis Grupos: primero calienta (dale like/comenta 2–3 publicaciones del grupo), luego Registrar publicación → el sistema marca tu ritmo (enfriamiento por grupo + límite por hora) y devuelve tu enlace de captación atribuido — pégalo en el grupo. Espacia los grupos ~90 min; varía el ángulo/gráfico por grupo.' } },
  { title: { en: 'Leads land in your CRM', es: 'Los leads llegan a tu CRM' },
    desc: { en: 'Opt-ins arrive in Contacts / CRM tagged by track + keyword + group, two ways: Page comment → ManyChat, or the group opt-in link (/beta, /quiz). Watch the Founding-25 counter + per-group opt-in counts to see which groups convert.', es: 'Los opt-ins llegan a Contactos / CRM etiquetados por ángulo + palabra clave + grupo, de dos formas: comentario en la página → ManyChat, o el enlace de captación del grupo (/beta, /quiz). Mira el contador Fundadores-25 + los opt-ins por grupo para ver qué grupos convierten.' } },
  { title: { en: 'Run the free evaluation', es: 'Haz la evaluación gratis' },
    desc: { en: 'Open the lead in Contacts → Lead Capture Evaluation → Live test call (it rings your phone, then connects you to the business) → score the 6 categories live as you hear how they answer. (Full call process is below.)', es: 'Abre el lead en Contactos → Evaluación de Captura → Llamada de prueba en vivo (suena tu teléfono y te conecta al negocio) → califica las 6 categorías en vivo mientras escuchas cómo contestan. (El proceso completo está abajo.)' } },
  { title: { en: 'Send the report', es: 'Envía el reporte' },
    desc: { en: 'Save to Contacts → Create report link → send the lead their branded scorecard: their score, biggest leak, top fixes, and (optional) a dollar estimate built from their own numbers. No hard pitch in the report.', es: 'Guardar en Contactos → Crear enlace del reporte → envía al lead su reporte con marca: su puntaje, mayor fuga, mejores arreglos, y (opcional) un estimado en dólares con sus propios números. Sin venta dura en el reporte.' } },
  { title: { en: 'Convert (only if invited)', es: 'Convierte (solo si lo piden)' },
    desc: { en: 'The honest report does the selling. If they want help closing the gaps, onboard them — the signup is prefilled from the report. Soft, on their timeline.', es: 'El reporte honesto hace la venta. Si quieren ayuda para cerrar las fugas, regístralos — el alta viene prellenada desde el reporte. Suave, a su ritmo.' } },
  { title: { en: 'Follow-up email (the last email)', es: 'Correo de seguimiento (el último correo)' },
    desc: { en: 'Campaigns → Email campaigns → pick the CRM segment (evals delivered, not yet converted) → send the sequence in their language: (1) here is your report again, (2) the #1 fix, (3) the close. The last email is a soft final CTA: "ready when you are — here is how to start." Email only until they consent to calls/texts.', es: 'Campañas → Campañas de correo → elige el segmento del CRM (evaluaciones entregadas, aún no convertidas) → envía la secuencia en su idioma: (1) aquí está tu reporte otra vez, (2) el arreglo #1, (3) el cierre. El último correo es un CTA final suave: "cuando quieras — así empiezas." Solo correo hasta que consientan llamadas/SMS.' } },
  { title: { en: 'Measure + repeat', es: 'Mide + repite' },
    desc: { en: 'Inbound Reports → which tracks, groups, and niches convert. Drop dead groups, double down on winners, re-run steps 4–9 weekly with the best angle.', es: 'Reportes de entrada → qué ángulos, grupos y nichos convierten. Descarta grupos muertos, redobla en los ganadores, repite los pasos 4–9 cada semana con el mejor ángulo.' } },
]

const T = {
  heading: { en: 'How to run the evaluation', es: 'Cómo hacer la evaluación' },
  playbookTitle: { en: 'Full campaign protocol — start to finish', es: 'Protocolo completo de campaña — de principio a fin' },
  playbookHint: { en: 'The whole loop, in order. Set up ManyChat once (step 1), then repeat steps 4–9 weekly. Details on the evaluation call itself are further down.', es: 'Todo el ciclo, en orden. Configura ManyChat una vez (paso 1), luego repite los pasos 4–9 cada semana. Los detalles de la llamada de evaluación están más abajo.' },
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

      {/* Full campaign protocol — ManyChat-first, start to finish */}
      <section>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{tr(T.playbookTitle)}</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{tr(T.playbookHint)}</p>
        <ol className="space-y-3">
          {PLAYBOOK.map((s, i) => (
            <li key={i} className="flex gap-3.5">
              <span className="shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs font-bold tabular-nums" style={{ background: 'var(--brand-500, oklch(55% 0.11 193))', color: '#fff' }}>{i + 1}</span>
              <div className="rounded-xl p-3.5 flex-1" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tr(s.title)}</div>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{tr(s.desc)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

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
