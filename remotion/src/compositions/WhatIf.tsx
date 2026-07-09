import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, Stage } from '../components/Scene';
import { theme } from '../theme';

// Jay-Abraham USP "What if…" videos. Each answers something ONLY Orby can do
// (unique mechanism) and proves it immediately with a live call. Structure:
// hook (dream) → gap (the loss) → live call (proof) → outcome → CTA.
type Lang = 'en' | 'es';

const VO: Record<string, number> = {
  'w1-01-en': 182, 'w1-01-es': 188, 'w1-02-en': 128, 'w1-02-es': 168, 'w1-03-en': 63, 'w1-03-es': 81, 'w1-04-en': 150, 'w1-04-es': 152,
  'w2-01-en': 155, 'w2-01-es': 174, 'w2-02-en': 161, 'w2-02-es': 140, 'w2-03-en': 62, 'w2-03-es': 62, 'w2-04-en': 92, 'w2-04-es': 98,
  'w3-01-en': 153, 'w3-01-es': 197, 'w3-02-en': 146, 'w3-02-es': 150, 'w3-03-en': 46, 'w3-03-es': 49, 'w3-04-en': 111, 'w3-04-es': 118,
  'cta-en': 239, 'cta-es': 242,
};
const TAIL = 18;
const beat = (id: string, lang: Lang): { dur: number; audio: string } => ({ dur: VO[`${id}-${lang}`]! + TAIL, audio: `${id}-${lang}` });
const ctaScene = (lang: Lang): FilmScene => ({ dur: VO[`cta-${lang}`]! + TAIL, audio: `cta-${lang}`, node: <CTACard lang={lang} /> });

const T = {
  en: {
    v1h: 'What if the call you couldn’t take… booked itself?', v1hs: 'YOU’RE MID-SHOWING',
    v1g: 'So the buyer calls the next agent.', v1gs: 'YOU CAN’T ANSWER — YOU’RE WITH A CLIENT',
    v1o: 'Booked before you walked out. Pre-approval and all.', v1os: 'ORBY ANSWERED FIRST',
    v2h: 'What if you captured every Spanish-speaking buyer?', v2hs: 'WITHOUT SPEAKING A WORD OF SPANISH',
    v2g: 'Your phone doesn’t speak their language. So they hang up.', v2gs: 'AND DIAL SOMEONE WHO DOES',
    v2o: 'Booked. In their language.', v2os: 'ORBY SWITCHED INSTANTLY',
    v3h: 'What if 2 a.m. leads booked themselves by sunrise?', v3hs: 'WHILE YOU SLEPT',
    v3g: 'Nights, weekends, asleep — that’s when buyers call.', v3gs: 'AND WHEN YOU DON’T ANSWER',
    v3o: 'A booked showing and a full brief, waiting for you.', v3os: 'ORBY NEVER SLEEPS',
  },
  es: {
    v1h: '¿Y si la llamada que no pudiste tomar… se agendara sola?', v1hs: 'ESTÁS EN UNA CITA',
    v1g: 'Así que el comprador llama al siguiente agente.', v1gs: 'NO PUEDES CONTESTAR — ESTÁS CON UN CLIENTE',
    v1o: 'Agendada antes de que salieras. Con preaprobación y todo.', v1os: 'ORBY CONTESTÓ PRIMERO',
    v2h: '¿Y si captaras a cada comprador que habla español?', v2hs: 'SIN HABLAR UNA PALABRA DE ESPAÑOL',
    v2g: 'Tu teléfono no habla su idioma. Así que cuelgan.', v2gs: 'Y MARCAN A ALGUIEN QUE SÍ',
    v2o: 'Agendado. En su idioma.', v2os: 'ORBY CAMBIÓ AL INSTANTE',
    v3h: '¿Y si los compradores de las 2 a.m. se agendaran al amanecer?', v3hs: 'MIENTRAS DORMÍAS',
    v3g: 'Noches, fines de semana, dormido — así llaman los compradores.', v3gs: 'Y ASÍ NO CONTESTAS',
    v3o: 'Una visita agendada y un resumen completo, esperándote.', v3os: 'ORBY NUNCA DUERME',
  },
};

