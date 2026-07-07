import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { StatScene } from '../components/StatScene';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, Stage } from '../components/Scene';
import { theme } from '../theme';

// ── Five outcome-ads. Each = one agent outcome, PAS structure
// (loss-hook → agitate in dollars → outcome-close) → CTA. Bilingual narration
// (nova, EN + ES) plus Spanish on-screen text. 9:16 vertical for paid social.
type Lang = 'en' | 'es';

// Measured VO clip lengths (frames @30fps). Scene dur = clip + TAIL breath.
const VO: Record<string, number> = {
  'ad1-01-en': 244, 'ad1-01-es': 282, 'ad1-02-en': 138, 'ad1-02-es': 161,
  'ad2-01-en': 185, 'ad2-01-es': 188, 'ad2-02-en': 131, 'ad2-02-es': 148,
  'ad3-01-en': 225, 'ad3-01-es': 237, 'ad3-02-en': 191, 'ad3-02-es': 211,
  'ad4-01-en': 216, 'ad4-01-es': 195, 'ad4-02-en': 109, 'ad4-02-es': 107,
  'ad5-01-en': 227, 'ad5-01-es': 267, 'ad5-02-en': 178, 'ad5-02-es': 165,
  'cta-en': 239, 'cta-es': 242,
};
const TAIL = 18;
const clip = (id: string, lang: Lang) => `${id}-${lang}`;
const dur = (id: string, lang: Lang) => VO[clip(id, lang)]! + TAIL;
const ctaScene = (lang: Lang): FilmScene => ({ dur: dur('cta', lang), audio: clip('cta', lang), node: <CTACard lang={lang} /> });

const T = {
  en: {
    a1p: 'Miss the call. Hand over the commission.', a1psub: 'YOU’RE MID-SHOWING — THE PHONE ISN’T',
    a1s: 'Orby answers every call. You never miss a lead.', a1ssub: '24/7 — DAY, NIGHT, MID-SHOWING',
    a2cap: 'Not the best agent. The first one.', a2sub: 'SPEED-TO-LEAD WINS', a2label: 'go with the first agent to respond',
    a3p: 'Most agents walk in knowing a name.', a3psub: 'GUESSING BUDGET · TIMELINE · PRE-APPROVAL',
    a3s: 'Walk in ready to close.', a3ssub: 'A SHOWING BRIEF BEFORE YOU KNOCK',
    a4p: 'Your phone doesn’t speak their language.', a4psub: 'THE FASTEST-GROWING BUYERS SPEAK SPANISH',
    a5p: 'You close deals. Not babysit a phone.', a5psub: 'EVERY MISSED CALL = A DEAL GONE',
    a5s: 'Orby answers, qualifies, books. You get your time back.', a5ssub: 'AND YOU STILL CLOSE',
  },
  es: {
    a1p: 'Pierdes la llamada. Entregas la comisión.', a1psub: 'ESTÁS EN UNA CITA — EL TELÉFONO NO',
    a1s: 'Orby contesta cada llamada. Nunca pierdes un cliente.', a1ssub: '24/7 — DÍA, NOCHE, EN PLENA CITA',
    a2cap: 'No al mejor agente. Al primero.', a2sub: 'GANA QUIEN CONTESTA PRIMERO', a2label: 'elige al primer agente que contesta',
    a3p: 'La mayoría llega sabiendo un nombre.', a3psub: 'ADIVINANDO PRESUPUESTO · PLAZOS · PREAPROBACIÓN',
    a3s: 'Llega listo para cerrar.', a3ssub: 'UN RESUMEN DE CITA ANTES DE TOCAR LA PUERTA',
    a4p: 'Tu teléfono no habla su idioma.', a4psub: 'LOS COMPRADORES QUE MÁS CRECEN HABLAN ESPAÑOL',
    a5p: 'Cierras ventas. No cuidas un teléfono.', a5psub: 'CADA LLAMADA PERDIDA = UNA VENTA MENOS',
    a5s: 'Orby contesta, califica y agenda. Recuperas tu tiempo.', a5ssub: 'Y SIGUES CERRANDO',
  },
};

