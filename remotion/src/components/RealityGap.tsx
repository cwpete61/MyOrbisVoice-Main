import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Bg } from './Scene';
import { theme } from '../theme';

/** Split beat on dark: current painful reality (coral) vs with-Orby (teal). The
 *  right panel slides + glows in. */
export const RealityGap: React.FC<{
  leftTitle?: string;
  leftBody?: string;
  rightTitle?: string;
  rightBody?: string;
}> = ({
  leftTitle = 'Without Orby',
  leftBody = 'Phone rings out. Buyer calls the next agent. You paid for that lead.',
  rightTitle = 'With Orby',
  rightBody = 'Every call answered, qualified, and booked — English or Spanish.',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leftIn = interpolate(frame, [4, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rightIn = interpolate(frame, [fps * 0.9, fps * 1.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const Panel: React.FC<{ accent: string; title: string; body: string; on: number; sign: string }> = ({ accent, title, body, on, sign }) => (
    <div
      style={{
        flex: 1,
        background: theme.panel,
        border: `1px solid ${accent}44`,
        borderRadius: 28,
        padding: 64,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: on,
        transform: `translateY(${interpolate(on, [0, 1], [30, 0])}px)`,
        boxShadow: `0 0 60px ${accent}18`,
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 800, color: accent, marginBottom: 20, letterSpacing: 1 }}>
        {sign} {title}
      </div>
      <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.12, color: theme.text }}>{body}</div>
    </div>
  );

  return (
    <Bg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 40, padding: 90, alignItems: 'stretch', fontFamily: theme.font }}>
        <Panel accent={theme.coral} title={leftTitle} body={leftBody} on={leftIn} sign="✕" />
        <Panel accent={theme.teal} title={rightTitle} body={rightBody} on={rightIn} sign="✓" />
      </div>
    </Bg>
  );
};
