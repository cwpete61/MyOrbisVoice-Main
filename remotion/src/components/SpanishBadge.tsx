import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** "También hablo español" chip that springs in during a bilingual moment. */
export const SpanishBadge: React.FC<{ delay?: number; label?: string }> = ({
  delay = 0,
  label = 'También hablo español',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 160 } });
  return (
    <div
      style={{
        transform: `scale(${s})`,
        opacity: s,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        background: theme.teal,
        color: theme.white,
        fontFamily: theme.font,
        fontWeight: 700,
        fontSize: 30,
        padding: '12px 22px',
        borderRadius: 999,
        boxShadow: '0 10px 30px rgba(26,152,152,0.35)',
      }}
    >
      <span style={{ fontSize: 30 }}>🗣️</span>
      {label}
    </div>
  );
};
