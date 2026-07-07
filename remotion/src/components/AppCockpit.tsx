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

/** The agent app (PWA) mock in a phone frame: a leads list + a Showing Brief
 *  card. Everything staggers in — "nothing typed, it fills itself". */
export const AppCockpit: React.FC<{ highlight?: Highlight; lang?: 'en' | 'es' }> = ({
  highlight = 'leads',
  lang = 'en',
}) => {
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
        height: 980,
        background: theme.white,
        borderRadius: 56,
        border: `14px solid ${theme.ink}`,
        boxShadow: '0 40px 100px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        fontFamily: theme.font,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ background: theme.teal, color: theme.white, padding: '30px 34px 26px' }}>
        <div style={{ fontSize: 26, opacity: 0.85, fontWeight: 600 }}>MyOrbisAgents · Orby</div>
        <div style={{ fontSize: 42, fontWeight: 800, marginTop: 4 }}>{headerLabel}</div>
      </div>

      <div style={{ padding: 28, flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {leads.map((l, i) => {
          const s = spring({ frame: frame - i * 12, fps, config: { damping: 14 } });
          return (
            <div
              key={l.name}
              style={{
                transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
                opacity: s,
                background: theme.bg,
                border: `1px solid ${theme.line}`,
                borderRadius: 22,
                padding: '22px 26px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 34, fontWeight: 800, color: theme.ink }}>{l.name}</div>
                <div style={{ fontSize: 26, color: theme.muted, marginTop: 4 }}>{l.note}</div>
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: theme.tealDeep,
                  background: 'rgba(26,152,152,0.12)',
                  padding: '8px 16px',
                  borderRadius: 999,
                }}
              >
                {l.tag}
              </div>
            </div>
          );
        })}

        {showBrief && (
          <div
            style={{
              opacity: spring({ frame: frame - 30, fps, config: { damping: 16 } }),
              marginTop: 8,
              background: theme.ink,
              color: theme.white,
              borderRadius: 24,
              padding: 28,
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 18, color: theme.teal }}>{brief.title}</div>
            {brief.rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 26, opacity: 0.7 }}>{k}</span>
                <span style={{ fontSize: 26, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
