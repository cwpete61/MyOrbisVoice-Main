import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** Split screen: current painful reality (amber, missed call) vs with-Orby
 *  (teal, caught). A divider wipes right to reveal the "after". */
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
  const wipe = interpolate(frame, [fps * 0.4, fps * 2], [50, 50], { extrapolateRight: 'clamp' });
  const rightIn = interpolate(frame, [fps * 1.2, fps * 2.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const Panel: React.FC<{ side: 'l' | 'r'; title: string; body: string }> = ({ side, title, body }) => (
    <div
      style={{
        flex: 1,
        background: side === 'l' ? theme.amberBg : theme.teal,
        color: side === 'l' ? theme.amber : theme.white,
        padding: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: side === 'r' ? rightIn : 1,
        transform: side === 'r' ? `translateX(${interpolate(rightIn, [0, 1], [40, 0])}px)` : 'none',
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, opacity: 0.75, marginBottom: 18 }}>
        {side === 'l' ? '✕ ' : '✓ '}
        {title}
      </div>
      <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.1 }}>{body}</div>
    </div>
  );

  return (
    <AbsoluteFill style={{ fontFamily: theme.font, flexDirection: 'row', width: `${wipe * 2}%` }}>
      <Panel side="l" title={leftTitle} body={leftBody} />
      <Panel side="r" title={rightTitle} body={rightBody} />
    </AbsoluteFill>
  );
};