const appOutcome = (lang: Lang, highlight: 'leads' | 'brief', body: string, sub: string) => (
  <Stage scale={0.98}>
    <div style={{ textAlign: 'center', fontFamily: theme.font }}>
      <AppCockpit highlight={highlight} lang={lang} />
      <div style={{ fontSize: 34, fontWeight: 700, color: theme.muted, letterSpacing: 1.5, marginTop: 40 }}>{sub}</div>
      <div style={{ fontSize: 76, fontWeight: 900, color: theme.text, marginTop: 14, lineHeight: 1.08 }}>{body}</div>
    </div>
  </Stage>
);

// ── Ad 1 — Never Miss (outcome: every lead answered, 24/7) ──
export const adNeverMissScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  return [
    { dur: dur('ad1-01', lang), audio: clip('ad1-01', lang), node: <BigText text={c.a1p} sub={c.a1psub} color={theme.coral} size={96} /> },
    { dur: dur('ad1-02', lang), audio: clip('ad1-02', lang), node: <BigText text={c.a1s} sub={c.a1ssub} size={92} withOrb /> },
    ctaScene(lang),
  ];
};

// ── Ad 2 — Speed Wins (outcome: be the first responder — the 78%) ──
export const adSpeedScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  const sim = lang === 'es' ? 'sale-es' : 'sale-en';
  const lead = VO[clip('ad2-02', lang)]! + 8;
  return [
    { dur: dur('ad2-01', lang), audio: clip('ad2-01', lang), node: <StatScene eyebrow={c.a2sub} stats={[{ to: 78, suffix: '%', label: c.a2label }]} caption={c.a2cap} /> },
    { dur: callSceneDur(sim, 2, lead), node: <AudibleCall variant={sim} narrator={clip('ad2-02', lang)} maxTurns={2} scale={1.12} showApp={false} leadIn={lead} /> },
    ctaScene(lang),
  ];
};

// ── Ad 3 — Walk In Ready (outcome: pre-qualified + Showing Brief) ──
export const adReadyScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  return [
    { dur: dur('ad3-01', lang), audio: clip('ad3-01', lang), node: <BigText text={c.a3p} sub={c.a3psub} color={theme.coral} size={94} /> },
    { dur: dur('ad3-02', lang), audio: clip('ad3-02', lang), node: appOutcome(lang, 'brief', c.a3s, c.a3ssub) },
    ctaScene(lang),
  ];
};

// ── Ad 4 — Bilingual (outcome: capture the Spanish buyers you're losing) ──
export const adBilingualScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  const lead = VO[clip('ad4-02', lang)]! + 8;
  return [
    { dur: dur('ad4-01', lang), audio: clip('ad4-01', lang), node: <BigText text={c.a4p} sub={c.a4psub} color={theme.white} size={92} /> },
    // Solve = the Spanish call itself (audible in both cuts — the proof).
    { dur: callSceneDur('rent-es', 2, lead), node: <AudibleCall variant="rent-es" narrator={clip('ad4-02', lang)} maxTurns={2} scale={1.12} showApp={false} leadIn={lead} /> },
    ctaScene(lang),
  ];
};

// ── Ad 5 — Time Back (outcome: stop being chained to the phone) ──
export const adTimeBackScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  return [
    { dur: dur('ad5-01', lang), audio: clip('ad5-01', lang), node: <BigText text={c.a5p} sub={c.a5psub} color={theme.coral} size={94} /> },
    { dur: dur('ad5-02', lang), audio: clip('ad5-02', lang), node: appOutcome(lang, 'leads', c.a5s, c.a5ssub) },
    ctaScene(lang),
  ];
};

export const AdNeverMiss: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adNeverMissScenes(lang)} />;
export const AdSpeed: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adSpeedScenes(lang)} />;
export const AdReady: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adReadyScenes(lang)} />;
export const AdBilingual: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adBilingualScenes(lang)} />;
export const AdTimeBack: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adTimeBackScenes(lang)} />;

export const adDurations = {
  neverMiss: (l: Lang) => filmDuration(adNeverMissScenes(l)),
  speed: (l: Lang) => filmDuration(adSpeedScenes(l)),
  ready: (l: Lang) => filmDuration(adReadyScenes(l)),
  bilingual: (l: Lang) => filmDuration(adBilingualScenes(l)),
  timeBack: (l: Lang) => filmDuration(adTimeBackScenes(l)),
};
