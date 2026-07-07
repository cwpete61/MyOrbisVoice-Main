import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CALLS } from '../data/calls';
import { theme } from '../theme';
import { SpanishBadge } from './SpanishBadge';

const ROW_STEP = 200; // approx vertical rhythm per bubble for auto-scroll
const VISIBLE = 4;

/** Hero asset: an animated phone call (caller + Orby bubbles) beside a live app
 *  panel whose pipeline steps light up as the call books the showing. */
export const PhoneCallSim: React.FC<{ variant?: string; showApp?: boolean }> = ({
  variant = 'rent-en',
  showApp = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const call = CALLS[variant] ?? CALLS['rent-en']!;

  // Cumulative start frame for each turn.
  const starts: number[] = [];
  call.turns.reduce((acc, t, i) => {
    starts[i] = acc;
    return acc + t.dur;
  }, 0);

  const activeIndex = starts.reduce((best, s, i) => (s <= frame ? i : best), 0);
  const scroll = -Math.max(0, activeIndex - VISIBLE + 1) * ROW_STEP;

  // Which app steps are "done": any turn carrying that app marker has started.
  const doneSteps = new Set<string>();
  call.turns.forEach((t, i) => {
    if (t.app && starts[i]! <= frame) doneSteps.add(t.app);
  });

  // Spanish badge window: around the spanish turn's start.
  const spanishTurn = call.turns.findIndex((t) => t.spanish);
  const spanishStart = spanishTurn >= 0 ? starts[spanishTurn]! : -9999;
  const showBadge = frame >= spanishStart + 20 && frame < spanishStart + 130;

  return (
    <div style={{ display: 'flex', gap: 60, alignItems: 'center', fontFamily: theme.font }}>
      {/* Phone with the conversation */}
      <div
        style={{
          position: 'relative',
          width: 640,
          height: 980,
          background: theme.bgDark,
          borderRadius: 56,
          border: `14px solid ${theme.ink}`,
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ background: theme.teal, color: theme.white, padding: '26px 30px' }}>
          <div style={{ fontSize: 24, opacity: 0.85 }}>{call.language === 'es' ? 'Llamada entrante' : 'Incoming call'}</div>
          <div style={{ fontSize: 38, fontWeight: 800 }}>Orby · John Brown</div>
        </div>

        <div style={{ position: 'absolute', top: 130, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 28px', transform: `translateY(${scroll}px)`, transition: 'none' }}>
            {call.turns.map((t, i) => {
              const start = starts[i]!;
              const s = spring({ frame: frame - start, fps, config: { damping: 15 } });
              if (frame < start - 4) return null;
              const isOrby = t.who === 'orby';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: isOrby ? 'flex-start' : 'flex-end',
                    marginBottom: 22,
                    opacity: s,
                    transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      maxWidth: 440,
                      background: isOrby ? theme.teal : theme.white,
                      color: isOrby ? theme.white : theme.ink,
                      fontSize: 30,
                      fontWeight: 500,
                      lineHeight: 1.25,
                      padding: '18px 24px',
                      borderRadius: 26,
                      borderBottomLeftRadius: isOrby ? 6 : 26,
                      borderBottomRightRadius: isOrby ? 26 : 6,
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
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <SpanishBadge delay={spanishStart + 20} label={call.language === 'es' ? 'I also speak English' : 'También hablo español'} />
          </div>
        )}
      </div>

      {/* Live app pipeline */}
      {showApp && (
        <div
          style={{
            width: 520,
            background: theme.white,
            borderRadius: 32,
            border: `1px solid ${theme.line}`,
            padding: 40,
            boxShadow: '0 30px 80px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: theme.muted, marginBottom: 24 }}>
            {call.language === 'es' ? 'En tu app, en vivo' : 'In your app, live'}
          </div>
          {call.appSteps.map((step) => {
            const done = doneSteps.has(step);
            const s = spring({ frame: done ? 8 : 0, fps, config: { damping: 12 } });
            return (
              <div
                key={step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '18px 0',
                  opacity: done ? 1 : 0.32,
                  transform: `scale(${done ? 0.98 + 0.02 * s : 0.98})`,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: done ? theme.teal : theme.line,
                    color: theme.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {done ? '✓' : ''}
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: done ? theme.ink : theme.muted }}>{step}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
