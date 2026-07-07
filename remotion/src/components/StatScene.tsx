import { KpiCounter } from './KpiCounter';
import { Stage } from './Scene';
import { theme } from '../theme';

export type Stat = {
  prefix?: string;
  from?: number;
  to: number;
  suffix?: string;
  label: string;
  color?: string;
  format?: 'plain' | 'comma';
};

/** A dedicated animated-statistic beat: an eyebrow, one or two big counting
 *  numbers (the reference's "78%" / "<5 min" scoreboard style), and an optional
 *  headline caption underneath. Use it wherever the narration speaks a figure —
 *  the number counts up on screen as it's said. */
export const StatScene: React.FC<{
  eyebrow?: string;
  stats: Stat[];
  caption?: string;
}> = ({ eyebrow, stats, caption }) => {
  const solo = stats.length === 1;
  const size = solo ? 240 : 168;
  return (
    <Stage>
      <div style={{ textAlign: 'center', fontFamily: theme.font }}>
        {eyebrow && (
          <div style={{ fontSize: 32, fontWeight: 700, color: theme.muted, letterSpacing: 1.5, marginBottom: 46 }}>{eyebrow}</div>
        )}
        <div style={{ display: 'flex', gap: solo ? 0 : 130, justifyContent: 'center', alignItems: 'flex-start' }}>
          {stats.map((s, i) => (
            <KpiCounter
              key={i}
              from={s.from ?? 0}
              to={s.to}
              prefix={s.prefix}
              suffix={s.suffix}
              label={s.label}
              color={s.color ?? theme.teal}
              format={s.format}
              size={size}
              delay={i * 16}
              durationInFrames={58}
            />
          ))}
        </div>
        {caption && (
          <div style={{ fontSize: 54, fontWeight: 900, color: theme.text, marginTop: 58, maxWidth: 1180, lineHeight: 1.12, marginLeft: 'auto', marginRight: 'auto' }}>
            {caption}
          </div>
        )}
      </div>
    </Stage>
  );
};