const appOutcome = (lang: Lang, body: string, sub: string) => (
  <Stage scale={0.94}>
    <div style={{ display: 'flex', gap: 74, alignItems: 'center' }}>
      <AppCockpit highlight="brief" lang={lang} />
      <div style={{ maxWidth: 600, fontFamily: theme.font }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, letterSpacing: 1.5, marginBottom: 16 }}>{sub}</div>
        <div style={{ fontSize: 64, fontWeight: 900, color: theme.text, lineHeight: 1.1 }}>{body}</div>
      </div>
    </div>
  </Stage>
);

// ── Video 1 — Mid-showing (sales call proof) ──
export const whatIfShowingScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang]; const sim = lang === 'es' ? 'sale-es' : 'sale-en'; const lead = VO[`w1-03-${lang}`]! + 8;
  return [
    { ...beat('w1-01', lang), node: <BigText text={c.v1h} sub={c.v1hs} size={86} withOrb /> },
    { ...beat('w1-02', lang), node: <BigText text={c.v1g} sub={c.v1gs} color={theme.coral} size={82} /> },
    { dur: callSceneDur(sim, 3, lead), node: <AudibleCall variant={sim} narrator={`w1-03-${lang}`} maxTurns={3} scale={0.82} leadIn={lead} /> },
    { ...beat('w1-04', lang), node: <BigText text={c.v1o} sub={c.v1os} size={78} /> },
    ctaScene(lang),
  ];
};

// ── Video 2 — Spanish buyer (Spanish call proof) ──
export const whatIfSpanishScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang]; const lead = VO[`w2-03-${lang}`]! + 8;
  return [
    { ...beat('w2-01', lang), node: <BigText text={c.v2h} sub={c.v2hs} size={86} withOrb /> },
    { ...beat('w2-02', lang), node: <BigText text={c.v2g} sub={c.v2gs} color={theme.coral} size={82} /> },
    { dur: callSceneDur('rent-es', 3, lead), node: <AudibleCall variant="rent-es" narrator={`w2-03-${lang}`} maxTurns={3} scale={0.82} leadIn={lead} /> },
    { ...beat('w2-04', lang), node: <BigText text={c.v2o} sub={c.v2os} size={88} /> },
    ctaScene(lang),
  ];
};

// ── Video 3 — While you slept (call + Showing Brief) ──
export const whatIfSleptScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang]; const sim = lang === 'es' ? 'sale-es' : 'sale-en'; const lead = VO[`w3-03-${lang}`]! + 8;
  return [
    { ...beat('w3-01', lang), node: <BigText text={c.v3h} sub={c.v3hs} size={84} withOrb /> },
    { ...beat('w3-02', lang), node: <BigText text={c.v3g} sub={c.v3gs} color={theme.coral} size={80} /> },
    { dur: callSceneDur(sim, 3, lead), node: <AudibleCall variant={sim} narrator={`w3-03-${lang}`} maxTurns={3} scale={0.82} leadIn={lead} /> },
    { ...beat('w3-04', lang), node: appOutcome(lang, c.v3o, c.v3os) },
    ctaScene(lang),
  ];
};

export const WhatIfShowing: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={whatIfShowingScenes(lang)} />;
export const WhatIfSpanish: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={whatIfSpanishScenes(lang)} />;
export const WhatIfSlept: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={whatIfSleptScenes(lang)} />;

export const whatIfDurations = {
  showing: (l: Lang) => filmDuration(whatIfShowingScenes(l)),
  spanish: (l: Lang) => filmDuration(whatIfSpanishScenes(l)),
  slept: (l: Lang) => filmDuration(whatIfSleptScenes(l)),
};
