import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, RingingHook, Stage } from '../components/Scene';
import { theme } from '../theme';

type Lang = 'en' | 'es';
const en = (l: Lang, id: string) => (l === 'en' ? id : undefined); // narrator VO is EN-only

const T = {
  en: {
    aHook: 'ring… ring… ring…', a: 'Missed call = lost commission.', aSub: 'THIS SOUND IS COSTING YOU DEALS',
    b: 'Your phone doesn’t speak their language. Orby does.', bSub: 'MOST NET NEW HOMEOWNERS: LATINO¹',
    cHook: 'You’re at a showing.', cHookSub: 'WHILE YOU CLOSE ONE DEAL…',
    d: 'A name. That’s it.', dSub: 'MOST AGENTS WALK IN KNOWING', d2: 'Walk in ready to close.',
  },
  es: {
    aHook: 'ring… ring… ring…', a: 'Llamada perdida = comisión perdida.', aSub: 'ESE SONIDO TE CUESTA VENTAS',
    b: 'Tu teléfono no habla su idioma. Orby sí.', bSub: 'MAYORÍA DEL CRECIMIENTO NETO DE PROPIETARIOS: LATINO¹',
    cHook: 'Estás en una cita.', cHookSub: 'MIENTRAS CIERRAS UNA VENTA…',
    d: 'Un nombre. Eso es todo.', dSub: 'CON LO QUE LLEGA LA MAYORÍA', d2: 'Llega listo para cerrar.',
  },
};

// ── Ad A — missed call = lost commission ──
export const adMissedCallScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  return [
    { dur: 100, audio: en(lang, 'adA-01'), node: <RingingHook caption={c.aHook} /> },
    { dur: 165, audio: en(lang, 'adA-02'), node: <BigText text={c.a} sub={c.aSub} color={theme.coral} size={100} /> },
    { dur: 190, audio: en(lang, 'adA-03'), node: <CTACard lang={lang} /> },
  ];
};
export const AdMissedCall: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adMissedCallScenes(lang)} />;

// ── Ad B — Latino wedge (Spanish snippet) ──
export const adLatinoScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  return [
    { dur: 150, audio: en(lang, 'adB-01'), node: <BigText text={c.b} sub={c.bSub} color={theme.white} size={92} /> },
    { dur: callSceneDur('es', 2, 90), node: <AudibleCall callLang="es" simVariant="rent-es" narrator={en(lang, 'adB-02')} maxTurns={2} scale={1.15} showApp={false} leadIn={90} /> },
    { dur: 190, audio: en(lang, 'adA-03'), node: <CTACard lang={lang} /> },
  ];
};
export const AdLatino: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adLatinoScenes(lang)} />;

// ── Ad C — speed / the sim (snippet) ──
export const adSpeedScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  return [
    { dur: 80, audio: en(lang, 'adC-01'), node: <BigText text={c.cHook} sub={c.cHookSub} size={110} /> },
    { dur: callSceneDur(lang, 2, 90), node: <AudibleCall callLang={lang} simVariant={sim} narrator={en(lang, 'adC-02')} maxTurns={2} scale={1.15} showApp={false} leadIn={90} /> },
    { dur: 190, audio: en(lang, 'adA-03'), node: <CTACard lang={lang} /> },
  ];
};
export const AdSpeed: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adSpeedScenes(lang)} />;

// ── Ad D — Showing Brief ──
export const adBriefScenes = (lang: Lang): FilmScene[] => {
  const c = T[lang];
  return [
    { dur: 100, audio: en(lang, 'adD-01'), node: <BigText text={c.d} sub={c.dSub} color={theme.coral} size={110} /> },
    { dur: 210, audio: en(lang, 'adD-02'), node: (
      <Stage scale={0.95}>
        <div style={{ textAlign: 'center', fontFamily: theme.font }}>
          <AppCockpit highlight="brief" lang={lang} />
          <div style={{ fontSize: 60, fontWeight: 900, color: theme.text, marginTop: 30 }}>{c.d2}</div>
        </div>
      </Stage>
    ) },
    { dur: 190, audio: en(lang, 'adA-03'), node: <CTACard lang={lang} /> },
  ];
};
export const AdBrief: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={adBriefScenes(lang)} />;

export const adDurations = {
  missed: (l: Lang) => filmDuration(adMissedCallScenes(l)),
  latino: (l: Lang) => filmDuration(adLatinoScenes(l)),
  speed: (l: Lang) => filmDuration(adSpeedScenes(l)),
  brief: (l: Lang) => filmDuration(adBriefScenes(l)),
};
