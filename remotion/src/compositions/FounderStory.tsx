import { AbsoluteFill } from 'remotion';
import { AppCockpit } from '../components/AppCockpit';
import { CTACard } from '../components/CTACard';
import { PhoneCallSim } from '../components/PhoneCallSim';
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
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene from={0} dur={180}><BigText text={c.open} sub={c.openSub} size={78} /></Scene>
      <Scene from={180} dur={450}><BigText text={c.loss} sub={c.lossSub} bg={theme.amberBg} color={theme.amber} size={120} /></Scene>
      <Scene from={630} dur={240}><BigText text={c.punch} sub={c.punchSub} bg={theme.amberBg} color={theme.amber} size={100} /></Scene>
      <Scene from={870} dur={240}><BigText text={c.decision} bg={theme.teal} color={theme.white} size={130} /></Scene>
      <Scene from={1110} dur={600}><Stage scale={0.82}><PhoneCallSim variant={sim} /></Stage></Scene>
      <Scene from={1710} dur={240}>
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
      <Scene from={1950} dur={300}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};
