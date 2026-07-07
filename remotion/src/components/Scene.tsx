import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

/** Timed scene wrapper — a Sequence at `from` for `dur` frames. */
export const Scene: React.FC<{ from: number; dur: number; children: React.ReactNode }> = ({ from, dur, children }) => (
  <Sequence from={from} durationInFrames={dur}>
    {children}
  </Sequence>
);

/** Full-frame centered headline card, fades + rises in. Used for the text beats. */
export const BigText: React.FC<{
  text: string;
  sub?: string;
  bg?: string;
  color?: string;
  size?: number;
}> = ({ text, sub, bg = theme.bg, color = theme.ink, size = 90 }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill
      style={{
        background: bg,
        color,
        fontFamily: theme.font,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 120,
      }}
    >
      <div style={{ opacity: a, transform: `translateY(${interpolate(a, [0, 1], [30, 0])}px)` }}>
        {sub && <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.6, marginBottom: 20, letterSpacing: 1 }}>{sub}</div>}
        <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1500 }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Ringing-phone hook: an unanswered call, amber, ring counter climbing. */
export const RingingHook: React.FC<{ caption?: string }> = ({ caption = 'ring… ring… ring…' }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.06 * Math.sin(frame / 4);
  const rings = Math.floor(frame / 30) + 1;
  return (
    <AbsoluteFill style={{ background: theme.bgDark, alignItems: 'center', justifyContent: 'center', fontFamily: theme.font }}>
      <div style={{ transform: `scale(${pulse})`, fontSize: 200 }}>📞</div>
      <div style={{ color: theme.amber, fontSize: 54, fontWeight: 800, marginTop: 40 }}>{caption}</div>
      <div style={{ color: theme.white, opacity: 0.4, fontSize: 30, marginTop: 12 }}>
        {rings} missed {rings === 1 ? 'call' : 'calls'}
      </div>
    </AbsoluteFill>
  );
};

/** Center any component (e.g. the phone sim / app / kpis) on a background. */
export const Stage: React.FC<{ bg?: string; children: React.ReactNode; scale?: number }> = ({
  bg = theme.bg,
  children,
  scale = 1,
}) => (
  <AbsoluteFill style={{ background: bg, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ transform: `scale(${scale})` }}>{children}</div>
  </AbsoluteFill>
);
