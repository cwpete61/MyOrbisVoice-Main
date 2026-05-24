// Curated angle library — the "scaffolding" the AI gets when generating a
// social post. Each angle pre-loads a frame (problem / loss-frame / proof /
// curiosity / CTA), a target tab (intent), an aggression tier hint, and a
// suggested composition template. Admin picks one from this list OR types a
// free prompt; both feed the same generator.

export type AngleIntent =
  | 'pitch-product'
  | 'recruit-partners'
  | 'how-to-sell'
  | 'social-posts'
  | 'reels-shorts-tiktok'
  | 'audio'

export type CompositionId =
  | 'Social-Static' | 'Social-Imagery' | 'Social-Reel'
  | 'Stat-Card' | 'Hook-Card' | 'Quote-Card' | 'Comparison-Card' | 'Value-Pillars'
  | 'Hook-Reel' | 'Partner-LongForm'

export interface SocialAngle {
  key:           string                // slug — stable id used in API + JSON
  label:         string                // admin-facing pick-list label
  intent:        AngleIntent           // default tab for posts using this angle
  composition:   CompositionId
  aggression:    'conservative' | 'balanced' | 'direct' | 'aggressive'
  briefEn:       string                // English seed for the AI
  briefEs:       string                // Spanish seed (used when partner picks ES)
  // Optional image-style nudge — keeps the AI image on-brand without forcing.
  imageStyle?:   string
}

