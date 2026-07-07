import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

type Highlight = 'leads' | 'showing' | 'brief';

const LEADS_EN = [
  { name: 'Peter P.', note: '3BR rental · near UT', tag: 'Booked' },
  { name: 'Maria G.', note: 'Condo · Duval St', tag: 'Qualified' },
  { name: 'Dana R.', note: 'Bungalow · S. Lamar', tag: 'New lead' },
];
const LEADS_ES = [
  { name: 'Peter P.', note: 'Renta 3 rec · cerca de UT', tag: 'Agendado' },
  { name: 'María G.', note: 'Condominio · Duval St', tag: 'Calificado' },
  { name: 'Dana R.', note: 'Casa · S. Lamar', tag: 'Nuevo' },
];
const BRIEF_EN = { title: 'Showing Brief · Peter P.', rows: [['Move-in', 'Start of next month'], ['Budget', '$3,100/mo'], ['Occupants', '1 + dog'], ['Type', 'Rental · 12-mo lease'], ['Status', 'Showing booked']] };
const BRIEF_ES = { title: 'Resumen de Cita · Peter P.', rows: [['Mudanza', 'Inicio del próximo mes'], ['Presupuesto', '$3,100/mes'], ['Ocupantes', '1 + perro'], ['Tipo', 'Renta · 12 meses'], ['Estado', 'Cita agendada']] };

/** The agent app (PWA) mock, dark: a leads list + Showing Brief card. Staggers
 *  in — "nothing typed, it fills itself." */
export const AppCockpit: React.FC<{ highlight?: Highlight; lang?: 'en' | 'es' }> = ({ highlight = 'leads', lang = 'en' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leads = lang === 'es' ? LEADS_ES : LEADS_EN;
  const brief = lang === 'es' ? BRIEF_ES : BRIEF_EN;
  const showBrief = highlight === 'brief';
  const headerLabel = lang === 'es' ? 'Tu cartera' : 'Your pipeline';

  return (
    <div
      style={{
        width: 560,
        height: 940,
        background: '#081a1e',
        borderRadius: 52,
        border: `12px solid #04100f`,
        boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 60px rgba(45,207,207,0.08)',
        overflow: 'hidden',
        fontFamily: theme.font,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ background: theme.gradMix, color: theme.white, padding: '30px 34px 26px' }}>
        <div style={{ fontSize: 25, opacity: 0.9, fontWeight: 700 }}>MyOrbisAgents · Orby</div>
        <div style={{ fontSize: 42, fontWeight: 900, marginTop: 4 }}>{headerLabel}</div>
      </div>
      <div style={{ padding: 26, flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {leads.map((l, i) => {
          const s = spring({ frame: frame - i * 12, fps, config: { damping: 14 } });
          return (
            <div
              key={l.name}
              style={{
                transform: `translateY(${interpolate(s, [0, 1], [28, 0])}px)`,
                opacity: s,
                background: theme.panel,
                border: `1px solid ${theme.line}`,
                borderRadius: 20,
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 33, fontWeight: 800, color: theme.text }}>{l.name}</div>
                <div style={{ fontSize: 25, color: theme.textDim, marginTop: 4 }}>{l.note}</div>
              </div>
              <div style={{ fontSize: 23, fontWeight: 800, color: theme.aqua, background: 'rgba(45,207,207,0.12)', padding: '8px 16px', borderRadius: 999 }}>{l.tag}</div>
            </div>
          );
        })}
        {showBrief && (
          <div style={{ opacity: spring({ frame: frame - 30, fps, config: { damping: 16 } }), marginTop: 6, background: theme.gradMix, borderRadius: 22, padding: 26 }}>
            <div style={{ fontSize: 29, fontWeight: 900, marginBottom: 16, color: theme.white }}>{brief.title}</div>
            {brief.rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid rgba(255,255,255,0.16)' }}>
                <span style={{ fontSize: 25, color: 'rgba(255,255,255,0.75)' }}>{k}</span>
                <span style={{ fontSize: 25, fontWeight: 800, color: theme.white }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
