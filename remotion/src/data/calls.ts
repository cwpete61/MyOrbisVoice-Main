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

// SALES call (the hero): a pre-approved buyer books a showing on the $685k
// for-sale bungalow — showcases the pre-approval / proof-of-funds qualification
// and the commission story. Durs match public/vo/sale-<lang>-NN.mp3.
export const CALL_SALE_EN: CallScript = {
  variant: 'sale-en', language: 'en', appSteps: APP_STEPS,
  turns: [
    { who: 'orby', text: 'Hi, this is Orby with John Brown at Austin Realtors. How can I help?', dur: 134 },
    { who: 'caller', text: 'I saw the bungalow on South Lamar — is it still available?', dur: 116 },
    { who: 'orby', text: "It is — the renovated 3-bed at $685,000. Are you working with a lender yet? Are you pre-approved?", dur: 206, app: 'Lead created' },
    { who: 'caller', text: 'Yes, pre-approved up to $700,000.', dur: 93 },
    { who: 'orby', text: "Perfect. Can you send your pre-approval letter before the showing? And what's driving the move?", dur: 180, app: 'Qualifying…' },
    { who: 'caller', text: 'Relocating for work. I need to close in about 60 days.', dur: 116 },
    { who: 'orby', text: 'Got it. I can get you in today at 4, or tomorrow at 10. Which works?', dur: 132, app: 'Offering earliest slot' },
    { who: 'caller', text: 'Tomorrow at 10.', dur: 38 },
    { who: 'orby', text: "Booked. I'll text your confirmation and hand John your brief — pre-approval, timeline, must-haves — so he's ready to talk offer.", dur: 258, app: 'Showing booked' },
    { who: 'caller', text: "That's everything, thanks!", dur: 52, app: 'Showing Brief ✓' },
  ],
};
export const CALL_SALE_ES: CallScript = {
  variant: 'sale-es', language: 'es', appSteps: APP_STEPS_ES,
  turns: [
    { who: 'orby', text: 'Hola, soy Orby, del equipo de John Brown en Austin Realtors. ¿En qué te puedo ayudar?', dur: 165, spanish: true },
    { who: 'caller', text: 'Vi la casa en South Lamar. ¿Todavía está disponible?', dur: 106 },
    { who: 'orby', text: 'Sí, la casa remodelada de 3 recámaras en $685,000. ¿Ya trabajas con un banco? ¿Estás preaprobado?', dur: 240, app: 'Contacto creado' },
    { who: 'caller', text: 'Sí, preaprobado hasta $700,000.', dur: 78 },
    { who: 'orby', text: '¡Perfecto! ¿Me envías tu carta de preaprobación antes de la cita? ¿Y qué te motiva a mudarte?', dur: 192, app: 'Calificando…' },
    { who: 'caller', text: 'Me reubico por trabajo. Necesito cerrar en unos 60 días.', dur: 124 },
    { who: 'orby', text: 'Entendido. ¿Hoy a las 4, o mañana a las 10?', dur: 165, app: 'Ofreciendo el horario más temprano' },
    { who: 'caller', text: 'Mañana a las 10.', dur: 44 },
    { who: 'orby', text: 'Listo. Te mando la confirmación y le paso a John tu resumen para que llegue listo a hablar de oferta.', dur: 270, app: 'Cita agendada' },
    { who: 'caller', text: 'Es todo, ¡gracias!', dur: 37, app: 'Resumen de cita ✓' },
  ],
};

export const CALLS: Record<string, CallScript> = {
  'rent-en': CALL_RENT_EN,
  'rent-es': CALL_RENT_ES,
  'sale-en': CALL_SALE_EN,
  'sale-es': CALL_SALE_ES,
};

export const totalCallFrames = (c: CallScript): number => c.turns.reduce((s, t) => s + t.dur, 0);

// ── Audible-call timing, keyed by VARIANT ──────────────────────────────────
// Per-turn VO clip lengths (frames @30fps) = ceil(clip) + 8f pause, and the VO
// file prefix (rental clips are historically "call-*", sales are "sale-*").
const CALL_META: Record<string, { audio: string; durs: number[] }> = {
  'rent-en': { audio: 'call-en', durs: [201, 91, 246, 45, 123, 42, 142, 39, 168, 41] },
  'rent-es': { audio: 'call-es', durs: [210, 114, 256, 65, 97, 45, 183, 44, 214, 39] },
  'sale-en': { audio: 'sale-en', durs: [134, 116, 206, 93, 180, 116, 132, 38, 258, 52] },
  'sale-es': { audio: 'sale-es', durs: [165, 106, 240, 78, 192, 124, 165, 44, 270, 37] },
};
const META = (variant: string) => CALL_META[variant] ?? CALL_META['rent-en']!;
// Narrator lead-in (>= the lead-in clip) so narration finishes before the call.
export const CALL_LEAD_IN = 85;

/** VO file prefix for a call variant (call-<lang> for rentals, sale-<lang>). */
export const callAudioPrefix = (variant: string): string => META(variant).audio;

/** Turn durs for a call variant, optionally limited to the first `maxTurns`. */
export const callDurs = (variant: string, maxTurns?: number): number[] =>
  maxTurns ? META(variant).durs.slice(0, maxTurns) : META(variant).durs;

/** Total scene length needed to hold a (possibly trimmed) audible call. */
export const callSceneDur = (variant: string, maxTurns?: number, leadIn = CALL_LEAD_IN): number =>
  leadIn + callDurs(variant, maxTurns).reduce((a, b) => a + b, 0) + 20;
