import { AbsoluteFill } from 'remotion';
import { AppCockpit } from '../components/AppCockpit';
import { CTACard } from '../components/CTACard';
import { KpiCounter } from '../components/KpiCounter';
import { PhoneCallSim } from '../components/PhoneCallSim';
import { RealityGap } from '../components/RealityGap';
import { BigText, RingingHook, Scene, Stage } from '../components/Scene';
import { brand, theme } from '../theme';

type Lang = 'en' | 'es';

const COPY = {
  en: {
    ring: 'ring… ring…',
    gapL: 'You’re one person. At a showing, in a closing, asleep. The phone doesn’t care.',
    gapR: 'Every call caught, qualified, and booked — 24/7, English or Spanish.',
    wave: 'The growth in home buying speaks Spanish.¹',
    waveSub: 'MOST NET NEW U.S. HOMEOWNERS: LATINO',
    proof: 'Built by an agent who lost the deal.',
    proofSub: 'FIFTEEN YEARS. ONE MISSED CALL.',
    orby: brand.tagline,
    orbySub: 'YOUR AI RECEPTIONIST',
    control: 'You see everything. You approve everything. Orby never goes behind your back. And you never type a word.',
    controlSub: 'YOU’RE IN CONTROL',
    success: 'Booked while you showed.',
    successSub: 'SATURDAY, MID-SHOWING — ORBY ANSWERED ALL THREE',
    caught: 'leads caught',
    slept: 'booked while you slept',
  },
  es: {
    ring: 'ring… ring…',
    gapL: 'Eres una sola persona. En una cita, cerrando, dormido. Al teléfono no le importa.',
    gapR: 'Cada llamada atendida, calificada y agendada — 24/7, en inglés o español.',
    wave: 'El crecimiento en la compra de casas habla español.¹',
    waveSub: 'MAYORÍA DEL CRECIMIENTO NETO DE PROPIETARIOS: LATINO',
    proof: 'Creado por un agente que perdió la venta.',
    proofSub: 'QUINCE AÑOS. UNA LLAMADA PERDIDA.',
    orby: brand.taglineEs,
    orbySub: 'TU RECEPCIONISTA CON IA',
    control: 'Ves todo. Apruebas todo. Orby nunca actúa a tus espaldas. Y nunca tecleas una palabra.',
    controlSub: 'TÚ TIENES EL CONTROL',
    success: 'Agendado mientras mostrabas.',
    successSub: 'SÁBADO, EN UNA CITA — ORBY ATENDIÓ LAS TRES',
    caught: 'llamadas atendidas',
    slept: 'citas mientras dormías',
  },
};

export const TwoMinute: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = COPY[lang];
  const vo = (id: string) => (lang === 'en' ? id : undefined);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene audio={vo('twomin-01')} from={0} dur={210}><RingingHook caption={c.ring} /></Scene>
      <Scene audio={vo('twomin-02')} from={210} dur={450}><RealityGap leftBody={c.gapL} rightBody={c.gapR} leftTitle={lang === 'es' ? 'Sin Orby' : 'Without Orby'} rightTitle={lang === 'es' ? 'Con Orby' : 'With Orby'} /></Scene>
      <Scene audio={vo('twomin-03')} from={660} dur={360}><BigText text={c.wave} sub={c.waveSub} bg={theme.teal} color={theme.white} size={80} /></Scene>
      <Scene audio={vo('twomin-04')} from={1020} dur={360}><BigText text={c.proof} sub={c.proofSub} size={96} /></Scene>
      <Scene audio={vo('twomin-05')} from={1380} dur={240}><BigText text={c.orby} sub={c.orbySub} size={104} withOrb /></Scene>
      {/* the Spanish sim as the wedge proof (subtitled), in both language cuts */}
      <Scene audio={vo('twomin-06')} from={1620} dur={900}><Stage scale={0.82}><PhoneCallSim variant="rent-es" /></Stage></Scene>
      <Scene audio={vo('twomin-07')} from={2520} dur={360}>
        <Stage scale={0.9}>
          <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
            <AppCockpit highlight="leads" lang={lang} />
            <div style={{ maxWidth: 640, fontFamily: theme.font }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: theme.muted, marginBottom: 16 }}>{c.controlSub}</div>
              <div style={{ fontSize: 54, fontWeight: 900, color: theme.ink, lineHeight: 1.12 }}>{c.control}</div>
            </div>
          </div>
        </Stage>
      </Scene>
      <Scene audio={vo('twomin-08')} from={2880} dur={420}>
        <Stage>
          <div style={{ fontFamily: theme.font, textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: theme.muted, marginBottom: 30 }}>{c.successSub}</div>
            <div style={{ fontSize: 88, fontWeight: 900, color: theme.ink, marginBottom: 60 }}>{c.success}</div>
            <div style={{ display: 'flex', gap: 120, justifyContent: 'center' }}>
              <KpiCounter from={40} to={100} suffix="%" label={c.caught} />
              <KpiCounter from={0} to={2} label={c.slept} delay={12} />
            </div>
          </div>
        </Stage>
      </Scene>
      <Scene audio={vo('twomin-09')} from={3300} dur={300}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};
