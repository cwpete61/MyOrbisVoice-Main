import { AbsoluteFill } from 'remotion';
import { AppCockpit } from '../components/AppCockpit';
import { CTACard } from '../components/CTACard';
import { KpiCounter } from '../components/KpiCounter';
import { PhoneCallSim } from '../components/PhoneCallSim';
import { RealityGap } from '../components/RealityGap';
import { BigText, RingingHook, Scene, Stage } from '../components/Scene';
import { theme } from '../theme';

type Lang = 'en' | 'es';

const COPY = {
  en: {
    ring: 'ring… ring… ring…',
    gapL: 'Phone rings out. Buyer calls the next agent. You paid for that lead.',
    gapR: 'Every call answered, qualified, booked — English or Spanish.',
    gapLt: 'Without Orby',
    gapRt: 'With Orby',
    wave: 'Latinos are the majority of net new U.S. homeowner growth.¹',
    waveSub: 'THE GROWTH IN BUYING SPEAKS SPANISH',
    meet: 'Orby catches. You close.',
    meetSub: 'MEET ORBY — YOUR AI RECEPTIONIST',
    appSub: 'YOUR WHOLE PIPELINE, IN YOUR POCKET',
    app: 'Every lead, every showing — nothing typed. It fills itself.',
    briefSub: 'WALK IN READY',
    brief: 'Budget, pre-approval, timeline, must-haves — before you show.',
    successSub: 'WHAT SUCCESS LOOKS LIKE',
  },
  es: {
    ring: 'ring… ring… ring…',
    gapL: 'El teléfono suena y nadie contesta. El comprador llama al siguiente agente.',
    gapR: 'Cada llamada atendida, calificada y agendada — en inglés o español.',
    gapLt: 'Sin Orby',
    gapRt: 'Con Orby',
    wave: 'Los latinos son la mayoría del crecimiento neto de propietarios en EE. UU.¹',
    waveSub: 'EL CRECIMIENTO EN COMPRAS HABLA ESPAÑOL',
    meet: 'Orby atiende. Tú cierras.',
    meetSub: 'CONOCE A ORBY — TU RECEPCIONISTA CON IA',
    appSub: 'TODA TU CARTERA, EN TU BOLSILLO',
    app: 'Cada contacto, cada cita — sin teclear nada. Se llena solo.',
    briefSub: 'LLEGA LISTO',
    brief: 'Presupuesto, preaprobación, plazos, requisitos — antes de mostrar.',
    successSub: 'ASÍ SE VE EL ÉXITO',
  },
};

export const Explainer: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = COPY[lang];
  const simVariant = lang === 'es' ? 'rent-es' : 'rent-en';
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <Scene from={0} dur={150}><RingingHook caption={c.ring} /></Scene>
      <Scene from={150} dur={300}><RealityGap leftTitle={c.gapLt} leftBody={c.gapL} rightTitle={c.gapRt} rightBody={c.gapR} /></Scene>
      <Scene from={450} dur={300}><BigText text={c.wave} sub={c.waveSub} bg={theme.teal} color={theme.white} size={78} /></Scene>
      <Scene from={750} dur={300}><BigText text={c.meet} sub={c.meetSub} size={110} /></Scene>
      <Scene from={1050} dur={750}><Stage scale={0.82}><PhoneCallSim variant={simVariant} /></Stage></Scene>
      <Scene from={1800} dur={300}>
        <Stage scale={0.92}>
          <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
            <AppCockpit highlight="leads" lang={lang} />
            <div style={{ maxWidth: 640, fontFamily: theme.font }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 16 }}>{c.appSub}</div>
              <div style={{ fontSize: 62, fontWeight: 900, color: theme.ink, lineHeight: 1.1 }}>{c.app}</div>
            </div>
          </div>
        </Stage>
      </Scene>
      <Scene from={2100} dur={300}>
        <Stage scale={0.92}>
          <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
            <AppCockpit highlight="brief" lang={lang} />
            <div style={{ maxWidth: 640, fontFamily: theme.font }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 16 }}>{c.briefSub}</div>
              <div style={{ fontSize: 62, fontWeight: 900, color: theme.ink, lineHeight: 1.1 }}>{c.brief}</div>
            </div>
          </div>
        </Stage>
      </Scene>
      <Scene from={2400} dur={300}>
        <Stage>
          <div style={{ fontFamily: theme.font, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 50 }}>{c.successSub}</div>
            <div style={{ display: 'flex', gap: 100 }}>
              <KpiCounter from={40} to={100} suffix="%" label={lang === 'es' ? 'llamadas atendidas' : 'leads caught'} />
              <KpiCounter from={0} to={2} label={lang === 'es' ? 'citas mientras dormías' : 'booked while you slept'} delay={12} />
              <KpiCounter from={0} to={1} label={lang === 'es' ? 'comisión que no perdiste' : 'commission kept'} delay={24} color={theme.amber} />
            </div>
          </div>
        </Stage>
      </Scene>
      <Scene from={2700} dur={300}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};
