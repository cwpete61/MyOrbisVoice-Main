import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** Animated scoreboard number (e.g. 40% → 100% leads caught). */
export const KpiCounter: React.FC<{
  from: number;
  to: number;
  suffix?: string;
  label: string;
  delay?: number;
  durationInFrames?: number;
  color?: string;
}> = ({ from, to, suffix = '', label, delay = 0, durationInFrames = 45, color = theme.teal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame - delay, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = 1 - Math.pow(1 - p, 3);
  const value = Math.round(from + (to - from) * eased);
  const appear = interpolate(frame - delay, [-10, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  void fps;
  return (
    <div style={{ textAlign: 'center', fontFamily: theme.font, opacity: appear }}>
      <div style={{ fontSize: 110, fontWeight: 900, color, lineHeight: 1 }}>
        {value}
        {suffix}
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: theme.muted, marginTop: 10 }}>{label}</div>
    </div>
  );
};
