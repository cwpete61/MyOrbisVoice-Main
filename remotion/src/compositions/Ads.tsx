import { AbsoluteFill } from 'remotion';
import { AppCockpit } from '../components/AppCockpit';
import { CTACard } from '../components/CTACard';
import { PhoneCallSim } from '../components/PhoneCallSim';
import { BigText, RingingHook, Scene, Stage } from '../components/Scene';
import { theme } from '../theme';

type Lang = 'en' | 'es';

const T = {
  en: {
    aHook: 'ring… ring… ring…',
    a: 'Missed call = lost commission.',
    aSub: 'THIS SOUND IS COSTING YOU DEALS',
    b: 'Your phone doesn’t speak their language. Orby does.',
    bSub: 'MOST NET NEW HOMEOWNERS: LATINO¹',
    cHook: 'You’re at a showing.',
    cHookSub: 'WHILE YOU CLOSE ONE DEAL…',
    c: 'Booked while you worked.',
    d: 'A name. That’s it.',
    dSub: 'MOST AGENTS WALK IN KNOWING',
    d2: 'Walk in ready to close.',
  },
  es: {
    aHook: 'ring… ring… ring…',
    a: 'Llamada perdida = comisión perdida.',
    aSub: 'ESE SONIDO TE CUESTA VENTAS',
    b: 'Tu teléfono no habla su idioma. Orby sí.',
    bSub: 'MAYORÍA DEL CRECIMIENTO NETO DE PROPIETARIOS: LATINO¹',
    cHook: 'Estás en una cita.',
    cHookSub: 'MIENTRAS CIERRAS UNA VENTA…',
    c: 'Agendado mientras trabajabas.',
    d: 'Un nombre. Eso es todo.',
    dSub: 'CON LO QUE LLEGA LA MAYORÍA',
    d2: 'Llega listo para cerrar.',
  },
};

/** Ad A — missed call = lost commission (18s / 540f) */
export const AdMissedCall: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = T[lang];
  const vo = (id: string) => (lang === 'en' ? id : undefined);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene audio={vo('adA-01')} from={0} dur={150}><RingingHook caption={c.aHook} /></Scene>
      <Scene audio={vo('adA-02')} from={150} dur={210}><BigText text={c.a} sub={c.aSub} bg={theme.amberBg} color={theme.amber} size={100} /></Scene>
      <Scene audio={vo('adA-03')} from={360} dur={180}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};

/** Ad B — Latino wedge, Spanish sim (20s / 600f) */
export const AdLatino: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = T[lang];
  const vo = (id: string) => (lang === 'en' ? id : undefined);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene audio={vo('adB-01')} from={0} dur={180}><BigText text={c.b} sub={c.bSub} bg={theme.teal} color={theme.white} size={92} /></Scene>
      <Scene audio={vo('adB-02')} from={180} dur={240}><Stage scale={1.15}><PhoneCallSim variant="rent-es" showApp={false} /></Stage></Scene>
      <Scene audio={vo('adA-03')} from={420} dur={180}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};

/** Ad C — speed / the sim (22s / 660f) */
export const AdSpeed: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = T[lang];
  const vo = (id: string) => (lang === 'en' ? id : undefined);
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene audio={vo('adC-01')} from={0} dur={120}><BigText text={c.cHook} sub={c.cHookSub} size={110} /></Scene>
      <Scene audio={vo('adC-02')} from={120} dur={360}><Stage scale={1.15}><PhoneCallSim variant={sim} showApp={false} /></Stage></Scene>
      <Scene audio={vo('adA-03')} from={480} dur={180}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};

/** Ad D — Showing Brief (20s / 600f) */
export const AdBrief: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = T[lang];
  const vo = (id: string) => (lang === 'en' ? id : undefined);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene audio={vo('adD-01')} from={0} dur={180}><BigText text={c.d} sub={c.dSub} bg={theme.amberBg} color={theme.amber} size={110} /></Scene>
      <Scene audio={vo('adD-02')} from={180} dur={240}>
        <Stage scale={0.95}>
          <div style={{ textAlign: 'center', fontFamily: theme.font }}>
            <AppCockpit highlight="brief" lang={lang} />
            <div style={{ fontSize: 60, fontWeight: 900, color: theme.ink, marginTop: 30 }}>{c.d2}</div>
          </div>
        </Stage>
      </Scene>
      <Scene audio={vo('adA-03')} from={420} dur={180}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};
