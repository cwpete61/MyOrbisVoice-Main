import { AbsoluteFill } from 'remotion';
import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { callSceneDur } from '../data/calls';
import { BigText, Scene, Stage } from '../components/Scene';
import { theme } from '../theme';

type Lang = 'en' | 'es';

const COPY = {
  en: {
    open: 'For fifteen years I sold real estate and ran a mortgage branch.',
    openSub: 'A TRUE STORY',
    loss: 'Pre-approved. Ready. Gone.',
    lossSub: 'ONE CALL I MISSED',
    punch: 'One missed call. Three losses.',
    punchSub: 'CLIENT · COMMISSION · AD SPEND',
    decision: 'So I built Orby.',
    turn: 'The deal you’re about to miss — Orby catches it.',
    turnSub: 'NOW',
  },
  es: {
    open: 'Durante quince años vendí bienes raíces y dirigí una sucursal hipotecaria.',
    openSub: 'UNA HISTORIA REAL',
    loss: 'Preaprobada. Lista. Perdida.',
    lossSub: 'UNA LLAMADA QUE NO CONTESTÉ',
    punch: 'Una llamada perdida. Tres pérdidas.',
    punchSub: 'CLIENTE · COMISIÓN · PUBLICIDAD',
    decision: 'Por eso creé a Orby.',
    turn: 'La venta que estás por perder — Orby la atiende.',
    turnSub: 'AHORA',
  },
};

export const FounderStory: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = COPY[lang];
  const vo = (id: string) => (lang === 'en' ? id : undefined);
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  const sim5Dur = callSceneDur(lang, 4, 85); // audible call snippet (4 turns)
  const shift = sim5Dur - 600;
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene audio={vo('founder-01')} from={0} dur={180}><BigText text={c.open} sub={c.openSub} size={78} /></Scene>
      <Scene audio={vo('founder-02')} from={180} dur={450}><BigText text={c.loss} sub={c.lossSub} bg={theme.amberBg} color={theme.amber} size={120} /></Scene>
      <Scene audio={vo('founder-03')} from={630} dur={240}><BigText text={c.punch} sub={c.punchSub} bg={theme.amberBg} color={theme.amber} size={100} /></Scene>
      <Scene audio={vo('founder-04')} from={870} dur={240}><BigText text={c.decision} bg={theme.teal} color={theme.white} size={130} /></Scene>
      <Scene from={1110} dur={sim5Dur}>
        <AudibleCall callLang={lang} simVariant={sim} narrator={vo('founder-05')} maxTurns={4} scale={0.82} />
      </Scene>
      <Scene audio={vo('founder-06')} from={1710 + shift} dur={240}>
        <Stage scale={0.92}>
          <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
            <AppCockpit highlight="brief" lang={lang} />
            <div style={{ maxWidth: 620, fontFamily: theme.font }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 16 }}>{c.turnSub}</div>
              <div style={{ fontSize: 66, fontWeight: 900, color: theme.ink, lineHeight: 1.1 }}>{c.turn}</div>
            </div>
          </div>
        </Stage>
      </Scene>
      <Scene audio={vo('founder-07')} from={1950 + shift} dur={300}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};
