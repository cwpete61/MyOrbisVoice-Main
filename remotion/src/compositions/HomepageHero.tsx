import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, RingingHook, Stage } from '../components/Scene';
import { brand, theme } from '../theme';

type Lang = 'en' | 'es';
const en = (l: Lang, id: string) => (l === 'en' ? id : undefined);

const COPY = {
  en: { hook: 'Missed call = lost buyer.', tagline: brand.tagline, app: 'Every lead + a Showing Brief, in your pocket. Nothing typed.' },
  es: { hook: 'Llamada perdida = comprador perdido.', tagline: brand.taglineEs, app: 'Cada contacto + un Resumen de Cita, en tu bolsillo. Sin teclear.' },
};

export const homepageScenes = (lang: Lang): FilmScene[] => {
  const c = COPY[lang];
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  return [
    { dur: 92, audio: en(lang, 'homepage-01'), node: <RingingHook caption={c.hook} /> },
    { dur: 84, audio: en(lang, 'homepage-02'), node: <BigText text={c.tagline} size={130} withOrb /> },
    { dur: callSceneDur(lang, 2, 120), node: <AudibleCall callLang={lang} simVariant={sim} narrator={en(lang, 'homepage-03')} maxTurns={2} scale={0.8} leadIn={120} /> },
    { dur: 116, audio: en(lang, 'homepage-04'), node: (
      <Stage scale={0.95}>
        <div style={{ display: 'flex', gap: 70, alignItems: 'center' }}>
          <AppCockpit highlight="brief" lang={lang} />
          <div style={{ maxWidth: 560, fontSize: 60, fontWeight: 900, color: theme.text, fontFamily: theme.font, lineHeight: 1.1 }}>{c.app}</div>
        </div>
      </Stage>
    ) },
    { dur: 190, audio: en(lang, 'homepage-05'), node: <CTACard lang={lang} /> },
  ];
};

/** ~28s homepage hero — crossfaded, VO-fit, muted-first (text carries it). */
export const HomepageHero: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={homepageScenes(lang)} />;
export const homepageDuration = (lang: Lang) => filmDuration(homepageScenes(lang));
