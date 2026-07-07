import { AppCockpit } from '../components/AppCockpit';
import { AudibleCall } from '../components/AudibleCall';
import { CTACard } from '../components/CTACard';
import { KpiCounter } from '../components/KpiCounter';
import { RealityGap } from '../components/RealityGap';
import { callSceneDur } from '../data/calls';
import { Film, filmDuration, type FilmScene } from '../components/Film';
import { BigText, RingingHook, Stage } from '../components/Scene';
import { theme } from '../theme';

type Lang = 'en' | 'es';
const en = (l: Lang, id: string) => (l === 'en' ? id : undefined);

const COPY = {
  en: {
    ring: 'ring… ring… ring…', gapLt: 'Without Orby', gapRt: 'With Orby',
    gapL: 'Phone rings out. Buyer calls the next agent. You paid for that lead.',
    gapR: 'Every call answered, qualified, booked — English or Spanish.',
    cost: 'You didn’t lose the deal on price. You lost it on a missed call.', costSub: 'THE REAL REASON DEALS SLIP',
    wave: 'Latinos are the majority of net new U.S. homeowner growth.¹', waveSub: 'THE GROWTH IN BUYING SPEAKS SPANISH',
    meet: 'Orby catches. You close.', meetSub: 'MEET ORBY — YOUR AI RECEPTIONIST',
    bilingualSub: 'AND WHEN THE BUYER SPEAKS SPANISH…',
    appSub: 'YOUR WHOLE PIPELINE, IN YOUR POCKET', app: 'Every lead, every showing — nothing typed. It fills itself.',
    briefSub: 'WALK IN READY', brief: 'Budget, pre-approval, timeline, must-haves — before you show.',
    control: 'You see everything. You approve everything. Orby never goes behind your back.', controlSub: 'YOU’RE IN CONTROL',
    objection: 'Will Orby replace you? No. It catches the calls you miss — you still close the deal.', objectionSub: 'AUGMENTATION, NOT REPLACEMENT',
    founder: 'Built by an agent who lost the deal.', founderSub: 'FIFTEEN YEARS. ONE MISSED CALL.',
    successSub: 'WHAT SUCCESS LOOKS LIKE', caught: 'leads caught', slept: 'booked while you slept', kept: 'commission kept',
  },
  es: {
    ring: 'ring… ring… ring…', gapLt: 'Sin Orby', gapRt: 'Con Orby',
    gapL: 'El teléfono suena y nadie contesta. El comprador llama al siguiente agente.',
    gapR: 'Cada llamada atendida, calificada y agendada — en inglés o español.',
    cost: 'No perdiste la venta por el precio. La perdiste por una llamada sin contestar.', costSub: 'LA VERDADERA RAZÓN POR LA QUE SE ESCAPAN',
    wave: 'Los latinos son la mayoría del crecimiento neto de propietarios en EE. UU.¹', waveSub: 'EL CRECIMIENTO EN COMPRAS HABLA ESPAÑOL',
    meet: 'Orby atiende. Tú cierras.', meetSub: 'CONOCE A ORBY — TU RECEPCIONISTA CON IA',
    bilingualSub: 'Y CUANDO EL COMPRADOR HABLA ESPAÑOL…',
    appSub: 'TODA TU CARTERA, EN TU BOLSILLO', app: 'Cada contacto, cada cita — sin teclear nada. Se llena solo.',
    briefSub: 'LLEGA LISTO', brief: 'Presupuesto, preaprobación, plazos, requisitos — antes de mostrar.',
    control: 'Ves todo. Apruebas todo. Orby nunca actúa a tus espaldas.', controlSub: 'TÚ TIENES EL CONTROL',
    objection: '¿Orby te reemplaza? No. Atiende las llamadas que pierdes — tú sigues cerrando la venta.', objectionSub: 'TE POTENCIA, NO TE REEMPLAZA',
    founder: 'Creado por un agente que perdió la venta.', founderSub: 'QUINCE AÑOS. UNA LLAMADA PERDIDA.',
    successSub: 'ASÍ SE VE EL ÉXITO', caught: 'llamadas atendidas', slept: 'citas mientras dormías', kept: 'comisión que no perdiste',
  },
};

