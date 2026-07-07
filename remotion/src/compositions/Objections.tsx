import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { SetupSteps } from '../components/SetupSteps';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText } from '../components/Scene';

// Objection-handler (16:9). The 3 hesitations that kill signups, each answered
// with proof: hear it (call) · augmentation not replacement · 10-minute setup.
type Lang = 'en' | 'es';
const VO: Record<string, number> = {
  'o-01-en': 114, 'o-01-es': 116, 'o-02-en': 97, 'o-02-es': 98, 'o-03-en': 173, 'o-03-es': 193,
  'o-04-en': 138, 'o-04-es': 142, 'o-05-en': 191, 'o-05-es': 182,
};
const TAIL = 18;
const beat = (id: string, lang: Lang): { dur: number; audio: string } => ({ dur: VO[`${id}-${lang}`]! + TAIL, audio: `${id}-${lang}` });

const COPY = {
  en: {
    intro: 'Three reasons agents hesitate.', introSub: "LET'S KILL THEM",
    robot: '1 · WILL IT SOUND LIKE A ROBOT?',
    replace: 'It catches what you miss. You still close.', replaceSub: '2 · WILL IT REPLACE YOU?  —  NO.',
    hard: '3 · IS IT HARD TO SET UP?',
  },
  es: {
    intro: 'Tres razones por las que los agentes dudan.', introSub: 'VAMOS A DERRIBARLAS',
    robot: '1 · ¿SONARÁ COMO UN ROBOT?',
    replace: 'Atiende lo que pierdes. Tú sigues cerrando.', replaceSub: '2 · ¿TE REEMPLAZA?  —  NO.',
    hard: '3 · ¿ES DIFÍCIL DE CONFIGURAR?',
  },
};

export const objectionScenes = (lang: Lang): FilmScene[] => {
  const c = COPY[lang];
  const sim = lang === 'es' ? 'sale-es' : 'sale-en';
  const lead = VO[`o-02-${lang}`]! + 8;
  return [
    { ...beat('o-01', lang), node: <BigText text={c.intro} sub={c.introSub} size={100} withOrb /> },
    // 1 — hear it for yourself (the call is the proof)
    { dur: callSceneDur(sim, 3, lead), node: <AudibleCall variant={sim} narrator={`o-02-${lang}`} maxTurns={3} scale={0.82} caption={c.robot} leadIn={lead} /> },
    { ...beat('o-03', lang), node: <BigText text={c.replace} sub={c.replaceSub} size={86} /> },
    { ...beat('o-04', lang), node: <SetupSteps lang={lang} eyebrow={c.hard} /> },
    { ...beat('o-05', lang), node: <CTACard lang={lang} /> },
  ];
};

export const Objections: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={objectionScenes(lang)} />;
export const objectionDuration = (lang: Lang) => filmDuration(objectionScenes(lang));