export const ANGLES: SocialAngle[] = [
  // ── Loss-frame hooks (highest stopping power) ─────────────────────────────
  {
    key: 'missed-calls-math',
    label: 'Missed calls = lost revenue (math)',
    intent: 'social-posts', composition: 'Social-Imagery', aggression: 'direct',
    briefEn: 'Hook: every missed call is money walking to a competitor. State the daily math (5 missed calls × $210 = $1,050/day = $383k/year). End: "Orby answers every call. 24/7." Pattern: PAS.',
    briefEs: 'Gancho: cada llamada perdida es dinero que se va a la competencia. Muestra las cuentas (5 llamadas perdidas × $210 = $1.050/día = $383k/año). Cierra: "Orby contesta cada llamada. 24/7." Patrón: PAS.',
    imageStyle: 'cinematic photo of an empty small-business storefront at night, ringing phone glow in the window, atmospheric, deep blue + amber',
  },
  {
    key: 'map-pack-loss',
    label: 'Outside the Map Pack = invisible',
    intent: 'social-posts', composition: 'Social-Imagery', aggression: 'direct',
    briefEn: 'Hook: if you\'re not in the Google Map Pack (top 3), nearby customers literally don\'t see you. Agitate with the % of clicks the top-3 get. Solve: a GBP audit + fix. Pattern: PAS.',
    briefEs: 'Gancho: si no estás en el Map Pack de Google (top 3), los clientes cercanos literalmente no te ven. Agita con el % de clics que se llevan los 3 primeros. Solución: auditoría GBP + arreglo. Patrón: PAS.',
    imageStyle: 'overhead aerial of a small-town main street at dusk, headlights as streaks, mood: invisible, missed-opportunity',
  },
  {
    key: 'gbp-feeds-ai',
    label: 'Your GBP feeds Google\'s mobile AI',
    intent: 'social-posts', composition: 'Social-Imagery', aggression: 'balanced',
    briefEn: 'Hook: Google has confirmed your Business Profile feeds straight into the AI for mobile search. Weak profile = invisible to that AI. Specific, current, contrarian. CTA: free GBP audit.',
    briefEs: 'Gancho: Google confirmó que tu Perfil de Negocio va directo a la IA para búsqueda móvil. Perfil débil = invisible para esa IA. Específico, actual, contraintuitivo. CTA: auditoría GBP gratis.',
    imageStyle: 'close-up of a smartphone showing a search bar with subtle Google-blue glow, hands holding phone, soft daylight',
  },

  // ── Product-pitch angles ──────────────────────────────────────────────────
  {
    key: 'after-hours-receptionist',
    label: 'AI receptionist 24/7',
    intent: 'pitch-product', composition: 'Social-Imagery', aggression: 'balanced',
    briefEn: 'Frame: your customers don\'t keep business hours. Show "after 6pm = ghost town for your phone." Orby answers, books, captures. Tone: warm but urgent. CTA: 5-minute demo.',
    briefEs: 'Marco: tus clientes no se rigen por horario laboral. Muestra "después de las 6 = teléfono fantasma." Orby contesta, agenda, captura. Tono: cálido pero urgente. CTA: demo de 5 minutos.',
    imageStyle: 'cozy dim-lit small business interior after closing, single ceiling light, empty counter — feel of "no one to answer"',
  },
  {
    key: 'trifecta-overview',
    label: 'Trifecta: capture · rank · convert',
    intent: 'pitch-product', composition: 'Social-Static', aggression: 'balanced',
    briefEn: 'One growth system, three engines: voice agents (capture), local SEO (rank), conversion-tuned website (convert). Typography-led, no photo. CTA: learn more.',
    briefEs: 'Un sistema, tres motores: agentes de voz (captar), SEO local (posicionar), web que convierte (convertir). Tipografía, sin foto. CTA: descubre más.',
  },

  // ── Recruit Partners angles ───────────────────────────────────────────────
  {
    key: 'partner-recurring-30',
    label: 'Partner: 30% recurring revenue',
    intent: 'recruit-partners', composition: 'Social-Imagery', aggression: 'direct',
    briefEn: 'For consultants / agencies: share a link → earn 30% recurring. Specific math: one $497/mo client = $179/mo passive. CTA: become a partner.',
    briefEs: 'Para consultores y agencias: comparte un enlace → gana 30% recurrente. Cuentas claras: un cliente de $497/mes = $179/mes pasivo. CTA: hazte partner.',
    imageStyle: 'modern minimalist office desk with laptop showing dashboard, warm late-afternoon light, productivity vibe',
  },

  // ── How-to-Sell angles ────────────────────────────────────────────────────
  // ── New (B.5 template library) ────────────────────────────────────────────
  {
    key: 'stat-daily-math',
    label: 'Stat card: daily math ($/day lost)',
    intent: 'social-posts', composition: 'Stat-Card', aggression: 'direct',
    briefEn: 'Single big-number stat. The daily $ figure a small business loses to missed calls (use 5 calls × $210 = $1,050/day). Treat the AI output title as the kicker, description as the supporting paragraph.',
    briefEs: 'Una sola estadística grande. Lo que pierde un negocio al día por llamadas perdidas (5 llamadas × $210 = $1.050/día). El título sirve de gancho; la descripción es el párrafo de apoyo.',
  },
  {
    key: 'hook-invisible-to-ai',
    label: 'Hook card: invisible to AI?',
    intent: 'social-posts', composition: 'Hook-Card', aggression: 'direct',
    briefEn: 'Typography hook only. Question form, ≤7 words. Title field = the kicker ("GBP / Mobile AI"), description field = the punchy 1-line question (e.g. "Are you invisible to AI?").',
    briefEs: 'Solo tipografía. Forma de pregunta, ≤7 palabras. Título = gancho ("GBP / IA móvil"), descripción = pregunta directa ("¿Eres invisible para la IA?").',
  },
  {
    key: 'compare-voicemail-vs-orby',
    label: 'Comparison: voicemail vs Orby',
    intent: 'social-posts', composition: 'Comparison-Card', aggression: 'balanced',
    briefEn: 'Two-column side-by-side. Left = "WITHOUT ORBY" (4 lose-state bullets, e.g. "Caller hangs up", "Books your competitor"). Right = "WITH ORBY" (4 win-state bullets). Title field = the framing question.',
    briefEs: 'Dos columnas. Izquierda = "SIN ORBY" (4 viñetas de pérdida). Derecha = "CON ORBY" (4 viñetas de ganancia). Título = pregunta marco.',
  },
  {
    key: 'pillars-trifecta',
    label: 'Pillars: capture · rank · convert',
    intent: 'pitch-product', composition: 'Value-Pillars', aggression: 'balanced',
    briefEn: 'Three numbered pillars. Capture (voice agents), Rank (local SEO), Convert (matched website). Title = "Three engines." Description = "One growth system."',
    briefEs: 'Tres pilares numerados. Captar (agentes de voz), Posicionar (SEO local), Convertir (sitio a la medida). Título = "Tres motores." Descripción = "Un sistema de crecimiento."',
  },
  {
    key: 'reel-3-things-losing',
    label: 'Reel: 3 things you\'re losing (15s)',
    intent: 'reels-shorts-tiktok', composition: 'Hook-Reel', aggression: 'direct',
    briefEn: '15-second short. Hook → 3-item agitate list → CTA. Title = the hook line ("Most local businesses are invisible."). Description = the CTA sub ("Free GBP audit, no obligation.").',
    briefEs: 'Corto de 15s. Gancho → lista de 3 → CTA. Título = gancho ("La mayoría de negocios locales son invisibles."). Descripción = sub del CTA ("Auditoría GBP gratis, sin compromiso.").',
  },
  {
    key: 'longform-gbp-walkthrough',
    label: 'YT long-form: GBP audit walkthrough intro+outro',
    intent: 'how-to-sell', composition: 'Partner-LongForm', aggression: 'conservative',
    briefEn: 'Intro card + outro card for a 5-15 min YouTube walkthrough. Title = the episode topic. Description = the one-line hook that opens the video.',
    briefEs: 'Tarjeta de intro + outro para video de YouTube de 5-15 min. Título = tema del episodio. Descripción = gancho de una línea para abrir el video.',
  },
  {
    key: 'how-to-discovery-script',
    label: 'How to: 4 discovery questions',
    intent: 'how-to-sell', composition: 'Social-Static', aggression: 'conservative',
    briefEn: 'Educational. Four discovery questions that surface missed-call pain: "How many calls/day?" "What % go to voicemail?" "How fast do you call back?" "What\'s your average customer value?" Typography-led. Pattern: BAB.',
    briefEs: 'Educativo. Cuatro preguntas de descubrimiento para revelar el dolor de llamadas perdidas: "¿Cuántas llamadas al día?" "¿Qué % van al buzón?" "¿Qué tan rápido devuelves?" "¿Valor promedio del cliente?" Tipografía. Patrón: BAB.',
  },
]

export function findAngle(key: string): SocialAngle | undefined {
  return ANGLES.find(a => a.key === key)
}
