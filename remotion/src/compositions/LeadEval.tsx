import { CTACard } from '../components/CTACard';
import { LeadEvalReport } from '../components/LeadEvalReport';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText } from '../components/Scene';
import { theme } from '../theme';

// Lead Capture Eval demo (16:9). The free wedge tool: shows an agent exactly
// what they're leaking, then the CTA to get theirs.
type Lang = 'en' | 'es';
const VO: Record<string, number> = {
  'e-01-en': 157, 'e-01-es': 153, 'e-02-en': 169, 'e-02-es': 239, 'e-03-en': 166, 'e-03-es': 187,
  'e-04-en': 110, 'e-04-es': 150, 'e-05-en': 148, 'e-05-es': 143,
};
const TAIL = 18;
const beat = (id: string, lang: Lang): { dur: number; audio: string } => ({ dur: VO[`${id}-${lang}`]! + TAIL, audio: `${id}-${lang}` });

const COPY = {
  en: {
    hook: 'How many buyers did you lose last month?', hookSub: "YOU DON'T KNOW — THAT'S THE PROBLEM",
    what: 'Meet the free Lead Capture Eval.', whatSub: 'ORBY CHECKS HOW YOUR PHONE HANDLES REAL CALLS',
    reveal: 'The leak is bigger than you think.', revealSub: 'MOST AGENTS ARE STUNNED',
    ctaH: "See what you're losing.", ctaS: 'Free Lead Capture Eval — no credit card.',
  },
  es: {
    hook: '¿Cuántos compradores perdiste el mes pasado?', hookSub: 'NO LO SABES — ESE ES EL PROBLEMA',
    what: 'Conoce la Evaluación de Captura gratis.', whatSub: 'ORBY REVISA CÓMO TU TELÉFONO MANEJA LLAMADAS REALES',
    reveal: 'La fuga es más grande de lo que crees.', revealSub: 'LA MAYORÍA SE SORPRENDE',
    ctaH: 'Ve lo que estás perdiendo.', ctaS: 'Evaluación gratis — sin tarjeta.',
  },
};

export const leadEvalScenes = (lang: Lang): FilmScene[] => {
  const c = COPY[lang];
  return [
    { ...beat('e-01', lang), node: <BigText text={c.hook} sub={c.hookSub} color={theme.coral} size={88} /> },
    { ...beat('e-02', lang), node: <BigText text={c.what} sub={c.whatSub} size={92} withOrb /> },
    { ...beat('e-03', lang), node: <LeadEvalReport lang={lang} /> },
    { ...beat('e-04', lang), node: <BigText text={c.reveal} sub={c.revealSub} color={theme.coral} size={96} /> },
    { ...beat('e-05', lang), node: <CTACard lang={lang} headline={c.ctaH} sub={c.ctaS} showPhone={false} /> },
  ];
};

export const LeadEval: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={leadEvalScenes(lang)} />;
export const leadEvalDuration = (lang: Lang) => filmDuration(leadEvalScenes(lang));
