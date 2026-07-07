import { AbsoluteFill } from 'remotion';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, Bg } from '../components/Scene';
import { Logo } from '../components/Logo';
import { Orb } from '../components/Orb';
import { brand, theme } from '../theme';

// Five 6-second vertical hook cutdowns (9:16) — scroll-stoppers for pre-roll /
// Reels / TikTok. One punch line + a fast brand tag. Voice: nova.
type Lang = 'en' | 'es';
const VO: Record<string, number> = {
  'cut1-en': 111, 'cut1-es': 124, 'cut2-en': 85, 'cut2-es': 102, 'cut3-en': 100, 'cut3-es': 78,
  'cut4-en': 91, 'cut4-es': 114, 'cut5-en': 98, 'cut5-es': 101,
};

const MiniTag: React.FC<{ lang: Lang }> = ({ lang }) => (
  <Bg>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', fontFamily: theme.font }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><Orb size={150} /></div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><Logo onDark size={1.3} /></div>
        <div style={{ fontSize: 58, fontWeight: 900, color: theme.text, marginBottom: 16 }}>{lang === 'es' ? brand.taglineEs : brand.tagline}</div>
        <div style={{ fontSize: 40, fontWeight: 700, color: theme.aqua }}>{brand.site}</div>
      </div>
    </AbsoluteFill>
  </Bg>
);

const HOOKS = {
  en: {
    cut1: { t: 'A missed call = a lost commission.', c: theme.coral },
    cut2: { t: 'Buyers pick whoever answers first.', c: theme.text },
    cut3: { t: 'Walk in knowing how to close.', c: theme.text },
    cut4: { t: 'Your buyers speak Spanish. Now your phone does too.', c: theme.text },
    cut5: { t: 'Stop babysitting your phone.', c: theme.coral },
  },
  es: {
    cut1: { t: 'Llamada perdida = comisión perdida.', c: theme.coral },
    cut2: { t: 'El comprador elige al que contesta primero.', c: theme.text },
    cut3: { t: 'Llega sabiendo cómo cerrar.', c: theme.text },
    cut4: { t: 'Tus compradores hablan español. Tu teléfono también.', c: theme.text },
    cut5: { t: 'Deja de cuidar el teléfono.', c: theme.coral },
  },
};

const cutScenes = (id: 'cut1' | 'cut2' | 'cut3' | 'cut4' | 'cut5', lang: Lang): FilmScene[] => {
  const h = HOOKS[lang][id];
  return [
    { dur: VO[`${id}-${lang}`]! + 16, audio: `${id}-${lang}`, node: <BigText text={h.t} color={h.c} size={104} /> },
    { dur: 46, node: <MiniTag lang={lang} /> },
  ];
};

export const CutNeverMiss: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={cutScenes('cut1', lang)} />;
export const CutSpeed: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={cutScenes('cut2', lang)} />;
export const CutReady: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={cutScenes('cut3', lang)} />;
export const CutBilingual: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={cutScenes('cut4', lang)} />;
export const CutTimeBack: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={cutScenes('cut5', lang)} />;

export const cutDurations = {
  neverMiss: (l: Lang) => filmDuration(cutScenes('cut1', l)),
  speed: (l: Lang) => filmDuration(cutScenes('cut2', l)),
  ready: (l: Lang) => filmDuration(cutScenes('cut3', l)),
  bilingual: (l: Lang) => filmDuration(cutScenes('cut4', l)),
  timeBack: (l: Lang) => filmDuration(cutScenes('cut5', l)),
};
