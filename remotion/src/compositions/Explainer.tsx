import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { AppCockpit } from '../components/AppCockpit';
import { CallVoiceover } from '../components/CallVoiceover';
import { CTACard } from '../components/CTACard';
import { KpiCounter } from '../components/KpiCounter';
import { PhoneCallSim } from '../components/PhoneCallSim';
import { RealityGap } from '../components/RealityGap';
import { BigText, RingingHook, Scene, Stage } from '../components/Scene';
import { theme } from '../theme';

type Lang = 'en' | 'es';

// Per-turn voiceover clip lengths (frames @30fps) for the audible Explainer
// call — drives both the bubble layout and the VO placement so they stay in
// sync. NORMAL speed (1.0×) so the call sounds natural; the sim scene grows to
// fit and the later scenes shift by `shift` (below). EN call ~35s, ES ~40s.
// = ceil(clip length) + 8f, so each bubble holds its full spoken clip plus a
// short pause before the next speaker — no overlap, natural back-and-forth.
const CALL_DURS_EN = [201, 91, 246, 45, 123, 42, 142, 39, 168, 41];
const CALL_DURS_ES = [210, 114, 256, 65, 97, 45, 183, 44, 214, 39];
const LEAD_IN = 85; // narrator lead-in (>= narrator clip) so it finishes before the call
const BASE_SIM_DUR = 840; // original sim-scene length (before the audible call)

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
  const vo = (id: string) => (lang === 'en' ? id : undefined); // ES VO is a later pass
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  const callDurs = lang === 'en' ? CALL_DURS_EN : CALL_DURS_ES;
  const simDur = LEAD_IN + callDurs.reduce((a, b) => a + b, 0) + 20; // grows to fit the full-speed call
  const shift = simDur - BASE_SIM_DUR; // scenes 7-14 move later by this
  // Scene 7 (bilingual proof, the Spanish call) is voiced in the EN cut only —
  // in the ES cut scene 6 is already the Spanish call, so it stays visual there.
  const voiceScene7 = lang === 'en';
  const esCallTotal = CALL_DURS_ES.reduce((a, b) => a + b, 0);
  const sim7Dur = voiceScene7 ? LEAD_IN + esCallTotal + 20 : 600;
  const shift2 = sim7Dur - 600; // scenes 8-14 move later by this (EN only)
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {/* 1 hook */}
      <Scene audio={vo('explainer-01')} from={0} dur={180}><RingingHook caption={c.ring} /></Scene>
      {/* 2 reality gap */}
      <Scene audio={vo('explainer-02')} from={180} dur={360}><RealityGap leftTitle={c.gapLt} leftBody={c.gapL} rightTitle={c.gapRt} rightBody={c.gapR} /></Scene>
      {/* 3 the cost */}
      <Scene audio={vo('explainer-03')} from={540} dur={300}><BigText text={c.cost} sub={c.costSub} bg={theme.amberBg} color={theme.amber} size={82} /></Scene>
      {/* 4 the wave */}
      <Scene audio={vo('explainer-04')} from={840} dur={360}><BigText text={c.wave} sub={c.waveSub} bg={theme.teal} color={theme.white} size={78} /></Scene>
      {/* 5 meet Orby */}
      <Scene audio={vo('explainer-05')} from={1200} dur={300}><BigText text={c.meet} sub={c.meetSub} size={96} withOrb /></Scene>
      {/* 6 phone sim — AUDIBLE call: narrator lead-in (~2.4s), then the voiced
          conversation (Orby=nova, caller=echo) synced to the bubbles, 1571–2336 */}
      <Scene from={1500} dur={simDur}>
        <Audio src={staticFile(lang === 'en' ? 'vo/explainer-06.mp3' : 'vo/explainer-es-06.mp3')} />
        <Sequence from={71}>
          <Stage scale={0.82}><PhoneCallSim variant={sim} turnDurs={callDurs} /></Stage>
          <CallVoiceover lang={lang} durs={callDurs} />
        </Sequence>
      </Scene>
      {/* 7 bilingual proof — the Spanish call. Voiced (audible) in the EN cut;
          visual-only in the ES cut (its scene 6 is already the Spanish call). */}
      <Scene from={2340 + shift} dur={sim7Dur}>
        {voiceScene7 ? (
          <>
            <Audio src={staticFile('vo/explainer-07.mp3')} />
            <Sequence from={LEAD_IN}>
              <AbsoluteFill style={{ background: theme.bg }}>
                <Stage scale={0.8}><PhoneCallSim variant="rent-es" turnDurs={CALL_DURS_ES} /></Stage>
                <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 60 }}>
                  <div style={{ fontFamily: theme.font, fontSize: 34, fontWeight: 800, color: theme.tealDeep, letterSpacing: 1 }}>{c.bilingualSub}</div>
                </AbsoluteFill>
              </AbsoluteFill>
              <CallVoiceover lang="es" durs={CALL_DURS_ES} />
            </Sequence>
          </>
        ) : (
          <AbsoluteFill style={{ background: theme.bg }}>
            <Stage scale={0.8}><PhoneCallSim variant="rent-es" /></Stage>
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 60 }}>
              <div style={{ fontFamily: theme.font, fontSize: 34, fontWeight: 800, color: theme.tealDeep, letterSpacing: 1 }}>{c.bilingualSub}</div>
            </AbsoluteFill>
          </AbsoluteFill>
        )}
      </Scene>
      {/* 8 the app */}
      <Scene audio={vo('explainer-08')} from={2940 + shift + shift2} dur={360}>
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
      <Scene audio={vo('explainer-09')} from={3300 + shift + shift2} dur={360}>
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
      <Scene audio={vo('explainer-10')} from={3660 + shift + shift2} dur={300}><BigText text={c.control} sub={c.controlSub} size={80} /></Scene>
      {/* 11 objection — augmentation not replacement */}
      <Scene audio={vo('explainer-11')} from={3960 + shift + shift2} dur={300}><BigText text={c.objection} sub={c.objectionSub} bg={theme.teal} color={theme.white} size={76} /></Scene>
      {/* 12 founder credibility */}
      <Scene audio={vo('explainer-12')} from={4260 + shift + shift2} dur={300}><BigText text={c.founder} sub={c.founderSub} size={96} /></Scene>
      {/* 13 success */}
      <Scene audio={vo('explainer-13')} from={4560 + shift + shift2} dur={480}>
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
      <Scene audio={vo('explainer-14')} from={5040 + shift + shift2} dur={360}><CTACard lang={lang} /></Scene>
    </AbsoluteFill>
  );
};
