import { AbsoluteFill } from 'remotion';
import { AppCockpit } from '../components/AppCockpit';
import { CTACard } from '../components/CTACard';
import { PhoneCallSim } from '../components/PhoneCallSim';
import { BigText, RingingHook, Scene, Stage } from '../components/Scene';
import { brand, theme } from '../theme';

type Lang = 'en' | 'es';

const COPY = {
  en: {
    hook: 'Missed call = lost buyer.',
    tagline: brand.tagline,
    sim: 'Answers · qualifies · books — while you work.',
    app: 'Every lead + a Showing Brief, in your pocket. Nothing typed.',
  },
  es: {
    hook: 'Llamada perdida = comprador perdido.',
    tagline: brand.taglineEs,
    sim: 'Atiende · califica · agenda — mientras trabajas.',
    app: 'Cada contacto + un Resumen de Cita, en tu bolsillo. Sin teclear.',
  },
};

/** ~35s homepage hero — muted-first (on-screen text carries it), loops clean. */
export const HomepageHero: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = COPY[lang];
  const vo = (id: string) => (lang === 'en' ? id : undefined);
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene audio={vo('homepage-01')} from={0} dur={120}><RingingHook caption={c.hook} /></Scene>
      <Scene audio={vo('homepage-02')} from={120} dur={180}><BigText text={c.tagline} size={130} /></Scene>
      <Scene audio={vo('homepage-03')} from={300} dur={360}>
        <Stage scale={0.8}>
          <PhoneCallSim variant={sim} />
        </Stage>
      </Scene>
      <Scene audio={vo('homepage-04')} from={660} dur={210}>
        <Stage scale={0.95}>
          <div style={{ display: 'flex', gap: 70, alignItems: 'center' }}>
            <AppCockpit highlight="brief" lang={lang} />
            <div style={{ maxWidth: 560, fontSize: 60, fontWeight: 900, color: theme.ink, fontFamily: theme.font, lineHeight: 1.1 }}>{c.app}</div>
          </div>
        </Stage>
      </Scene>
      <Scene audio={vo('homepage-05')} from={870} dur={180}><CTACard lang={lang} /></Scene>
      {/* sim caption for muted context */}
      <Scene from={300} dur={360}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60 }}>
          <div style={{ fontFamily: theme.font, fontSize: 44, fontWeight: 800, color: theme.tealDeep }}>{c.sim}</div>
        </AbsoluteFill>
      </Scene>
    </AbsoluteFill>
  );
};
