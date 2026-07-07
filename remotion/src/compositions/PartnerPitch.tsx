import { CTACard } from '../components/CTACard';
import { LeadEvalReport } from '../components/LeadEvalReport';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText } from '../components/Scene';
import { theme } from '../theme';

// Partner recruitment (16:9). Audience = affiliates who refer agents. PAS-ish:
// your network is leaking → refer to Orby → recurring income, we run the tech.
type Lang = 'en' | 'es';
const VO: Record<string, number> = {
  'p-01-en': 147, 'p-01-es': 142, 'p-02-en': 160, 'p-02-es': 218, 'p-03-en': 233, 'p-03-es': 251,
  'p-04-en': 242, 'p-04-es': 276, 'p-05-en': 198, 'p-05-es': 177,
};
const TAIL = 18;
const beat = (id: string, lang: Lang): { dur: number; audio: string } => ({ dur: VO[`${id}-${lang}`]! + TAIL, audio: `${id}-${lang}` });

const COPY = {
  en: {
    hook: 'You have the agents. We have the AI.', hookSub: 'PARTNER WITH MYORBISAGENTS',
    prob: 'Every agent you know is bleeding leads to missed calls.', probSub: 'NIGHTS · WEEKENDS · MID-SHOWING',
    offer: 'Recurring commission on every agent — every month.', offerSub: 'YOU REFER · WE RUN THE TECH, ONBOARDING & SUPPORT',
    loop: 'Hand out a free Eval. They see the leak. You get paid.', loopSub: 'THE LOOP',
    ctaH: 'Turn your network into recurring income.', ctaS: 'Become a partner — no tech to build.',
  },
  es: {
    hook: 'Tú tienes los agentes. Nosotros la IA.', hookSub: 'ASÓCIATE CON MYORBISAGENTS',
    prob: 'Cada agente que conoces pierde clientes por llamadas sin contestar.', probSub: 'NOCHES · FINES DE SEMANA · EN PLENA CITA',
    offer: 'Comisión recurrente por cada agente — cada mes.', offerSub: 'TÚ REFIERES · NOSOTROS PONEMOS TECNOLOGÍA, ALTA Y SOPORTE',
    loop: 'Entrega una Evaluación gratis. Ven la fuga. Tú cobras.', loopSub: 'EL CICLO',
    ctaH: 'Convierte tu red en ingreso recurrente.', ctaS: 'Hazte socio — sin construir nada.',
  },
};

export const partnerScenes = (lang: Lang): FilmScene[] => {
  const c = COPY[lang];
  return [
    { ...beat('p-01', lang), node: <BigText text={c.hook} sub={c.hookSub} size={104} withOrb /> },
    { ...beat('p-02', lang), node: <BigText text={c.prob} sub={c.probSub} color={theme.coral} size={82} /> },
    { ...beat('p-03', lang), node: <BigText text={c.offer} sub={c.offerSub} size={80} /> },
    { ...beat('p-04', lang), node: <LeadEvalReport lang={lang} /> },
    { ...beat('p-05', lang), node: <CTACard lang={lang} headline={c.ctaH} sub={c.ctaS} showPhone={false} /> },
  ];
};

export const PartnerPitch: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={partnerScenes(lang)} />;
export const partnerDuration = (lang: Lang) => filmDuration(partnerScenes(lang));
