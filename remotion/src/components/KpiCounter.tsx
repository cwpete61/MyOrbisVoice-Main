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
  size?: number;
  format?: 'plain' | 'comma';
}> = ({ from, to, prefix = '', suffix = '', label, delay = 0, durationInFrames = 45, color = theme.teal, size = 130, format = 'plain' }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - p, 3);
  const value = Math.round(from + (to - from) * eased);
  const shown = format === 'comma' ? value.toLocaleString('en-US') : String(value);
  const appear = interpolate(frame - delay, [-10, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Subtle pop as the count lands (last ~10 frames of the count).
  const pop = interpolate(frame - delay, [durationInFrames - 8, durationInFrames], [1.06, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ textAlign: 'center', fontFamily: theme.font, opacity: appear, transform: `translateY(${interpolate(appear, [0, 1], [20, 0])}px)` }}>
      <div style={{ fontSize: size, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em', textShadow: `0 0 ${size * 0.35}px ${color}55`, transform: `scale(${pop})` }}>
        {prefix}
        {shown}
        {suffix}
      </div>
      <div style={{ fontSize: Math.max(28, size * 0.22), fontWeight: 700, color: theme.textDim, marginTop: 14, maxWidth: size * 3.2 }}>{label}</div>
    </div>
  );
};
