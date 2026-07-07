import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, Stage } from '../components/Scene';
import { theme } from '../theme';

type Lang = 'en' | 'es';
const en = (l: Lang, id: string) => (l === 'en' ? id : undefined);

const COPY = {
  en: {
    open: 'For fifteen years I sold real estate and ran a mortgage branch.', openSub: 'A TRUE STORY',
    loss: 'Pre-approved. Ready. Gone.', lossSub: 'ONE CALL I MISSED',
    punch: 'One missed call. Three losses.', punchSub: 'CLIENT · COMMISSION · AD SPEND',
    decision: 'So I built Orby.',
    turn: 'The deal you’re about to miss — Orby catches it.', turnSub: 'NOW',
  },
  es: {
    open: 'Durante quince años vendí bienes raíces y dirigí una sucursal hipotecaria.', openSub: 'UNA HISTORIA REAL',
    loss: 'Preaprobada. Lista. Perdida.', lossSub: 'UNA LLAMADA QUE NO CONTESTÉ',
    punch: 'Una llamada perdida. Tres pérdidas.', punchSub: 'CLIENTE · COMISIÓN · PUBLICIDAD',
    decision: 'Por eso creé a Orby.',
    turn: 'La venta que estás por perder — Orby la atiende.', turnSub: 'AHORA',
  },
};

export const founderScenes = (lang: Lang): FilmScene[] => {
  const c = COPY[lang];
  const sim = lang === 'es' ? 'sale-es' : 'sale-en';
  return [
    { dur: 138, audio: en(lang, 'founder-01'), node: <BigText text={c.open} sub={c.openSub} size={78} /> },
    { dur: 272, audio: en(lang, 'founder-02'), node: <BigText text={c.loss} sub={c.lossSub} color={theme.coral} size={120} /> },
    { dur: 162, audio: en(lang, 'founder-03'), node: <BigText text={c.punch} sub={c.punchSub} color={theme.coral} size={100} /> },
    { dur: 122, audio: en(lang, 'founder-04'), node: <BigText text={c.decision} size={130} withOrb /> },
    { dur: callSceneDur(sim, 4, 85), node: <AudibleCall variant={sim} narrator={en(lang, 'founder-05')} maxTurns={4} scale={0.82} /> },
    { dur: 158, audio: en(lang, 'founder-06'), node: (
      <Stage scale={0.92}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
          <AppCockpit highlight="brief" lang={lang} />
          <div style={{ maxWidth: 620, fontFamily: theme.font }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 16 }}>{c.turnSub}</div>
            <div style={{ fontSize: 66, fontWeight: 900, color: theme.text, lineHeight: 1.1 }}>{c.turn}</div>
          </div>
        </div>
      </Stage>
    ) },
    { dur: 204, audio: en(lang, 'founder-07'), node: <CTACard lang={lang} /> },
  ];
};

export const FounderStory: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={founderScenes(lang)} />;
export const founderDuration = (lang: Lang) => filmDuration(founderScenes(lang));
