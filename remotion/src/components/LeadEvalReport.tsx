import { interpolate, useCurrentFrame } from 'remotion';
import { KpiCounter } from './KpiCounter';
import { Stage } from './Scene';
import { theme } from '../theme';

// A "Lead Capture Eval" results card — the wedge tool's output. Rows reveal in
// sequence with red alert values, then the big leaking-commission figure counts
// up. Numbers are illustrative sample results, not a specific customer claim.
const ROWS = {
  en: [
    { label: 'Calls missed last month', value: '23' },
    { label: 'Answered after-hours', value: '0%' },
    { label: 'Avg. time to respond', value: '4h 11m' },
  ],
  es: [
    { label: 'Llamadas perdidas el mes pasado', value: '23' },
    { label: 'Atendidas fuera de horario', value: '0%' },
    { label: 'Tiempo promedio de respuesta', value: '4h 11m' },
  ],
};
const COPY = {
  en: { title: 'LEAD CAPTURE EVAL · YOUR RESULTS', leak: 'Estimated commission leaking' },
  es: { title: 'EVALUACIÓN DE CAPTURA · TUS RESULTADOS', leak: 'Comisión estimada que se te escapa' },
};

export const LeadEvalReport: React.FC<{ lang?: 'en' | 'es' }> = ({ lang = 'en' }) => {
  const frame = useCurrentFrame();
  const rows = ROWS[lang];
  const c = COPY[lang];
  return (
    <Stage scale={0.98}>
      <div
        style={{
          width: 1180,
          background: theme.panel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 34,
          padding: '54px 64px',
          fontFamily: theme.font,
          boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 800, color: theme.muted, letterSpacing: 2, marginBottom: 40 }}>{c.title}</div>
        {rows.map((r, i) => {
          const ap = interpolate(frame, [10 + i * 22, 28 + i * 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '26px 0',
                borderBottom: `1px solid ${theme.line}`,
                opacity: ap,
                transform: `translateX(${interpolate(ap, [0, 1], [-24, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 600, color: theme.textDim }}>{r.label}</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: theme.coral }}>{r.value}</div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 44 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: theme.text, maxWidth: 520 }}>{c.leak}</div>
          <KpiCounter from={0} to={18400} prefix="$" format="comma" label="" color={theme.coral} size={104} delay={70} durationInFrames={55} />
        </div>
      </div>
    </Stage>
  );
};
