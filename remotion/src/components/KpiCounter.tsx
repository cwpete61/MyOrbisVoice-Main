import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

/** Bold scoreboard number (teal or coral) with a dim label — the reference's
 *  "78%" / "<5 min" stat style, on dark. */
export const KpiCounter: React.FC<{
  from: number;
  to: number;
  prefix?: string;
  suffix?: string;
  label: string;
  delay?: number;
  durationInFrames?: number;
  color?: string;
}> = ({ from, to, prefix = '', suffix = '', label, delay = 0, durationInFrames = 45, color = theme.teal }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - p, 3);
  const value = Math.round(from + (to - from) * eased);
  const appear = interpolate(frame - delay, [-10, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ textAlign: 'center', fontFamily: theme.font, opacity: appear, transform: `translateY(${interpolate(appear, [0, 1], [20, 0])}px)` }}>
      <div style={{ fontSize: 130, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em', textShadow: `0 0 40px ${color}55` }}>
        {prefix}
        {value}
        {suffix}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: theme.textDim, marginTop: 12, maxWidth: 340 }}>{label}</div>
    </div>
  );
};
