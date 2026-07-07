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
    gapLt: 'Without Orby',
    gapRt: 'With Orby',
    gapL: 'Phone rings out. Buyer calls the next agent. You paid for that lead.',
    gapR: 'Every call answered, qualified, booked — English or Spanish.',
    cost: 'You didn’t lose the deal on price. You lost it on a missed call.',
    costSub: 'THE REAL REASON DEALS SLIP',
    wave: 'Latinos are the majority of net new U.S. homeowner growth.¹',
    waveSub: 'THE GROWTH IN BUYING SPEAKS SPANISH',
    meet: 'Orby catches. You close.',
    meetSub: 'MEET ORBY — YOUR AI RECEPTIONIST',
    bilingualSub: 'AND WHEN THE BUYER SPEAKS SPANISH…',
    appSub: 'YOUR WHOLE PIPELINE, IN YOUR POCKET',
    app: 'Every lead, every showing — nothing typed. It fills itself.',
    briefSub: 'WALK IN READY',
    brief: 'Budget, pre-approval, timeline, must-haves — before you show.',
    control: 'You see everything. You approve everything. Orby never goes behind your back.',
    controlSub: 'YOU’RE IN CONTROL',
    objection: 'Will Orby replace you? No. It catches the calls you miss — you still close the deal.',
    objectionSub: 'AUGMENTATION, NOT REPLACEMENT',
    founder: 'Built by an agent who lost the deal.',
    founderSub: 'FIFTEEN YEARS. ONE MISSED CALL.',
    successSub: 'WHAT SUCCESS LOOKS LIKE',
    caught: 'leads caught',
    slept: 'booked while you slept',
    kept: 'commission kept',
  },
  es: {
    ring: 'ring… ring… ring…',
    gapLt: 'Sin Orby',
    gapRt: 'Con Orby',
    gapL: 'El teléfono suena y nadie contesta. El comprador llama al siguiente agente.',
    gapR: 'Cada llamada atendida, calificada y agendada — en inglés o español.',
    cost: 'No perdiste la venta por el precio. La perdiste por una llamada sin contestar.',
    costSub: 'LA VERDADERA RAZÓN POR LA QUE SE ESCAPAN',
    wave: 'Los latinos son la mayoría del crecimiento neto de propietarios en EE. UU.¹',
    waveSub: 'EL CRECIMIENTO EN COMPRAS HABLA ESPAÑOL',
    meet: 'Orby atiende. Tú cierras.',
    meetSub: 'CONOCE A ORBY — TU RECEPCIONISTA CON IA',
    bilingualSub: 'Y CUANDO EL COMPRADOR HABLA ESPAÑOL…',
    appSub: 'TODA TU CARTERA, EN TU BOLSILLO',
    app: 'Cada contacto, cada cita — sin teclear nada. Se llena solo.',
    briefSub: 'LLEGA LISTO',
    brief: 'Presupuesto, preaprobación, plazos, requisitos — antes de mostrar.',
    control: 'Ves todo. Apruebas todo. Orby nunca actúa a tus espaldas.',
    controlSub: 'TÚ TIENES EL CONTROL',
    objection: '¿Orby te reemplaza? No. Atiende las llamadas que pierdes — tú sigues cerrando la venta.',
    objectionSub: 'TE POTENCIA, NO TE REEMPLAZA',
    founder: 'Creado por un agente que perdió la venta.',
    founderSub: 'QUINCE AÑOS. UNA LLAMADA PERDIDA.',
    successSub: 'ASÍ SE VE EL ÉXITO',
    caught: 'llamadas atendidas',
    slept: 'citas mientras dormías',
    kept: 'comisión que no perdiste',
  },
};

export const Explainer: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const c = COPY[lang];
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {/* 1 hook */}
      <Scene from={0} dur={180}><RingingHook caption={c.ring} /></Scene>
      {/* 2 reality gap */}
      <Scene from={180} dur={360}><RealityGap leftTitle={c.gapLt} leftBody={c.gapL} rightTitle={c.gapRt} rightBody={c.gapR} /></Scene>
      {/* 3 the cost */}
      <Scene from={540} dur={300}><BigText text={c.cost} sub={c.costSub} bg={theme.amberBg} color={theme.amber} size={82} /></Scene>
      {/* 4 the wave */}
      <Scene from={840} dur={360}><BigText text={c.wave} sub={c.waveSub} bg={theme.teal} color={theme.white} size={78} /></Scene>
      {/* 5 meet Orby */}
      <Scene from={1200} dur={300}><BigText text={c.meet} sub={c.meetSub} size={110} /></Scene>
      {/* 6 phone sim (primary language) */}
      <Scene from={1500} dur={840}><Stage scale={0.82}><PhoneCallSim variant={sim} /></Stage></Scene>
      {/* 7 bilingual proof — the Spanish call */}
      <Scene from={2340} dur={600}>
        <AbsoluteFill style={{ background: theme.bg }}>
          <Stage scale={0.8}><PhoneCallSim variant="rent-es" /></Stage>
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 60 }}>
            <div style={{ fontFamily: theme.font, fontSize: 34, fontWeight: 800, color: theme.tealDeep, letterSpacing: 1 }}>{c.bilingualSub}</div>
          </AbsoluteFill>
        </AbsoluteFill>
      </Scene>
      {/* 8 the app */}
      <Scene from={2940} dur={360}>
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
      {/* 9 showing brief */}
      <Scene from={3300} dur={360}>
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
      {/* 10 control / trust */}
      <Scene from={3660} dur={300}><BigText text={c.control} sub={c.controlSub} size={80} /></Scene>
      {/* 11 objection — augmentation not replacement */}
      <Scene from={3960} dur={300}><BigText text={c.objection} sub={c.objectionSub} bg={theme.teal} color={theme.white} size={76} /></Scene>
      {/* 12 founder credibility */}
      <Scene from={4260} dur={300}><BigText text={c.founder} sub={c.founderSub} size={96} /></Scene>
      {/* 13 success */}
      <Scene from={4560} dur={480}>
        <Stage>
          <div style={{ fontFamily: theme.font, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 50 }}>{c.successSub}</div>
            <div style={{ display: 'flex', gap: 100 }}>
              <KpiCounter from={40} to={100} suffix="%" label={c.caught} />
              <KpiCounter from={0} to={2} label={c.slept} delay={12} />
              <KpiCounter from={0} to={1} label={c.kept} delay={24} color={theme.amber} />
            </div>
          </div>
        </Stage>
      </Scene>
      {/* 14 CTA */}
      <Scene from={5040} dur={360}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};
