import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { KpiCounter } from '../components/KpiCounter';
import { StatScene } from '../components/StatScene';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, RingingHook, Stage } from '../components/Scene';
import { brand, theme } from '../theme';

type Lang = 'en' | 'es';
const en = (l: Lang, id: string) => (l === 'en' ? id : undefined);

const COPY = {
  en: {
    ring: 'ring… ring…',
    statSub: 'THE MATH ON A MISSED CALL', stat78Label: 'go with the first agent to respond', stat5Label: 'before a lead goes cold',
    statCap: 'You can’t answer mid-showing, driving, or asleep. But somebody has to.',
    wave: 'The growth in home buying speaks Spanish.¹', waveSub: 'MOST NET NEW U.S. HOMEOWNERS: LATINO',
    proof: 'Built by an agent who lost the deal.', proofSub: 'FIFTEEN YEARS. ONE MISSED CALL.',
    orby: brand.tagline, orbySub: 'YOUR AI RECEPTIONIST',
    control: 'You see everything. You approve everything. Orby never goes behind your back. And you never type a word.', controlSub: 'YOU’RE IN CONTROL',
    success: 'Booked while you showed.', successSub: 'SATURDAY, MID-SHOWING — ORBY ANSWERED ALL THREE',
    caught: 'leads caught', slept: 'booked while you slept',
    gapLt: 'Without Orby', gapRt: 'With Orby',
  },
  es: {
    ring: 'ring… ring…',
    statSub: 'LAS CUENTAS DE UNA LLAMADA PERDIDA', stat78Label: 'elige al primer agente que contesta', stat5Label: 'y el contacto se enfría',
    statCap: 'No puedes contestar en una cita, manejando o dormido. Pero alguien tiene que hacerlo.',
    wave: 'El crecimiento en la compra de casas habla español.¹', waveSub: 'MAYORÍA DEL CRECIMIENTO NETO DE PROPIETARIOS: LATINO',
    proof: 'Creado por un agente que perdió la venta.', proofSub: 'QUINCE AÑOS. UNA LLAMADA PERDIDA.',
    orby: brand.taglineEs, orbySub: 'TU RECEPCIONISTA CON IA',
    control: 'Ves todo. Apruebas todo. Orby nunca actúa a tus espaldas. Y nunca tecleas una palabra.', controlSub: 'TÚ TIENES EL CONTROL',
    success: 'Agendado mientras mostrabas.', successSub: 'SÁBADO, EN UNA CITA — ORBY ATENDIÓ LAS TRES',
    caught: 'llamadas atendidas', slept: 'citas mientras dormías',
    gapLt: 'Sin Orby', gapRt: 'Con Orby',
  },
};

export const twoMinuteScenes = (lang: Lang): FilmScene[] => {
  const c = COPY[lang];
  return [
    { dur: 130, audio: en(lang, 'twomin-01'), node: <RingingHook caption={c.ring} /> },
    { dur: 361, audio: en(lang, 'twomin-02'), node: <StatScene eyebrow={c.statSub} stats={[{ to: 78, suffix: '%', label: c.stat78Label }, { prefix: '<', from: 30, to: 5, suffix: ' min', label: c.stat5Label, color: theme.coral }]} caption={c.statCap} /> },
    { dur: 264, audio: en(lang, 'twomin-03'), node: <BigText text={c.wave} sub={c.waveSub} color={theme.white} size={80} /> },
    { dur: 174, audio: en(lang, 'twomin-04'), node: <BigText text={c.proof} sub={c.proofSub} size={96} /> },
    { dur: 100, audio: en(lang, 'twomin-05'), node: <BigText text={c.orby} sub={c.orbySub} size={104} withOrb /> },
    { dur: callSceneDur('rent-es', 4, 105), node: <AudibleCall variant="rent-es" narrator={en(lang, 'twomin-06')} maxTurns={4} scale={0.82} leadIn={105} /> },
    { dur: 190, audio: en(lang, 'twomin-07'), node: (
      <Stage scale={0.9}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
          <AppCockpit highlight="leads" lang={lang} />
          <div style={{ maxWidth: 640, fontFamily: theme.font }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: theme.muted, marginBottom: 16 }}>{c.controlSub}</div>
            <div style={{ fontSize: 54, fontWeight: 900, color: theme.text, lineHeight: 1.12 }}>{c.control}</div>
          </div>
        </div>
      </Stage>
    ) },
    { dur: 251, audio: en(lang, 'twomin-08'), node: (
      <Stage>
        <div style={{ fontFamily: theme.font, textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: theme.muted, marginBottom: 30 }}>{c.successSub}</div>
          <div style={{ fontSize: 88, fontWeight: 900, color: theme.text, marginBottom: 60 }}>{c.success}</div>
          <div style={{ display: 'flex', gap: 120, justifyContent: 'center' }}>
            <KpiCounter from={40} to={100} suffix="%" label={c.caught} />
            <KpiCounter from={0} to={2} label={c.slept} delay={12} />
          </div>
        </div>
      </Stage>
    ) },
    { dur: 204, audio: en(lang, 'twomin-09'), node: <CTACard lang={lang} /> },
  ];
};

export const TwoMinute: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={twoMinuteScenes(lang)} />;
export const twoMinuteDuration = (lang: Lang) => filmDuration(twoMinuteScenes(lang));
