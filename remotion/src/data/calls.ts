// Phone-call simulation scripts, polished from a real MyOrbisAgents 929 call.
// Each turn has a duration in frames (30fps); PhoneCallSim lays them out
// sequentially. `app` marks which app-panel step lights up as that turn lands.

export type Speaker = 'orby' | 'caller';

export interface Turn {
  who: Speaker;
  text: string;
  dur: number; // frames this bubble is "spoken" before the next
  spanish?: boolean; // triggers the <SpanishBadge> pop
  app?: string; // app-panel step to activate on this turn
}

export interface CallScript {
  variant: string;
  language: 'en' | 'es';
  appSteps: string[]; // ordered pipeline labels shown in the app panel
  turns: Turn[];
}

const APP_STEPS = ['Lead created', 'Qualifying…', 'Offering earliest slot', 'Showing booked', 'Showing Brief ✓'];
const APP_STEPS_ES = ['Contacto creado', 'Calificando…', 'Ofreciendo el horario más temprano', 'Cita agendada', 'Resumen de cita ✓'];

export const CALL_RENT_EN: CallScript = {
  variant: 'rent-en',
  language: 'en',
  appSteps: APP_STEPS,
  turns: [
    { who: 'orby', text: "Hi, this is Orby with John Brown at Austin Realtors — y también hablo español, si prefieres. How can I help?", dur: 110, spanish: true },
    { who: 'caller', text: 'I saw the 3-bedroom near campus, for rent.', dur: 60 },
    { who: 'orby', text: "Great — $3,100 a month, fenced yard, washer-dryer, walk to campus. Want to come see it? When are you hoping to move in?", dur: 105, app: 'Lead created' },
    { who: 'caller', text: 'Start of next month.', dur: 45 },
    { who: 'orby', text: 'Perfect. Do you have pets, and roughly how many people are moving in?', dur: 80, app: 'Qualifying…' },
    { who: 'caller', text: 'Just me and a dog.', dur: 45 },
    { who: 'orby', text: 'Got it. Earliest I have is today at 9, or tomorrow at 10 — which works?', dur: 85, app: 'Offering earliest slot' },
    { who: 'caller', text: 'Tomorrow at 10.', dur: 40 },
    { who: 'orby', text: "Booked. I'll text your confirmation and hand John a brief so he's ready. Anything else?", dur: 100, app: 'Showing booked' },
    { who: 'caller', text: "That's it — thanks!", dur: 40, app: 'Showing Brief ✓' },
  ],
};

export const CALL_RENT_ES: CallScript = {
  variant: 'rent-es',
  language: 'es',
  appSteps: APP_STEPS_ES,
  turns: [
    { who: 'orby', text: 'Hola, soy Orby, del equipo de John Brown en Austin Realtors. ¿En qué te puedo ayudar?', dur: 100, spanish: true },
    { who: 'caller', text: 'Vi la casa de 3 recámaras en renta cerca del campus.', dur: 60 },
    { who: 'orby', text: 'Perfecto — $3,100 al mes, patio cercado, lavadora y secadora, a pasos del campus. ¿La quieres ver? ¿Para cuándo piensas mudarte?', dur: 110, app: 'Contacto creado' },
    { who: 'caller', text: 'A principios del próximo mes.', dur: 45 },
    { who: 'orby', text: '¡Genial! ¿Tienes mascotas, y cuántas personas se mudarían?', dur: 75, app: 'Calificando…' },
    { who: 'caller', text: 'Solo yo y mi perro.', dur: 40 },
    { who: 'orby', text: 'Entendido. Lo más temprano que tengo es hoy a las 9, o mañana a las 10. ¿Cuál te acomoda?', dur: 90, app: 'Ofreciendo el horario más temprano' },
    { who: 'caller', text: 'Mañana a las 10.', dur: 40 },
    { who: 'orby', text: 'Listo. Te mando la confirmación por mensaje y le paso un resumen a John para que llegue preparado. ¿Algo más?', dur: 105, app: 'Cita agendada' },
    { who: 'caller', text: 'Es todo, ¡gracias!', dur: 40, app: 'Resumen de cita ✓' },
  ],
};

export const CALLS: Record<string, CallScript> = {
  'rent-en': CALL_RENT_EN,
  'rent-es': CALL_RENT_ES,
};

export const totalCallFrames = (c: CallScript): number => c.turns.reduce((s, t) => s + t.dur, 0);

// ── Audible-call timing (shared by every composition) ──────────────────────
// Per-turn VO clip lengths (frames @30fps) = ceil(clip) + 8f pause, so each
// bubble holds its spoken line plus a short beat before the next speaker (no
// overlap, natural back-and-forth). Matches public/vo/call-<lang>-NN.mp3 at 1.0×.
export const CALL_DURS: Record<'en' | 'es', number[]> = {
  en: [201, 91, 246, 45, 123, 42, 142, 39, 168, 41],
  es: [210, 114, 256, 65, 97, 45, 183, 44, 214, 39],
};
// Narrator lead-in (>= the lead-in clip) so narration finishes before the call.
export const CALL_LEAD_IN = 85;

/** Turn durs for a call, optionally limited to the first `maxTurns` (snippets
 *  for short pieces). */
export const callDurs = (lang: 'en' | 'es', maxTurns?: number): number[] =>
  maxTurns ? CALL_DURS[lang].slice(0, maxTurns) : CALL_DURS[lang];

/** Total scene length needed to hold a (possibly trimmed) audible call. */
export const callSceneDur = (lang: 'en' | 'es', maxTurns?: number, leadIn = CALL_LEAD_IN): number =>
  leadIn + callDurs(lang, maxTurns).reduce((a, b) => a + b, 0) + 20;
