import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CALLS } from '../data/calls';
import { theme } from '../theme';
import { Orb } from './Orb';
import { SpanishBadge } from './SpanishBadge';

const ROW_STEP = 172;
const VISIBLE = 4;

/** Live audio waveform bars (the reference's "on a call" motif). */
const Waveform: React.FC<{ bars?: number }> = ({ bars = 22 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = 8 + (Math.sin(frame / 3 + i * 0.7) * 0.5 + 0.5) * 30;
        return <div key={i} style={{ width: 4, height: h, borderRadius: 3, background: theme.aqua, opacity: 0.85 }} />;
      })}
    </div>
  );
};

/** Hero: a dark "Orby on a call" card whose chat builds live, beside a dark app
 *  pipeline that lights up as the showing books. Matches the reference explainer. */
export const PhoneCallSim: React.FC<{ variant?: string; showApp?: boolean; turnDurs?: number[] }> = ({ variant = 'rent-en', showApp = true, turnDurs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const call = CALLS[variant] ?? CALLS['rent-en']!;

  // Bubble timing: default from the call data, or overridden (e.g. matched to
  // per-turn voiceover clip lengths in the audible Explainer call).
  const durs = turnDurs ?? call.turns.map((t) => t.dur);
  const starts: number[] = [];
  durs.reduce((acc, d, i) => {
    starts[i] = acc;
    return acc + d;
  }, 0);
  const activeIndex = starts.reduce((best, s, i) => (s <= frame ? i : best), 0);
  const scroll = -Math.max(0, activeIndex - VISIBLE + 1) * ROW_STEP;

  const doneSteps = new Set<string>();
  call.turns.forEach((t, i) => {
    if (t.app && starts[i]! <= frame) doneSteps.add(t.app);
  });

  const spanishTurn = call.turns.findIndex((t) => t.spanish);
  const spanishStart = spanishTurn >= 0 ? starts[spanishTurn]! : -9999;
  const showBadge = frame >= spanishStart + 18 && frame < spanishStart + 120;
  const cardIn = spring({ frame, fps, config: { damping: 18 } });

  return (
    <div style={{ display: 'flex', gap: 48, alignItems: 'stretch', fontFamily: theme.font, opacity: cardIn, transform: `translateY(${interpolate(cardIn, [0, 1], [30, 0])}px)` }}>
      {/* Call card */}
      <div
        style={{
          position: 'relative',
          width: 720,
          height: 900,
          background: theme.panel,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 32,
          overflow: 'hidden',
          boxShadow: '0 40px 120px rgba(0,0,0,0.55), 0 0 60px rgba(45,207,207,0.08)',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '26px 30px', borderBottom: `1px solid ${theme.line}` }}>
          <div style={{ width: 46, height: 46, flex: 'none' }}><Orb size={46} talking /></div>
          <div style={{ flex: 1 }}>
            <span style={{ color: theme.text, fontWeight: 800, fontSize: 30 }}>Orby</span>
            <span style={{ color: theme.aqua, fontSize: 24, marginLeft: 12 }}>● on a call</span>
          </div>
          <Waveform />
        </div>
        {/* transcript */}
        <div style={{ position: 'absolute', top: 100, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px 30px', transform: `translateY(${scroll}px)` }}>
            {call.turns.map((t, i) => {
              const start = starts[i]!;
              if (frame < start - 4) return null;
              const s = spring({ frame: frame - start, fps, config: { damping: 16 } });
              const isOrby = t.who === 'orby';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isOrby ? 'flex-start' : 'flex-end', marginBottom: 20, opacity: s, transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)` }}>
                  <div
                    style={{
                      maxWidth: 480,
                      background: isOrby ? 'rgba(255,255,255,0.05)' : theme.gradHot,
                      color: isOrby ? theme.text : '#04231f',
                      fontSize: 29,
                      fontWeight: isOrby ? 500 : 600,
                      lineHeight: 1.28,
                      padding: '17px 23px',
                      borderRadius: 22,
                      border: isOrby ? `1px solid ${theme.line}` : 'none',
                      borderBottomLeftRadius: isOrby ? 6 : 22,
                      borderBottomRightRadius: isOrby ? 22 : 6,
                    }}
                  >
                    {t.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {showBadge && (
          <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <SpanishBadge delay={spanishStart + 18} label={call.language === 'es' ? 'I also speak English' : 'También hablo español'} />
          </div>
        )}
      </div>

      {/* app pipeline */}
      {showApp && (
        <div style={{ width: 520, background: theme.panel, border: `1px solid ${theme.panelBorder}`, borderRadius: 28, padding: 38, boxShadow: '0 40px 120px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: theme.aqua, marginBottom: 26 }}>
            {call.language === 'es' ? 'En tu app, en vivo' : 'In your app · live'}
          </div>
          {call.appSteps.map((step) => {
            const done = doneSteps.has(step);
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '17px 0', opacity: done ? 1 : 0.3 }}>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: done ? theme.teal : 'rgba(255,255,255,0.07)', color: '#042', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flex: 'none', boxShadow: done ? `0 0 18px ${theme.teal}` : 'none' }}>
                  {done ? '✓' : ''}
                </div>
                <div style={{ fontSize: 31, fontWeight: 700, color: done ? theme.text : theme.textFaint }}>{step}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