const appBeat = (lang: Lang, sub: string, body: string, highlight: 'leads' | 'brief') => (
  <Stage scale={0.92}>
    <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
      <AppCockpit highlight={highlight} lang={lang} />
      <div style={{ maxWidth: 640, fontFamily: theme.font }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 16 }}>{sub}</div>
        <div style={{ fontSize: 62, fontWeight: 900, color: theme.text, lineHeight: 1.1 }}>{body}</div>
      </div>
    </div>
  </Stage>
);

export const explainerScenes = (lang: Lang): FilmScene[] => {
  const c = COPY[lang];
  const sim = lang === 'es' ? 'rent-es' : 'rent-en';
  const scenes: FilmScene[] = [
    { dur: 143, audio: en(lang, 'explainer-01'), node: <RingingHook caption={c.ring} /> },
    { dur: 277, audio: en(lang, 'explainer-02'), node: <RealityGap leftTitle={c.gapLt} leftBody={c.gapL} rightTitle={c.gapRt} rightBody={c.gapR} /> },
    { dur: 185, audio: en(lang, 'explainer-03'), node: <BigText text={c.cost} sub={c.costSub} color={theme.coral} size={82} /> },
    { dur: 234, audio: en(lang, 'explainer-04'), node: <BigText text={c.wave} sub={c.waveSub} color={theme.white} size={78} /> },
    { dur: 141, audio: en(lang, 'explainer-05'), node: <BigText text={c.meet} sub={c.meetSub} size={96} withOrb /> },
    // 6 — the main audible call (EN or ES depending on the cut)
    { dur: callSceneDur(lang, undefined, 85), node: <AudibleCall callLang={lang} simVariant={sim} narrator={lang === 'en' ? 'explainer-06' : 'explainer-es-06'} scale={0.82} /> },
  ];
  // 7 — bilingual proof (the Spanish call), EN cut only. ES cut's scene 6 is
  // already the Spanish call, so it's dropped here to avoid the same call twice.
  if (lang === 'en') {
    scenes.push({ dur: callSceneDur('es', undefined, 85), node: <AudibleCall callLang="es" simVariant="rent-es" narrator="explainer-07" scale={0.8} caption={c.bilingualSub} /> });
  }
  scenes.push(
    { dur: 191, audio: en(lang, 'explainer-08'), node: appBeat(lang, c.appSub, c.app, 'leads') },
    { dur: 229, audio: en(lang, 'explainer-09'), node: appBeat(lang, c.briefSub, c.brief, 'brief') },
    { dur: 157, audio: en(lang, 'explainer-10'), node: <BigText text={c.control} sub={c.controlSub} size={80} /> },
    { dur: 115, audio: en(lang, 'explainer-11'), node: <BigText text={c.objection} sub={c.objectionSub} color={theme.white} size={76} /> },
    { dur: 165, audio: en(lang, 'explainer-12'), node: <BigText text={c.founder} sub={c.founderSub} size={96} /> },
    { dur: 250, audio: en(lang, 'explainer-13'), node: (
      <Stage>
        <div style={{ fontFamily: theme.font, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, marginBottom: 50 }}>{c.successSub}</div>
          <div style={{ display: 'flex', gap: 100 }}>
            <KpiCounter from={40} to={100} suffix="%" label={c.caught} />
            <KpiCounter from={0} to={2} label={c.slept} delay={12} />
            <KpiCounter from={0} to={1} label={c.kept} delay={24} color={theme.coral} />
          </div>
        </div>
      </Stage>
    ) },
    { dur: 264, audio: en(lang, 'explainer-14'), node: <CTACard lang={lang} /> },
  );
  return scenes;
};

export const Explainer: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => <Film scenes={explainerScenes(lang)} />;
export const explainerDuration = (lang: Lang) => filmDuration(explainerScenes(lang));
